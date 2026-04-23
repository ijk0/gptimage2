---
title: gpt-image-2 optimization — Chinese text fidelity, small-portrait clarity, system-prompt rewrite
date: 2026-04-23
status: research-complete, implementation-pending
tags: [gpt-image-2, prompting, chinese-text, portraits, system-prompt]
sources:
  - https://developers.openai.com/cookbook/examples/multimodal/image-gen-models-prompting-guide
  - https://developers.openai.com/api/reference/resources/images/methods/generate
  - https://developers.openai.com/api/docs/guides/tools-image-generation
  - https://fal.ai/learn/tools/prompting-gpt-image-2
  - https://openai.com/index/introducing-chatgpt-images-2-0/
  - https://community.openai.com/t/image-editing-inpainting-with-a-mask-for-gpt-image-1-replaces-the-entire-image/1244275
  - https://www.atlabs.ai/blog/the-ultimate-gpt-image-2-prompting-guide-how-to-use-openai%E2%80%99s-best-image-model-2026
  - https://pixeldojo.ai/guides/gpt-image-2-prompting-guide
---

# gpt-image-2 Optimization Report

Scope: prompt-level, system-prompt-level, and API-parameter-level changes to fix the two most user-visible quality issues — **wrong Chinese characters** and **blurry small portraits** — in the current Next.js wrapper at `/app/api/{prompt,generate,edit}/route.ts`.

Four parallel research streams: (A) CJK text rendering, (B) small-subject clarity, (C) API + prompt best practices, (D) codebase audit. Findings below are cross-referenced against `app/api/prompt/route.ts:18-50` (`BASE_RULES` + `STYLE_HINTS`) and `app/api/generate/route.ts:79-91`.

---

## TL;DR — top 8 changes, ranked by impact

| # | Change | Fixes | Where | Effort |
|---|---|---|---|---|
| 1 | Force `quality="high"` whenever the prompt mentions `人像/肖像/portrait/face/特写` **and** the subject is small in frame | Blurry small portraits | `app/api/generate/route.ts:79` | S |
| 2 | Add a `text_in_image` extraction step in the rewriter — any quoted Chinese string gets wrapped in `「...」一字不改，字符必须完全与此一致` | Wrong Chinese characters | `app/api/prompt/route.ts:14-34` | M |
| 3 | Remove `background: "transparent"` from the UI or gate it on model version — **it is broken in gpt-image-2 at launch** | Silent failures | `app/page.tsx:422` + `/api/generate` | S |
| 4 | Add a face-framing rule to `BASE_RULES`: any subject must occupy ≥15 % of frame height, or be cropped to medium shot / waist-up | Blurry small portraits | `prompt/route.ts:20-34` | S |
| 5 | Add a two-pass face refinement workflow: detect face box → crop → re-edit → composite. Expose as a "精修人像" button. | Blurry small portraits in existing output | new `/api/refine-face` | L |
| 6 | Add a native SVG text-overlay pipeline (Sharp + Noto Sans CJK) for dense/critical Chinese body copy | Paragraph-level Chinese fails | new `/api/compose` | L |
| 7 | Drop rewriter temperature from `0.9` to `0.5` — creative variance at rewrite stage compounds with model stochasticity downstream | Inconsistent quality | `prompt/route.ts:122` | XS |
| 8 | Add a per-preset `{size, quality, style}` triple so the 70+ presets in `app/page.tsx:25-406` land on the right backend knobs automatically | Users never learn which settings match which preset | `app/page.tsx` PRESETS array | M |

---

## Section 1 — Chinese text rendering (`汉字`)

### Model reality as of April 2026

gpt-image-2 (launched 2026-04-21) is a **real leap** over gpt-image-1 / DALL-E 3 for CJK text: 95–99 % character-level accuracy on short labels and headlines, +242 Elo on Image Arena. This is driven by an explicit reasoning pass before rendering.

**But** the following still fail and cannot be fixed by prompting alone:

| Failure class | Prompting fix? |
|---|---|
| Full paragraphs / body copy (>~30 chars in one element) | ❌ Use overlay |
| Very small glyphs at low resolution | ⚠️ Partial — force `quality=high` |
| Rare / high-stroke chars (靁, 龘, 鏖) | ❌ Unreliable |
| Traditional ↔ Simplified ambiguity | ⚠️ Must be specified explicitly |
| Mixed density (headline + fine print in same image) | ⚠️ Split into two generations |

**Reliable zone:** ≤ 12 characters per visual element. Design around this.

### Prompt recipes (ranked by evidence strength)

