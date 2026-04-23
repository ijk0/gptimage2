import { NextResponse } from "next/server";
import { readQuota, setQuotaCookies, FREE_LIMIT, apiBase } from "@/lib/quota";

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
  const quota = readQuota(req);

  if (quota.remaining <= 0) {
    return NextResponse.json(
      {
        error: `免费额度已用完（${quota.limit} 张）。可使用兑换码继续生成。`,
        ...quota,
      },
      { status: 429 },
    );
  }

  const effectiveN = Math.min(requestedN, quota.remaining);
  const endpoint = `${apiBase()}/images/generations`;

  const payload: Record<string, unknown> = {
    model,
    prompt,
    n: effectiveN,
    size: body.size ?? "auto",
  };
  if (body.quality) payload.quality = body.quality;
  if (body.background) payload.background = body.background;
  if (body.output_format) payload.output_format = body.output_format;
  if (typeof body.output_compression === "number") {
    payload.output_compression = body.output_compression;
  }
  if (body.moderation) payload.moderation = body.moderation;

  let upstream: Response;
  try {
    upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return NextResponse.json(
      { error: `上游请求失败：${(err as Error).message}` },
      { status: 502 },
    );
  }

  let text: string;
  try {
    text = await upstream.text();
  } catch (err) {
    return NextResponse.json(
      { error: `读取上游响应失败：${(err as Error).message}` },
      { status: 502 },
    );
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return NextResponse.json(
      {
        error: `上游返回了非 JSON 响应（HTTP ${upstream.status}）`,
        raw: text.slice(0, 500),
      },
      { status: 502 },
    );
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { error: "上游接口报错", status: upstream.status, details: data },
      { status: upstream.status },
    );
  }

  const format = (body.output_format ?? "png").toLowerCase();
  const mime =
    format === "jpeg" || format === "jpg"
      ? "image/jpeg"
      : format === "webp"
        ? "image/webp"
        : "image/png";

  const rawItems =
    (data as { data?: Array<{ url?: string; b64_json?: string }> }).data ?? [];
  const images = rawItems
    .map((item) => {
      if (item.b64_json) return `data:${mime};base64,${item.b64_json}`;
      if (item.url) return item.url;
      return null;
    })
    .filter((x): x is string => Boolean(x));

  if (images.length === 0) {
    return NextResponse.json(
      { error: "上游未返回任何图片", details: data },
      { status: 502 },
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

export async function GET(req: Request) {
  const quota = readQuota(req);
  void FREE_LIMIT;
  return NextResponse.json(quota);
}
