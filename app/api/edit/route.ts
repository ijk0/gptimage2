import { NextResponse } from "next/server";
import { apiBase, getQuotaUnified, recordUsage } from "@/lib/quota";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

// Wrap a user-supplied natural-language edit instruction into the
// Change/Preserve/Constraints structure from the OpenAI cookbook. The model
// treats everything as fair game unless told otherwise, so an explicit
// Preserve block on every edit call is the difference between a clean targeted
// change and unwanted drift across the rest of the image.
//
// The user's text is placed inside a <user_change>…</user_change> tag so that
// any Chinese prose they write (which could plausibly contain "保留不变" or
// "禁止项" themselves) can't be mistaken by the model for a new structural
// section that overrides the wrapper. Any literal closing tag in the user
// input is neutralized.
//
// Callers that already compose a structured prompt (e.g. the face-refine
// pipeline in app/page.tsx) can bypass the wrapper by sending raw=1. Note
// that `raw=1` is a convenience flag, not a security boundary — the edit
// endpoint forwards whatever prompt it gets, so there is no secret to
// protect here.
function wrapEditInstruction(raw: string): string {
  const sanitized = raw.replace(/<\/?user_change>/gi, "");
  return [
    "你将对一张已有图片进行定向编辑。下列条款用 XML 样式标签分段，",
    "<user_change> 内为用户的改动意图；其余段为强制执行的边界条款。",
    `<user_change>${sanitized}</user_change>`,
    "保留不变：画面其余一切元素严格保持不动 —— 构图、取景、所有人物的身份与五官、姿态与表情、服装、光线方向与色温、背景、色调、颗粒与边框。",
    "文字约束：若原图包含文字，保持字形与位置不变；除非 <user_change> 明确要求，否则不新增任何文字、水印或贴纸。",
    "禁止项：不新增多余人物或肢体；不重新构图；不进行风格迁移；不做整体调色，除非 <user_change> 明确提出。",
    "冲突仲裁：若 <user_change> 与保留条款冲突，以 <user_change> 为准，但冲突范围仅限其显式提及的元素。",
  ].join("\n");
}

export async function POST(req: Request) {
  try {
    return await handlePost(req);
  } catch (err) {
    return NextResponse.json(
      { error: `服务器内部错误：${(err as Error).message}` },
      { status: 500 },
    );
  }
}

