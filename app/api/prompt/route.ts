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

// Base rules distilled from OpenAI Cookbook's gpt-image-2 guide, fal.ai's
// prompting guide, the FIGURA/SCHEMA framework (arXiv 2603.20201), and
// Midjourney v6/v7 practitioner formulas. Emphasizes concrete physical
// facts over excitement adjectives.
const BASE_RULES = `你是资深的图像提示词编辑，专为 gpt-image-2 撰写中文提示词。

撰写结构（按此顺序展开）：
1. 场景 · 环境、时间、氛围
2. 主体 · 人物/物件 + 姿态/动作 + 取景比例
3. 细节 · 材质、纹理、光源方向与质量、可见瑕疵
4. 制作类型 · 摄影 / 水墨 / 插画 / 概念艺术 / 编辑大片 等具体类型
5. 约束 · 例如"无水印，无多余文字，无多余肢体"

硬性要求：
- 直接输出提示词正文；不引言、不解释、不带结尾语；不使用 Markdown、编号或引号。
- 长度 90–200 个中文字符；一段连续文字，标点隔开即可。
- 只写可见事实：具体颜色、具体材质、具体光向、具体镜头焦段、具体胶片/媒介。
- 严禁空洞词：「令人惊艳」「大师级」「顶级」「超清」「8K」「写实」「逼真」「精美」等。若想强调真实，改写物理事实（"湿润混凝土"、"毛孔可见"、"漆面反光"）。
- 若涉及摄影，应明确镜头焦段（35 / 50 / 85 mm 等）、光向（左上 45° 硬光、北窗柔光、阴天高调 等）、可选胶卷（Portra 400 温暖、Cinestill 800T 高光红晕 等）。
- 若涉及绘画/插画，明确媒介（水粉、水彩、宣纸水墨、铜版、丝网 等），可点名一位艺术家以锚定风格，不堆砌。
- 仅输出一个版本。`;

// Per-style directives. Each is appended to the system prompt when the
// corresponding chip is selected. Sources: OpenAI Cookbook, Midjourney
// practitioner guides, arXiv 2603.20201 (FIGURA), classical painting taxonomy.
const STYLE_HINTS: Record<string, string> = {
  水墨: `风格约束 · 中国传统水墨画：宣纸上的墨色由浓到淡渐变、留白充足，写意笔触与飞白肌理可见，可散点透视；可借鉴张大千或齐白石的写意路数。忌「写实」「逼真」「3D 渲染」等表述。`,
  东方: `风格约束 · 宋代院体工笔画：极细白描墨线勾勒，矿物颜料层层罩染（通透而非厚重），绢本或宣纸装裱，气韵生动，可参照赵昌或北宋画院的花鸟/人物传统，立轴或册页构图。`,
  胶片: `风格约束 · 35mm 胶片摄影：指定胶卷（Kodak Portra 400 温暖浅色 / Cinestill 800T 高光红晕 / Ektachrome 100 锐利高对比 任选其一以符合意图）；明确焦段（35mm 纪实 / 50mm 自然 / 85mm 人像压缩）；明确光向与光质；可见颗粒与轻微晕染；禁用「超清」「HDR」类词。`,
  极简: `风格约束 · 极简工作室静物摄影：主体置于哑光中性平面（水泥、亚麻或浅石材），45° 左上方单一白炽光源投下硬朗阴影，85mm 微距，大面积留白，无道具；色彩限一色或至多两种；商业级清晰度。`,
  电影: `风格约束 · 电影剧照（2.39:1 变形宽银幕）：青色阴影与暖色实用光分离，浅景深，大气层体积感；避免演播室平光。若语境允许可引用具体摄影师：Roger Deakins《2049》的 teal-orange；王家卫/杜可风《花样年华》的暖钨丝；Lubezki/Malick 的自然光广角。`,
  时尚: `风格约束 · 高级时尚编辑摄影：中画幅质感，明确光位（蚌壳光或戏剧性侧主光），《Vogue》/《Harper's Bazaar》式构图（全身或强半身裁切），去饱和的胶片调色，地点化背景，高级定制面料细节在满分辨率下清晰可辨。`,
  童话: `风格约束 · 欧洲古典童话插画：粗纹纸上的水粉或钢笔与水彩，柔和暖色调，Arthur Rackham 或 Edmund Dulac 式的装饰性线条，雾气氤氲的森林或城堡，书页比例；可点缀烫金装饰。忌「3D」「Pixar」类词。`,
  赛博: `风格约束 · 赛博朋克：霓虹照亮的都市（青/品红/琥珀霓虹溢色），体积雾，深色沥青的湿漉反光，《银翼杀手 2049》/《攻壳机动队》视觉语言，高对比明暗交错，变形镜头特征；全息或赛博植入细节可辨。`,
  科幻: `风格约束 · 专业科幻概念艺术：硬表面工业设计，生物发光或冷电弧点缀光，延续 Syd Mead 或 John Berkey 的构图传统，以人形比例建立尺度，大气雾气或体积光；明确构件类型（环境概念 / 载具正投影 / 角色三视图）。`,
  蒸汽: `风格约束 · 蒸汽朋克：维多利亚工业场景，裸露黄铜钟表齿轮与铆接铁构件，陈旧皮革，燃气灯琥珀光混合电弧高光，煤烟雾气，暖褐偏色盘，19 世纪末推测工程的机械表面细节。`,
};

function systemFor(style?: string): string {
  if (!style || style === "无" || style.toLowerCase() === "none") {
    return (
      BASE_RULES +
      `\n\n风格约束 · 无。按用户意图自然展开，不施加任何风格化偏向。若意图倾向摄影，默认 50mm 自然光；若倾向插画，默认干净线稿白底。`
    );
  }
  const hint = STYLE_HINTS[style];
  return hint ? `${BASE_RULES}\n\n${hint}` : BASE_RULES;
}

export async function POST(req: Request) {
  try {
    return await handlePost(req);
  } catch (err) {
    // Safety net: anything we failed to anticipate still comes back
    // as JSON, not as the Next.js HTML 500 page.
    return NextResponse.json(
      { error: `服务器内部错误：${(err as Error).message}` },
      { status: 500 },
    );
  }
}

async function handlePost(req: Request) {
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
        max_tokens: 500,
      }),
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