**R1. Verbatim-constraint wrapping** (strongest, documented in OpenAI Cookbook)

Every Chinese string destined for rendering must be wrapped in double quotes and tagged with an exactness clause:

```
…在封面上方居中位置，以大号粗体宋体呈现书名"浮生六记"，白字深靛底。
该文字必须与此完全一致 — 不可添加笔画、不可替换字符、不可使用变体写法。
```

Without the "必须完全一致" clause the model treats the string as a semantic hint, not a verbatim target. This is the single highest-ROI change.

**R2. Font family anchoring** (moderate)

Name a concrete CJK font:

- **黑体 / Heiti** — signage, product, UI labels (best accuracy on short text)
- **宋体 / Songti** — editorial, book covers
- **楷体 / Kaiti** — classical / cultural
- **手写体** — risky, avoid for accuracy-critical work

**R3. Region anchoring** (moderate)

Pre-declare a bounding region before the text clause:

```
在画面右上角一块红色长条内（约占画面宽度 30%），渲染"特价优惠"四字，
白色粗黑体，字号约占该条高度的 70%。
```

**R4. Character isolation for critical glyphs** (documented in Cookbook)

For brand names / single-word logos:

```
品牌名由三个独立字符组成 — 怡 / 宝 / 水 — 逐字从左到右排列，
粗无衬线，无连笔，无风格变体。
```

**R5. Font size + canvas guidance**

Keep text at ≥ 6 % of frame height. At `1024x1536` that's ≥ 92 px vertical per glyph. Below this threshold, character fidelity drops sharply even on "high" quality.

### Engineering workarounds

**W1. SVG text overlay** (recommended for any text-critical use case)

Generate the background / layout **without** the text:
```
…上三分之一留出清晰设计区域，不渲染任何文字、标点、字符或符号。
```

Then overlay the exact text server-side using **Sharp + SVG** (libvips, no libraqm dependency, Vercel-compatible). This gives 100 % text fidelity. Bundle Noto Sans CJK Simplified + Traditional (+ optional Songti/Kaiti) as static assets.

**W2. OCR verify-and-retry loop**

1. Generate
2. Run PaddleOCR-VL or GPT-4o vision on the result
3. Levenshtein-compare against intent
4. Retry up to N=3, then fall back to W1

Viable but expensive — recommend only for brand-name / legal copy.

**W3. Two-pass edit inpaint** (niche)

Generate full layout with a placeholder region, then call `/images/edits` targeting just that region. Anecdotal evidence only; don't block on this.

### Rewriter-level implementation

Teach `gpt-5.4` to (a) extract every substring the user wants rendered as text, (b) wrap it with R1, (c) assign a font from R2, (d) place it via R3. Add this to `BASE_RULES`:

```
若用户意图包含需要在图中出现的具体文字（品牌名、标语、标题、标签），
将每段文字用中文直角引号「」包裹，并在其后紧接一条硬约束：
「该文字必须一字不差呈现，不允许增减笔画、替换字符或使用变体」。
为每段文字指派字体（黑体/宋体/楷体之一）、字号占比（相对画面高度）、
以及放置区域（画面的哪个象限 / 占据何等比例）。
单段文字不超过 12 字；若需更长文字，拆成多段或交由后期叠加。
```

---

## Section 2 — Small-subject / portrait clarity (`小人像模糊`)

### Root cause

gpt-image-2 has a minimum effective resolution per face. Below roughly **150 px vertical** at generation time, eye detail smears. At `1024x1024` with `quality=auto`, any face occupying < 15 % of frame height is in the danger zone.

Three compounding factors:
1. `quality=auto` can resolve to `medium`, where faces degrade
2. `size=1024x1024` gives less pixel budget than `1024x1536` for standing subjects
3. Descriptive adjectives ("beautiful face", "sharp features") don't activate the model's face-rendering mode

### Fixes

**F1. Force `quality="high"` for portrait intents**

Detect portrait keywords in the user intent at `/api/prompt` and set a flag that `/api/generate` uses to upgrade quality automatically:

```ts
// /api/prompt/route.ts
const PORTRAIT_KEYWORDS = /人像|肖像|自拍|证件照|头像|portrait|face|特写/;
const needsHighQuality = PORTRAIT_KEYWORDS.test(intent);
return NextResponse.json({ prompt: cleaned, model, hints: { needsHighQuality } });
```

The UI already offers `auto | low | medium | high` — we just need to nudge `auto` up when the intent demands it.

