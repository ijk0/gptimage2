import { NextResponse } from "next/server";
import { apiBase } from "@/lib/quota";

export const runtime = "nodejs";
export const maxDuration = 60;

type PromptBody = {
  intent?: string;
  style?: string;
  // legacy
  scenario?: string;
};

const BASE_RULES = `你是资深的图像生成提示词专家，专为 gpt-image-2 模型撰写中文提示词。

撰写规则：
- 直接输出提示词正文，不要引言、解释或结尾语。
- 不使用 Markdown、引号、括号注释或编号。
- 长度 80–180 个中文字符。
- 顺序展开：主体 → 构图 → 光线 → 色彩 → 质感 → 风格。
- 使用具体、可视化的语言，避免空洞的形容词堆砌。
- 只输出一个版本。`;

const STYLE_HINTS: Record<string, string> = {
  "水墨": "风格：东方水墨写意，留白充足，宣纸渗化质感。",
  "赛博": "风格：赛博朋克，霓虹反光，湿润街面，电影级光影。",
  "童话": "风格：童话书插画，温暖水彩，柔和手绘线条。",
  "极简": "风格：极简摄影，单色背景，杂志级构图，冷静克制。",
  "电影": "风格：电影剧照，35mm 胶片质感，氛围光影，叙事性构图。",
  "时尚": "风格：高级时装大片，硬光塑形，时装周封面质感。",
  "科幻": "风格：科幻概念艺术，体积光，未来材质，氛围雾气。",
  "东方": "风格：东方美学，传统色彩体系，工笔与写意交融。",
  "蒸汽": "风格：蒸汽朋克，黄铜齿轮，工业质感，昏黄灯光。",
};

function systemFor(style?: string): string {
  if (!style || style === "无" || style.toLowerCase() === "none") {
    return (
      BASE_RULES +
      "\n\n未指定风格，保持中性，按用户意图自然展开，不强加任何特定艺术流派的标签。"
    );
  }
  const hint = STYLE_HINTS[style];
  return hint ? `${BASE_RULES}\n\n${hint}` : BASE_RULES;
}

export async function POST(req: Request) {
  const apiKey = process.env.IMAGE_API_KEY;
  const model = process.env.TEXT_MODEL ?? "gpt-5.4";

  if (!apiBase() || !apiKey) {
    return NextResponse.json(
      { error: "服务器未配置 IMAGE_API_URL 或 IMAGE_API_KEY" },
      { status: 500 },
    );
  }

  let body: PromptBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法的 JSON" }, { status: 400 });
  }

  const intent = body.intent?.trim() || body.scenario?.trim();
  if (!intent) {
    return NextResponse.json(
      { error: "请先写下你想要的画面" },
      { status: 400 },
    );
  }

  const style = body.style?.trim();
  const systemPrompt = systemFor(style);
  const userMessage = `意图：${intent}`;

  const endpoint = `${apiBase()}/chat/completions`;

  let upstream: Response;
  try {
    upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.9,
        max_tokens: 400,
      }),
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

  const content = (
    data as { choices?: Array<{ message?: { content?: string } }> }
  ).choices?.[0]?.message?.content?.trim();

  if (!content) {
    return NextResponse.json(
      { error: "模型未返回提示词", details: data },
      { status: 502 },
    );
  }

  const cleaned = content
    .replace(/^["「『"]+|["」』"]+$/g, "")
    .replace(/^提示词[:：]\s*/i, "")
    .trim();

  return NextResponse.json({ prompt: cleaned, model });
}
