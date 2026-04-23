import { NextResponse } from "next/server";
import { readQuota, setQuotaCookies, apiBase } from "@/lib/quota";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

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

  const prompt = String(form.get("prompt") ?? "").trim();
  if (!prompt) {
    return NextResponse.json({ error: "编辑指令不能为空" }, { status: 400 });
  }

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

  const quota = readQuota(req);
  if (quota.remaining <= 0) {
    return NextResponse.json(
      {
        error: `免费额度已用完（${quota.limit} 张）。可使用兑换码继续编辑。`,
        ...quota,
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

  const newUsed = quota.used + images.length;
  const newRemaining = Math.max(quota.limit - newUsed, 0);
  const res = NextResponse.json({
    images,
    format,
    limit: quota.limit,
    used: newUsed,
    remaining: newRemaining,
    grant: quota.grant,
  });
  setQuotaCookies(res, { used: newUsed, grant: quota.grant });
  return res;
}