Cost delta: `1024x1024` goes from $0.053 (medium) → $0.211 (high). Roughly 4× but justified for any image where a face is the subject.

**F2. Prefer portrait canvas for portrait intents**

When the intent is a portrait, default `size` from `auto` to `1024x1536`. The model has more vertical pixel budget for a standing subject.

**F3. Framing directive in `BASE_RULES`**

Add to the 主体 section of `BASE_RULES`:

```
人物面部尺寸硬约束：
- 若画面以人物为主体，人脸在画面中的垂直高度不得小于画面高度的 15%。
- 单人：默认半身或胸像构图（medium shot / waist-up），除非用户明确要求全身或远景。
- 双人/三人：默认 medium shot，所有人面部朝向相机，每张脸占画面高度 ≥ 1/5。
- 远景或群像：人物视为环境元素，不强调面部细节，并在画面中额外指定"面部不作为焦点，做环境化处理"以避免模糊妆容出现。
- 镜头语言优先于形容词：写"85mm 人像镜头，f/1.8 浅景深，焦点在双眼"，
  而非"精致面部细节、锐利五官"等空词。
```

**F4. Lens language over adjectives**

Confirmed across all practitioner guides: `85mm portrait lens, f/1.8, sharp focus on eyes` produces measurably sharper faces than any quantity of "sharp", "detailed", "ultra-realistic" adjectives. The latter are pattern-matched as slop (current `BASE_RULES` already prohibits these — good).

**F5. Two-pass face refinement** (new feature)

For an existing generated image where the face came out blurry:

1. Face-detect the blur region (server-side, e.g. `face-api.js` or a simple heuristic on the user-supplied bounding box)
2. Crop with 20 px padding → resize to `1024x1024`
3. Call `/images/edits` with `quality=high`, `input_fidelity=high`, prompt:
   ```
   Enhance this portrait at full 1024×1024 fidelity: sharp eyes with visible
   catchlights, defined nose bridge, individual eyelashes, natural skin pore
   texture. Preserve identity, pose, expression, lighting, and background
   EXACTLY — only increase apparent sharpness and micro-detail of the face.
   No restyling, no recomposition.
   ```
4. Resize result back, composite into the original scene

Cost: ~$0.376 per refined image (scene + face pass). Expose as a "精修人像" post-generation button, not a blanket default.

**F6. Known failure modes to warn about in system prompt**

- Children's faces drift toward generic "cute child" — add `"真实的 N 岁儿童写真，不美化，不磨皮"` when detecting `宝宝 | 小孩 | 儿童`
- Over-the-shoulder shots deprioritize the partially visible face — add `"面部在此角度下仍清晰可见并处于焦点内"`
- Group shots > 4 people: all faces tend to blur. Recommend capping at 3 or switching to a wider framing with faces as environment.

---

## Section 3 — API parameter corrections

Findings from the cookbook + API reference + practitioner reports:

| Param | Current code | Correction |
|---|---|---|
| `background: "transparent"` | Exposed in UI / forwarded raw | **Currently broken in gpt-image-2.** Either remove from UI, gate on `IMAGE_MODEL !== "gpt-image-2"`, or surface a server-side error "本模型暂不支持透明背景". Don't silently fail. |
| `n > 1` | Code fans out `n=1` requests (good) | Keep fan-out. The model *does* accept `n>1` in one call but outputs correlate — variation is worse. Current code is correct. |
| `response_format` | Not set (good) | Confirmed: gpt-image-2 always returns base64 via `b64_json`. Don't add the param. |
| Negative prompts | Not used | Model has **no negative-prompt parameter.** Exclusions must be inline positive constraints: "无水印，无多余文字" (current `BASE_RULES` already does this — good). |
| `size="2048x2048"` | Exposed in UI | Officially supported; token cost is ~4× `1024x1024`. OK to keep but add a "生成较慢" microcopy when selected. |
| `partial_images: 1–3` | Not used | Streaming progressive previews; costs extra output tokens. Could improve perceived latency for high-quality/large-size jobs. Parking for now. |

### Rewriter params

| Param | Current | Recommended | Why |
|---|---|---|---|
| `model` | `gpt-5.4` via env | keep | |
| `temperature` | `0.9` | **`0.5`** | 0.9 is creative-writing territory. Image prompts are specification documents — variance at rewrite stage compounds with generation stochasticity. Lower temp = more consistent outputs across runs for the same intent. |
| `max_tokens` | `500` | `400` | Output is capped to 200 CJK chars anyway. |

---

## Section 4 — The big architectural question: Chinese or English output from the rewriter?

