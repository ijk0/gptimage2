"use client";

import { useEffect, useState } from "react";

type Status = "idle" | "loading" | "error";

type Quota = { limit: number; used: number; remaining: number; grant?: number };

type RechargeState = "idle" | "submitting" | "ok" | "error";

type MuseState = "idle" | "generating" | "error";

const SCENARIOS: { label: string; seed: string }[] = [
  { label: "风景", seed: "一处令人驻足的自然风景" },
  { label: "人像", seed: "一张富有故事感的人物肖像" },
  { label: "静物", seed: "一组富有诗意的静物组合" },
  { label: "建筑", seed: "一处富有个性的建筑空间" },
  { label: "抽象", seed: "一幅充满张力的抽象构图" },
  { label: "科幻", seed: "一个未来感十足的科幻场景" },
  { label: "童话", seed: "一个温柔奇妙的童话场景" },
  { label: "电影", seed: "一帧极具氛围的电影剧照" },
  { label: "时尚", seed: "一张高级时装大片" },
  { label: "东方", seed: "一幅带有东方美学意蕴的画面" },
];

const DEFAULT_PROMPT =
  "极简主义水墨山水画，远山云雾缭绕，一叶扁舟漂于湖面，留白充足，淡雅写意，柔和的东方美学";

const PROMPT_PRESETS: { label: string; text: string }[] = [
  {
    label: "水墨山水",
    text: "极简主义水墨山水画，远山云雾缭绕，一叶扁舟漂于湖面，留白充足，淡雅写意，柔和的东方美学",
  },
  {
    label: "赛博雨夜",
    text: "赛博朋克风格的雨夜街景，霓虹灯倒映在湿漉漉的街道上，远处高耸的摩天大楼与全息广告，电影级光影",
  },
  {
    label: "童话月球",
    text: "一只穿着宇航服的柴犬站在月球上仰望地球，温暖的童话书插画风格，柔和的水彩质感",
  },
  {
    label: "极简静物",
    text: "极简主义产品摄影：一只陶瓷咖啡杯置于米色背景上，柔和的侧光，干净的阴影，杂志封面般的留白",
  },
  {
    label: "蒸汽机械",
    text: "蒸汽朋克风格的机械怀表剖面图，黄铜齿轮与红色宝石，昏黄灯光，复古工业质感",
  },
];

const SIZES = [
  { value: "auto", label: "自动" },
  { value: "1024x1024", label: "方 · 1024" },
  { value: "1536x1024", label: "横 · 1536" },
  { value: "1024x1536", label: "竖 · 1536" },
  { value: "2048x2048", label: "方 · 2048" },
];

const QUALITIES = [
  { value: "auto", label: "自动" },
  { value: "low", label: "草稿" },
  { value: "medium", label: "标准" },
  { value: "high", label: "精制" },
];

const FORMATS = [
  { value: "png", label: "PNG" },
  { value: "jpeg", label: "JPEG" },
  { value: "webp", label: "WEBP" },
];

const COUNTS = [1, 2, 3, 4];

function toRoman(num: number): string {
  if (num <= 0 || num > 3999) return String(num);
  const values: [number, string][] = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let out = "";
  let n = num;
  for (const [v, s] of values) {
    while (n >= v) {
      out += s;
      n -= v;
    }
  }
  return out;
}

