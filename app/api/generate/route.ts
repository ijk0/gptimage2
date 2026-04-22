import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

type GenerateBody = {
  prompt?: string;
  size?: string;
  n?: number;
  quality?: string;
  background?: string;
};

export async function POST(req: Request) {
  const apiUrl = process.env.IMAGE_API_URL;
  const apiKey = process.env.IMAGE_API_KEY;
  const model = process.env.IMAGE_MODEL ?? "gpt-image-2";

  if (!apiUrl || !apiKey) {
    return NextResponse.json(
      { error: "Server missing IMAGE_API_URL or IMAGE_API_KEY" },
      { status: 500 },
    );
  }

  let body: GenerateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }

  const endpoint = apiUrl.replace(/\/+$/, "") + "/images/generations";

  const payload: Record<string, unknown> = {
    model,
    prompt,
    n: Math.min(Math.max(body.n ?? 1, 1), 4),
    size: body.size ?? "1024x1024",
  };
  if (body.quality) payload.quality = body.quality;
  if (body.background) payload.background = body.background;

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
      { error: `Upstream request failed: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  const text = await upstream.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { error: `Upstream returned non-JSON (${upstream.status})`, raw: text.slice(0, 500) },
      { status: 502 },
    );
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { error: "Upstream error", status: upstream.status, details: data },
      { status: upstream.status },
    );
  }

  const rawItems = (data as { data?: Array<{ url?: string; b64_json?: string }> }).data ?? [];
  const images = rawItems
    .map((item) => {
      if (item.b64_json) return `data:image/png;base64,${item.b64_json}`;
      if (item.url) return item.url;
      return null;
    })
    .filter((x): x is string => Boolean(x));

  if (images.length === 0) {
    return NextResponse.json(
      { error: "Upstream returned no images", details: data },
      { status: 502 },
    );
  }

  return NextResponse.json({ images });
}