**Current state** (`prompt/route.ts:29`): rewriter produces 90–200 Chinese characters.

**Research finding, short version:** the practitioner consensus (fal.ai, PixelDojo, OpenAI cookbook examples) is to **output English image prompts** for gpt-image-2, even when the user's intent is Chinese. Reasons:

1. gpt-image-2's text-rendering improvement is about glyphs that appear *in* the image. Compositional understanding (lighting, lens, style, framing) is still trained predominantly on English-captioned data.
2. Chinese tokens cost 2–3× more per semantic unit in OpenAI's tokenizer — measurable latency and cost impact.
3. MIT Sloan cross-language study (Dec 2025) shows LLMs exhibit different cultural defaults when prompted in different languages; English prompting aligns better with the model's strongest compositional latent space.

**Counter-evidence:** for content that is itself culturally Chinese (水墨, 工笔, 汉服, 敦煌), Chinese prompting may activate culturally-aware training subsets better than English. This is not yet A/B-tested on gpt-image-2.

**Recommended architecture — hybrid:**

- Rewriter **reasons in Chinese** (system prompt stays Chinese to preserve user intent)
- Rewriter **outputs compositional instructions in English**: scene, subject, lighting, lens, material, constraints
- Rewriter **preserves exact Chinese strings inline** for anything that must appear as text in the image: `headline: "春日限定"` — never translate these
- Rewriter **preserves culturally-specific proper nouns** in both scripts when ambiguous: `Hanfu robe (汉服)`, `ink wash painting on rice paper (宣纸水墨)` — gives the model two anchors

This is a significant change. Recommend A/B testing before full migration:
- arm A: current Chinese output
- arm B: hybrid English compositional + inline Chinese text strings
- judge with a VLM (GPT-4o) scoring visual quality + text fidelity on 50 intents

If the user wants to stay all-Chinese for now, the Section 1 and Section 2 changes alone will still materially improve quality.

---

## Section 5 — Proposed `BASE_RULES` rewrite (Chinese-output variant)

Minimal-change version that keeps the current Chinese-output architecture but layers in every Section 1 + Section 2 fix:

```
你是资深的图像提示词编辑，专为 gpt-image-2 撰写中文提示词。

撰写结构（按此顺序展开）：
1. 画面类型 · 明确产物（摄影 / 海报 / UI / 概念艺术 / 水墨 / 插画 等）
2. 场景 · 环境、时间、氛围
3. 主体 · 人物/物件 + 姿态/动作 + 取景（medium shot / close-up / 全身 等）
4. 细节 · 材质、纹理、光源方向与质量、可见瑕疵、镜头焦段
5. 文字 · 所有需在图中呈现的中文，用「」包裹并强制一字不改
6. 约束 · 显式的禁止条目（无水印、无多余文字、无多余肢体）

硬性要求：
- 直接输出提示词正文；不引言、不解释、不带结尾语；不使用 Markdown、编号或引号。
- 长度 100–220 个中文字符；一段连续文字，标点隔开即可。
- 只写可见事实：具体颜色、具体材质、具体光向、具体镜头焦段、具体胶卷/媒介。
- 严禁空洞词：「令人惊艳」「大师级」「顶级」「超清」「8K」「写实」「逼真」「精美」「细节丰富」「专业级」等。若想强调真实，改写物理事实（"湿润混凝土"、"毛孔可见"、"漆面反光"）。

人像硬约束：
- 人脸在画面中的垂直高度不得小于画面高度的 15%。
- 单人默认 medium shot 或半身；除非用户明确要求全身或远景。
- 使用镜头语言取代形容词："85mm 人像镜头，f/1.8，焦点在双眼"，而非"精致五官"。
- 若涉及儿童，补充"真实的 N 岁儿童写真，不美化，不磨皮"。
- 群像（≥4 人）默认降级为环境化处理，并写明"面部不做焦点"，避免模糊妆容。

中文文字硬约束（当用户意图包含需在图中出现的文字时）：
- 将每段文字用「」包裹，紧随其后写"该文字必须一字不差呈现，不增减笔画、不替换字符、不使用变体写法"。
- 指定字体（黑体 / 宋体 / 楷体）。
- 指定字号相对画面高度的占比（≥ 6%）。
- 指定放置区域（画面的哪个象限或条带）。
- 单段文字不超过 12 字；更长文字拆分或留白供后期叠加。

摄影规范：
- 明确镜头焦段（35 / 50 / 85 mm 等）、光向（左上 45° 硬光、北窗柔光、阴天高调 等）、
  可选胶卷（Portra 400 温暖、Cinestill 800T 高光红晕 等）。

绘画/插画规范：
- 明确媒介（水粉、水彩、宣纸水墨、铜版、丝网 等）；
- 可点名一位艺术家以锚定风格，不堆砌。

仅输出一个版本。
```

