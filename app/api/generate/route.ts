import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const FREE_LIMIT = Number(process.env.FREE_LIMIT ?? 5);
const COOKIE_NAME = "gi2_used";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

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

function readUsed(req: Request): number {
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`${COOKIE_NAME}=(\\d+)`));
  if (!match) return 0;
  const n = Number(match[1]);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function setUsedCookie(res: NextResponse, used: number) {
  res.headers.append(
    "Set-Cookie",
    `${COOKIE_NAME}=${used}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax; HttpOnly`,
  );
}

export async function POST(req: Request) {
  const apiUrl = process.env.IMAGE_API_URL;
  const apiKey = process.env.IMAGE_API_KEY;
  const model = process.env.IMAGE_MODEL ?? "gpt-image-2";

  if (!apiUrl || !apiKey) {
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
  const used = readUsed(req);
  const remaining = Math.max(FREE_LIMIT - used, 0);

  if (remaining <= 0) {
    const res = NextResponse.json(
      {
        error: `免费额度已用完（${FREE_LIMIT} 张）。如需继续使用，请联系站长或自行部署。`,
        limit: FREE_LIMIT,
        used,
        remaining: 0,
      },
      { status: 429 },
    );
    return res;
  }

  const effectiveN = Math.min(requestedN, remaining);
  const endpoint = apiUrl.replace(/\/+$/, "") + "/images/generations";

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

  const text = await upstream.text();
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

  const nextUsed = Math.min(used + images.length, FREE_LIMIT);
  const res = NextResponse.json({
    images,
    format,
    limit: FREE_LIMIT,
    used: nextUsed,
    remaining: Math.max(FREE_LIMIT - nextUsed, 0),
  });
  setUsedCookie(res, nextUsed);
  return res;
}

export async function GET(req: Request) {
  const used = readUsed(req);
  return NextResponse.json({
    limit: FREE_LIMIT,
    used,
    remaining: Math.max(FREE_LIMIT - used, 0),
  });
}
