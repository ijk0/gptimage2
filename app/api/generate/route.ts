import { NextResponse } from "next/server";
import {
  FREE_LIMIT,
  apiBase,
  getQuotaUnified,
  recordUsage,
} from "@/lib/quota";

export const runtime = "nodejs";
export const maxDuration = 300;

type GenerateBody = {
  prompt?: string;
  size?: string;
  n?: number;
  quality?: string;
  background?: string;
  output_format?: string;
  output_compression?: number;
  moderation?: string;
};

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

  let body: GenerateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法的 JSON" }, { status: 400 });
  }

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return NextResponse.json({ error: "提示词不能为空" }, { status: 400 });
  }

  const requestedN = Math.min(Math.max(body.n ?? 1, 1), 4);
  const quota = await getQuotaUnified(req);

  if (quota.remaining <= 0) {
    return NextResponse.json(
      {
        error:
          quota.limit === 0
            ? "暂无可用次数。请输入兑换码解锁生成。"
            : `可用次数已用完（${quota.limit} 张）。可使用兑换码继续生成。`,
        limit: quota.limit,
        used: quota.used,
        grant: quota.grant,
        remaining: quota.remaining,
      },
      { status: 429 },
    );
  }

  const effectiveN = Math.min(requestedN, quota.remaining);
  const endpoint = `${apiBase()}/images/generations`;

  const basePayload: Record<string, unknown> = {
    model,
    prompt,
    n: 1,
    size: body.size ?? "auto",
  };
  if (body.quality) basePayload.quality = body.quality;
  // `background: "transparent"` currently fails on gpt-image-2 (the UI does
  // not expose this control, but we guard anyway in case a direct API
  // consumer sends it). Surface a clean error instead of silently hitting
  // the upstream's generic failure.
  if (body.background === "transparent" && model.startsWith("gpt-image-2")) {
    return NextResponse.json(
      {
        error: "gpt-image-2 暂不支持透明背景，请选择 opaque 或 auto",
      },
      { status: 400 },
    );
  }
  if (body.background) basePayload.background = body.background;
  if (body.output_format) basePayload.output_format = body.output_format;
  if (typeof body.output_compression === "number") {
    basePayload.output_compression = body.output_compression;
  }
  if (body.moderation) basePayload.moderation = body.moderation;

  const format = (body.output_format ?? "png").toLowerCase();
  const mime =
    format === "jpeg" || format === "jpg"
      ? "image/jpeg"
      : format === "webp"
        ? "image/webp"
        : "image/png";

  // Fan out N parallel requests with n=1 each. The configured upstream model
  // does not reliably honor n>1 in a single call (often returns just one
  // image), so we issue independent requests and aggregate the results.
  type CallResult =
    | { ok: true; image: string }
    | { ok: false; status: number; details: unknown };

  async function callOnce(): Promise<CallResult> {
    let upstream: Response;
    try {
      upstream = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(basePayload),
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

    const item =
      (data as { data?: Array<{ url?: string; b64_json?: string }> }).data?.[0];
    if (item?.b64_json) {
      return { ok: true, image: `data:${mime};base64,${item.b64_json}` };
    }
    if (item?.url) {
      return { ok: true, image: item.url };
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

export async function GET(req: Request) {
  const quota = await getQuotaUnified(req);
  void FREE_LIMIT;
  return NextResponse.json({
    limit: quota.limit,
    used: quota.used,
    grant: quota.grant,
    remaining: quota.remaining,
  });
}