Character budget increased 90–200 → 100–220 to accommodate the new framing and text directives.

---

## Section 6 — Implementation sequencing

### Phase 1 — this week (safe, high ROI)
1. Drop rewriter temperature to `0.5` (`prompt/route.ts:122`)
2. Replace `BASE_RULES` with the Section 5 rewrite
3. Remove `background: "transparent"` from the UI or gate it (transparency is broken on gpt-image-2)
4. Add portrait-keyword detection → auto-upgrade `quality` to `high` + `size` default to `1024x1536`

### Phase 2 — two weeks (medium effort)
5. Per-preset `{size, quality, style}` triples for the 70+ presets in `app/page.tsx:25-406`
6. "精修人像" button — two-pass face refinement workflow as a new `/api/refine-face` route
7. Add microcopy around size/quality controls to set user expectations

### Phase 3 — when justified (high effort)
8. Native SVG text-overlay pipeline (Sharp + Noto Sans CJK) for text-critical posters
9. OCR verify-and-retry loop for brand-name / legal copy
10. A/B test Chinese vs hybrid-English rewriter output on 50 intents, judge with GPT-4o

### Tracking — metrics worth wiring up
- % of portrait intents where face is detected >= 150 px tall in output
- % of quoted Chinese strings that OCR-match verbatim
- User-facing regeneration rate (proxy for dissatisfaction)
- Cost per "accepted" image (generations until user downloads)

---

## Open questions / tensions

1. **All-Chinese vs hybrid-English output** — research tilts toward hybrid, but culturally Chinese aesthetic work (水墨, 工笔) may be an exception. Needs A/B.
2. **`input_fidelity="high"` on edits** — currently exposed in UI but no usage guidance. Research suggests always-on for identity-preserving edits; worth making it default-true for the 精修人像 path.
3. **Preset scope creep** — 70+ presets with inline full prompts ≠ maintainable. Consider treating presets as `{intent, suggested_style, suggested_size, suggested_quality}` and letting the rewriter do the heavy lifting uniformly, rather than hand-authoring each preset prompt.
4. **Edit-mode prompting has no `BASE_RULES` equivalent.** `/api/edit/route.ts` forwards the user's raw edit instruction. We need a `EDIT_BASE_RULES` that enforces the Preserve/Change block pattern from the OpenAI cookbook.

---

## Appendix — phrases verified as slop (add to prohibition list)

Confirmed across all four research streams:

- `stunning / epic / incredible / masterpiece` → no rendering delta
- `ultra realistic / hyperrealistic / 8K / 4K / HD` → no rendering delta (use film stock / lens / material instead)
- `best quality / extremely detailed / ultra-detailed` → no rendering delta
- `beautiful face / perfect symmetrical face / stunning portrait` → pattern-matched to generic output, may trigger uncanny valley smoothing
- `high quality` (as prompt text) → redundant with `quality=` API param
- 中文对应：`令人惊艳、大师级、顶级、超清、精美、细节丰富、专业级、完美对称` (current rules catch most; add `细节丰富、专业级、完美对称`)

---

## Appendix — key sources

- OpenAI Cookbook: GPT image-gen prompting guide — https://developers.openai.com/cookbook/examples/multimodal/image-gen-models-prompting-guide
- OpenAI Docs: Create Image reference — https://developers.openai.com/api/reference/resources/images/methods/generate
- fal.ai: gpt-image-2 prompting guide — https://fal.ai/learn/tools/prompting-gpt-image-2
- OpenAI Community: `/images/edits` mask doesn't inpaint — https://community.openai.com/t/image-editing-inpainting-with-a-mask-for-gpt-image-1-replaces-the-entire-image/1244275
- Atlabs AI: CJK verbatim constraint pattern — https://www.atlabs.ai/blog/the-ultimate-gpt-image-2-prompting-guide-how-to-use-openai%E2%80%99s-best-image-model-2026
- PixelDojo: artifact-declaration + invariants pattern — https://pixeldojo.ai/guides/gpt-image-2-prompting-guide
- MIT Sloan / HBR Dec 2025: cross-language LLM behavior — https://hbr.org/2025/12/how-two-leading-llms-reasoned-differently-in-english-and-chinese
