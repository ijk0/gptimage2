import { NextResponse } from "next/server";
import { apiBase } from "@/lib/quota";

export const runtime = "nodejs";
export const maxDuration = 60;

type PromptBody = {
  scenario?: string;
  style?: string;
};

const SYSTEM_PROMPT = `你是一位资深的图像生成提示词专家，专门为 gpt-image-2 模型撰写中文提示词。

撰写规则：
- 直接输出提示词正文，不要任何引言、解释或结尾语。
- 不要使用 Markdown、引号、括号注释或编号。
- 长度 80–180 个中文字符。
- 按照"主体 → 构图 → 光线 → 色彩 → 质感 → 风格"的顺序展开。
- 使用具体、可视化的语言，避免空洞的形容词堆砌。
- 只输出一个版本，不要给多个备选。`;

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

  const scenario = body.scenario?.trim();
  if (!scenario) {
    return NextResponse.json(
      { error: "请选择或输入一个主题" },
      { status: 400 },
    );
  }

  const userMessage = body.style
    ? `主题：${scenario}\n风格偏好：${body.style}`
    : `主题：${scenario}`;

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
          { role: "system", content: SYSTEM_PROMPT },
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