function todayStamp(): string {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}·${mm}·${dd}`;
}

export default function Home() {
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [size, setSize] = useState("auto");
  const [quality, setQuality] = useState("auto");
  const [format, setFormat] = useState("png");
  const [n, setN] = useState(1);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [quota, setQuota] = useState<Quota>({
    limit: 5,
    used: 0,
    remaining: 5,
  });
  const [stamp, setStamp] = useState("");
  const [rechargeEnabled, setRechargeEnabled] = useState(false);
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [rechargeCode, setRechargeCode] = useState("");
  const [rechargeState, setRechargeState] = useState<RechargeState>("idle");
  const [rechargeMsg, setRechargeMsg] = useState<string | null>(null);
  const [museState, setMuseState] = useState<MuseState>("idle");
  const [museScenario, setMuseScenario] = useState<string>(SCENARIOS[0].label);
  const [museError, setMuseError] = useState<string | null>(null);

  useEffect(() => {
    setStamp(todayStamp());
    fetch("/api/generate")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Quota | null) => {
        if (d) setQuota(d);
      })
      .catch(() => {});
    fetch("/api/recharge")
      .then((r) => r.json())
      .then((d: { enabled: boolean }) => setRechargeEnabled(!!d.enabled))
      .catch(() => {});
  }, []);

  async function onMuse() {
    if (museState === "generating") return;
    const scenario = SCENARIOS.find((s) => s.label === museScenario);
    if (!scenario) return;
    setMuseState("generating");
    setMuseError(null);
    try {
      const res = await fetch("/api/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: scenario.seed }),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail =
          typeof data?.details === "string"
            ? data.details
            : data?.details
              ? JSON.stringify(data.details)
              : "";
        throw new Error(
          data?.error ? `${data.error}${detail ? `：${detail}` : ""}` : "生成失败",
        );
      }
      if (typeof data.prompt === "string" && data.prompt.trim()) {
        setPrompt(data.prompt.trim());
      }
      setMuseState("idle");
    } catch (err) {
      setMuseError((err as Error).message);
      setMuseState("error");
    }
  }

  async function onRecharge(e: React.FormEvent) {
    e.preventDefault();
    if (!rechargeCode.trim() || rechargeState === "submitting") return;
    setRechargeState("submitting");
    setRechargeMsg(null);
    try {
      const res = await fetch("/api/recharge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: rechargeCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "兑换失败");
      setQuota({
        limit: data.limit,
        used: data.used,
        remaining: data.remaining,
        grant: data.grant,
      });
      setRechargeState("ok");
      setRechargeMsg(`兑换成功，次数 +${data.added}`);
      setRechargeCode("");
      if (error) setError(null);
    } catch (err) {
      setRechargeState("error");
      setRechargeMsg((err as Error).message);
    }
  }

  const quotaExhausted = quota.remaining <= 0;
  const disabled = status === "loading" || !prompt.trim() || quotaExhausted;
  const effectiveN = Math.min(n, Math.max(quota.remaining, 1));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled) return;
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          size,
          quality,
          n,
          output_format: format,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429 && typeof data?.limit === "number") {
          setQuota({
            limit: data.limit,
            used: data.used ?? data.limit,
            remaining: 0,
          });
        }
        const detail =
          typeof data?.details === "string"
            ? data.details
            : data?.details
              ? JSON.stringify(data.details)
              : "";
        throw new Error(
          data?.error ? `${data.error}${detail ? `：${detail}` : ""}` : "请求失败",
        );
      }
      setImages(data.images ?? []);
      if (typeof data.limit === "number") {
        setQuota({
          limit: data.limit,
          used: data.used,
          remaining: data.remaining,
        });
      }
      setStatus("idle");
    } catch (err) {
      setError((err as Error).message);
      setStatus("error");
    }
  }

  return (
    <main className="shell">
      <header className="masthead">
        <div className="seal" aria-hidden>
          印
        </div>
        <div className="mast-title">
          <h1>图像生成所 · gpt-image-2</h1>
          <span className="mast-sub">A typographic console for gpt-image-2</span>
        </div>
        <div className="mast-meta">
          <span>No. 0001 · {stamp}</span>
          <span>
            免费额度 <span className="cinnabar">{quota.remaining}</span> /{" "}
            {quota.limit}
          </span>
        </div>
      </header>

      <div className="stage">
        <form className="spec" onSubmit={onSubmit}>
          <div className="spec-heading">
            <span className="spec-heading-title">创作工单</span>
            <span className="spec-heading-no">Section I · Brief</span>
          </div>

          <div className="muse">
            <div className="muse-head">
              <span className="muse-label">AI 构思 · Muse</span>
              <span className="muse-model">gpt-5.4</span>
            </div>
            <div className="muse-chips" role="radiogroup" aria-label="主题">
              {SCENARIOS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  role="radio"
                  aria-checked={museScenario === s.label}
                  className={`muse-chip${museScenario === s.label ? " is-on" : ""}`}
                  onClick={() => setMuseScenario(s.label)}
                  disabled={museState === "generating"}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="muse-action"
              onClick={onMuse}
              disabled={museState === "generating"}
            >
              {museState === "generating" ? (
                <>
                  <span className="spinner" aria-hidden />
                  思考中…
                </>
              ) : (
                <>
                  <span aria-hidden>▸</span>
                  <span>生成提示词</span>
                </>
              )}
            </button>
            {museError && museState === "error" && (
              <div className="muse-error" role="alert">
                {museError}
              </div>
            )}
          </div>

          <div className="prompt-block">
            <span className="prompt-label">Prompt · 提示词</span>
            <textarea
              className="prompt-area"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="在此写下你想让它生成的画面…"
            />
            <div className="prompt-footer">
              <span>{prompt.length} 字</span>
              <button
                type="button"
                className="clear-btn"
                onClick={() => setPrompt("")}
                disabled={!prompt}
              >
                清空
              </button>
            </div>
          </div>

          <div className="presets">
            <div className="presets-head">灵感选集 · Presets</div>
            {PROMPT_PRESETS.map((p, i) => (
              <button
                key={p.label}
                type="button"
                className="preset-row"
                onClick={() => setPrompt(p.text)}
              >
                <span className="preset-numeral">
                  {toRoman(i + 1)}
                </span>
                <span className="preset-name">{p.label}</span>
                <span className="preset-arrow" aria-hidden>
                  →
                </span>
              </button>
            ))}
          </div>

          <div className="param-table" role="group" aria-label="参数">
            <div className="param-row">
              <span className="param-key">尺寸</span>
              <select
                className="param-select"
                value={size}
                onChange={(e) => setSize(e.target.value)}
              >
                {SIZES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="param-row">
              <span className="param-key">质量</span>
              <select
                className="param-select"
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
              >
                {QUALITIES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="param-row">
              <span className="param-key">格式</span>
              <select
                className="param-select"
                value={format}
                onChange={(e) => setFormat(e.target.value)}
              >
                {FORMATS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="param-row">
              <span className="param-key">张数</span>
              <select
                className="param-select"
                value={n}
                onChange={(e) => setN(Number(e.target.value))}
              >
                {COUNTS.map((v) => (
                  <option key={v} value={v}>
                    {v} 张
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button type="submit" className="press" disabled={disabled}>
            {status === "loading" ? (
              <>
                <span className="spinner" aria-hidden />
                制版中
              </>
            ) : quotaExhausted ? (
              "额度用尽"
            ) : (
              <>
                <span>落 印</span>
                <span className="press-dash">·</span>
                <span>生成图像</span>
              </>
            )}
          </button>

          {error && (
            <div
              className={`error${quotaExhausted ? " quota-exhausted" : ""}`}
              role="alert"
            >
              {error}
            </div>
          )}

          {rechargeEnabled && (
            <div className="recharge">
              {!rechargeOpen ? (
                <button
                  type="button"
                  className="recharge-toggle"
                  onClick={() => setRechargeOpen(true)}
                >
                  {quotaExhausted
                    ? "输入兑换码继续 →"
                    : "有兑换码？"}
                </button>
              ) : (
                <form className="recharge-form" onSubmit={onRecharge}>
                  <div className="recharge-head">
                    <span className="recharge-title">兑换次数 · Redeem</span>
                    <button
                      type="button"
                      className="recharge-close"
                      onClick={() => {
                        setRechargeOpen(false);
                        setRechargeMsg(null);
                      }}
                      aria-label="关闭"
                    >
                      ×
                    </button>
                  </div>
                  <div className="recharge-row">
                    <input
                      type="text"
                      className="recharge-input"
                      value={rechargeCode}
                      onChange={(e) => setRechargeCode(e.target.value)}
                      placeholder="WELCOME / FRIEND …"
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <button
                      type="submit"
                      className="recharge-submit"
                      disabled={
                        !rechargeCode.trim() || rechargeState === "submitting"
                      }
                    >
                      {rechargeState === "submitting" ? "兑换中" : "兑换"}
                    </button>
                  </div>
                  {rechargeMsg && (
                    <div
                      className={`recharge-msg recharge-msg-${
                        rechargeState === "ok" ? "ok" : "err"
                      }`}
                    >
                      {rechargeMsg}
                    </div>
                  )}
                </form>
              )}
            </div>
          )}
        </form>

        <section className="gallery-col" aria-live="polite">
          <div className="gallery-head">
            <span className="gallery-title">版面 · Plates</span>
            <span className="gallery-meta">
              {status === "loading"
                ? `制版中 · 共 ${effectiveN} 版`
                : images.length > 0
                  ? `共 ${images.length} 版`
                  : "等待落印"}
            </span>
          </div>

          {status === "loading" ? (
            <div className="plates">
              {Array.from({ length: effectiveN }).map((_, i) => (
                <div key={i} className="plate">
                  <div className="skeleton-plate" />
                  <div className="plate-caption">
                    <span className="plate-numeral">
                      Plate {toRoman(i + 1)}
                    </span>
                    <span>制版中…</span>
                  </div>
                </div>
              ))}
            </div>
          ) : images.length > 0 ? (
            <div className="plates">
              {images.map((src, i) => (
                <figure key={i} className="plate">
                  <div className="plate-frame">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`生成结果 ${i + 1}`} />
                    <div className="plate-overlay">
                      <a
                        className="plate-download"
                        href={src}
                        download={`gpt-image-2-${Date.now()}-${i + 1}.${format}`}
                      >
                        下载 · Download
                      </a>
                    </div>
                  </div>
                  <figcaption className="plate-caption">
                    <span className="plate-numeral">
                      Plate {toRoman(i + 1)}
                    </span>
                    <span>
                      {size === "auto" ? "AUTO" : size} · {format.toUpperCase()}
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <div className="empty">
              <div className="empty-mark" aria-hidden>
                ¶
              </div>
              <div className="empty-title">此处尚无版面</div>
              <div className="empty-hint">
                填写工单，按下「落印」以生成第一张图
              </div>
            </div>
          )}
        </section>
      </div>

      <footer className="colophon">
        <span>
          印于 Vercel · Set in Source Serif 4, Noto Serif SC &amp; Archivo
        </span>
        <span className="colophon-seal">朱砂 · No. {quota.used}</span>
      </footer>
    </main>
  );
}