async function handlePost(req: Request) {
  const apiKey = process.env.IMAGE_API_KEY;
  const model = process.env.IMAGE_MODEL ?? "gpt-image-2";

  if (!apiBase() || !apiKey) {
    return NextResponse.json(
      { error: "服务器未配置 IMAGE_API_URL 或 IMAGE_API_KEY" },
      { status: 500 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "请求体不是合法的 multipart/form-data" },
      { status: 400 },
    );
  }

  const rawPrompt = String(form.get("prompt") ?? "").trim();
  if (!rawPrompt) {
    return NextResponse.json({ error: "编辑指令不能为空" }, { status: 400 });
  }
  // Callers that already hand-built a structured prompt (e.g. the face-refine
  // pipeline) pass raw=1 to skip the wrapper.
  const bypass = String(form.get("raw") ?? "") === "1";
  const prompt = bypass ? rawPrompt : wrapEditInstruction(rawPrompt);

  const image = form.get("image");
  if (!(image instanceof File) || image.size === 0) {
    return NextResponse.json({ error: "请先上传图片" }, { status: 400 });
  }
  if (image.size > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: `图片过大（上限 ${MAX_IMAGE_BYTES / 1024 / 1024}MB）` },
      { status: 400 },
    );
  }

  const size = String(form.get("size") ?? "auto");
  const quality = String(form.get("quality") ?? "auto");
  const format = String(form.get("output_format") ?? "png").toLowerCase();
  const inputFidelity = String(form.get("input_fidelity") ?? "");
  const requestedN = Math.min(
    Math.max(Number(form.get("n") ?? 1) || 1, 1),
    4,
  );

  const quota = await getQuotaUnified(req);
  if (quota.remaining <= 0) {
    return NextResponse.json(
      {
        error:
          quota.limit === 0
            ? "暂无可用次数。请输入兑换码解锁编辑。"
            : `可用次数已用完（${quota.limit} 张）。可使用兑换码继续编辑。`,
        limit: quota.limit,
        used: quota.used,
        grant: quota.grant,
        remaining: quota.remaining,
      },
      { status: 429 },
    );
  }

  const effectiveN = Math.min(requestedN, quota.remaining);
  const endpoint = `${apiBase()}/images/edits`;

  // Buffer the upload once so we can re-post it across fan-out calls.
  const imageBuffer = new Uint8Array(await image.arrayBuffer());
  const imageName = image.name || "upload.png";
  const imageType = image.type || "image/png";
  // Upstream /images/edits returns [echoed_input, edited_result] in data[];
  // we filter out any item whose bytes match the upload verbatim.
  const inputB64 = Buffer.from(imageBuffer).toString("base64");

  const mime =
    format === "jpeg" || format === "jpg"
      ? "image/jpeg"
      : format === "webp"
        ? "image/webp"
        : "image/png";

  type CallResult =
    | { ok: true; image: string }
    | { ok: false; status: number; details: unknown };

  async function callOnce(): Promise<CallResult> {
    const upstreamForm = new FormData();
    upstreamForm.set("model", model);
    upstreamForm.set("prompt", prompt);
    upstreamForm.set("n", "1");
    upstreamForm.set("size", size);
    if (quality) upstreamForm.set("quality", quality);
    if (format) upstreamForm.set("output_format", format);
    if (inputFidelity) upstreamForm.set("input_fidelity", inputFidelity);
    upstreamForm.set(
      "image",
      new Blob([imageBuffer], { type: imageType }),
      imageName,
    );

    let upstream: Response;
    try {
      upstream = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: upstreamForm,
      });
    } catch (err) {
      return { ok: false, status: 502, details: (err as Error).message };
    }

    let text: string;
    try {
      text = await upstream.text();
    } catch (err) {
      return { ok: false, status: 502, details: (err as Error).message };
    }

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return {
        ok: false,
        status: upstream.status,
        details: `非 JSON 响应：${text.slice(0, 200)}`,
      };
    }

    if (!upstream.ok) {
      return { ok: false, status: upstream.status, details: data };
    }

    const items =
      (data as { data?: Array<{ url?: string; b64_json?: string }> }).data ??
      [];
    // Prefer the first item that isn't a byte-for-byte echo of the input.
    const picked =
      items.find((it) => it.b64_json && it.b64_json !== inputB64) ??
      items[items.length - 1];
    if (picked?.b64_json) {
      return { ok: true, image: `data:${mime};base64,${picked.b64_json}` };
    }
    if (picked?.url) {
      return { ok: true, image: picked.url };
    }
    return { ok: false, status: 502, details: "上游未返回图片" };
  }

  const results = await Promise.all(
    Array.from({ length: effectiveN }, () => callOnce()),
  );
  const images = results.flatMap((r) => (r.ok ? [r.image] : []));

  if (images.length === 0) {
    const firstErr = results.find((r) => !r.ok) as
      | Extract<CallResult, { ok: false }>
      | undefined;
    return NextResponse.json(
      {
        error: "上游接口报错",
        status: firstErr?.status ?? 502,
        details: firstErr?.details ?? "未返回任何图片",
      },
      { status: firstErr?.status ?? 502 },
    );
  }

  const update = await recordUsage(req, images.length);
  const res = NextResponse.json({
    images,
    format,
    limit: update.quota.limit,
    used: update.quota.used,
    remaining: update.quota.remaining,
    grant: update.quota.grant,
  });
  update.applyCookies(res);
  return res;
}
