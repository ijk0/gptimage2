"use client";

import { useEffect, useRef, useState } from "react";

type Status = "idle" | "loading" | "error";
type Quota = { limit: number; used: number; remaining: number; grant?: number };
type RechargeState = "idle" | "submitting" | "ok" | "error";
type MuseState = "idle" | "generating" | "error";

const STYLES: { value: string; label: string }[] = [
  { value: "", label: "无" },
  { value: "水墨", label: "水墨" },
  { value: "东方", label: "东方" },
  { value: "极简", label: "极简" },
  { value: "电影", label: "电影" },
  { value: "时尚", label: "时尚" },
  { value: "童话", label: "童话" },
  { value: "赛博", label: "赛博" },
  { value: "科幻", label: "科幻" },
  { value: "蒸汽", label: "蒸汽" },
];

const SIZES = [
  { value: "auto", label: "自动", ratio: "1 / 1" },
  { value: "1024x1024", label: "方 · 1024", ratio: "1 / 1" },
  { value: "1536x1024", label: "横 · 1536", ratio: "3 / 2" },
  { value: "1024x1536", label: "竖 · 1536", ratio: "2 / 3" },
  { value: "2048x2048", label: "方 · 2048", ratio: "1 / 1" },
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
  const [intent, setIntent] = useState("");
  const [style, setStyle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [promptOrigin, setPromptOrigin] = useState<"hand" | "muse" | "">("");
  const [promptFresh, setPromptFresh] = useState(false);

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
  const [museError, setMuseError] = useState<string | null>(null);

  const promptRef = useRef<HTMLTextAreaElement>(null);

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
    if (museState === "generating" || !intent.trim()) return;
    setMuseState("generating");
    setMuseError(null);
    try {
      const res = await fetch("/api/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: intent.trim(), style }),
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
        setPromptOrigin("muse");
        setPromptFresh(true);
        window.setTimeout(() => setPromptFresh(false), 1400);
        promptRef.current?.focus({ preventScroll: true });
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
  const selectedSize = SIZES.find((s) => s.value === size) ?? SIZES[0];
  const plateRatio =
    selectedSize.value === "auto" ? "1 / 1" : selectedSize.ratio;

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

  const styleObj = STYLES.find((s) => s.value === style);
  const styleLabel = styleObj?.label ?? "无";
  const promptOriginLabel =
    promptOrigin === "muse"
      ? `来自 · MUSE（${styleLabel}）`
      : prompt
        ? "手写 · HAND"
        : "";

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

      <form onSubmit={onSubmit}>
        <section className="sec">
          <div className="sec-head">
            <span className="sec-title">创作工坊</span>
            <span className="sec-no">— BRIEF</span>
          </div>

          <div className="workbench">
            <div className="intent-col">
              <div className="intent-field">
                <span className="micro-label">立意 · What do you want</span>
                <input
                  type="text"
                  className="intent-input"
                  value={intent}
                  onChange={(e) => setIntent(e.target.value)}
                  placeholder="一句话，例：一只戴围巾的柴犬坐在月球上"
                  maxLength={120}
                />
                <span className="intent-hint">
                  先写下你想看到的画面，再挑一个风格，MUSE 会替你写详细提示词。
                </span>
              </div>

              <div className="styles">
                <span className="micro-label">风格 · Style · Optional</span>
                <div className="style-row" role="radiogroup" aria-label="风格">
                  {STYLES.map((s) => (
                    <button
                      key={s.value || "none"}
                      type="button"
                      role="radio"
                      aria-checked={style === s.value}
                      className={`style-chip${style === s.value ? " is-on" : ""}${s.value === "" ? " style-chip-none" : ""}`}
                      onClick={() => setStyle(s.value)}
                      disabled={museState === "generating"}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                className="muse-action"
                onClick={onMuse}
                disabled={museState === "generating" || !intent.trim()}
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
                    <span className="muse-model">gpt-5.4</span>
                  </>
                )}
              </button>

              {museError && museState === "error" && (
                <div className="muse-error" role="alert">
                  {museError}
                </div>
              )}
            </div>

            <div className="prompt-col">
              <div className="prompt-head">
                <span className="micro-label">提示词 · Prompt</span>
                <span className="prompt-origin">
                  {promptOriginLabel && (
                    <span
                      className={promptOrigin === "muse" ? "cinnabar" : ""}
                    >
                      {promptOriginLabel}
                    </span>
                  )}
                </span>
              </div>
              <textarea
                ref={promptRef}
                className={`prompt-area${promptFresh ? " is-fresh" : ""}`}
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  if (promptOrigin !== "hand") setPromptOrigin("hand");
                }}
                placeholder="详细提示词将出现在这里，或你也可以直接在此落笔。"
              />
              <div className="prompt-foot">
                <span>{prompt.length} 字</span>
                <button
                  type="button"
                  className="clear-btn"
                  onClick={() => {
                    setPrompt("");
                    setPromptOrigin("");
                  }}
                  disabled={!prompt}
                >
                  清空
                </button>
              </div>
            </div>
          </div>
        </section>

        <div className="commit-row">
          <div className="params-strip" aria-label="生成参数">
            <label className="param-inline">
              <span className="micro-label">尺寸</span>
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
            </label>
            <label className="param-inline">
              <span className="micro-label">质量</span>
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
            </label>
            <label className="param-inline">
              <span className="micro-label">格式</span>
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
            </label>
            <label className="param-inline">
              <span className="micro-label">张数</span>
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
            </label>
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
        </div>

        <div className="side-notes">
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
                  {quotaExhausted ? "输入兑换码继续 →" : "有兑换码？"}
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
        </div>
      </form>

      <section className="sec gallery-sec" aria-live="polite">
        <div className="sec-head">
          <span className="sec-title">版面</span>
          <span className="gallery-meta">
            {status === "loading"
              ? `制版中 · 共 ${effectiveN} 版`
              : images.length > 0
                ? `Plates · ${images.length} 版`
                : "Plates"}
          </span>
        </div>

        {status === "loading" ? (
          <div
            className="plates"
            style={{ ["--ratio" as string]: plateRatio }}
          >
            {Array.from({ length: effectiveN }).map((_, i) => (
              <div key={i} className="plate">
                <div
                  className="skeleton-plate"
                  style={{ ["--ratio" as string]: plateRatio }}
                />
                <div className="plate-caption">
                  <span className="plate-numeral">Plate {toRoman(i + 1)}</span>
                  <span>制版中…</span>
                </div>
              </div>
            ))}
          </div>
        ) : images.length > 0 ? (
          <div
            className="plates"
            style={{ ["--ratio" as string]: plateRatio }}
          >
            {images.map((src, i) => (
              <figure key={i} className="plate">
                <div
                  className="plate-frame"
                  style={{ ["--ratio" as string]: plateRatio }}
                >
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
                  <span className="plate-numeral">Plate {toRoman(i + 1)}</span>
                  <span>
                    {size === "auto" ? "AUTO" : size} · {format.toUpperCase()}
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <p className="empty-line">
            尚无版面 —— 写下立意、按下落印，此处将呈现你的第一张图。
          </p>
        )}
      </section>

      <footer className="colophon">
        <span>
          印于 Vercel · Set in Source Serif 4, Noto Serif SC &amp; Archivo
        </span>
        <span className="colophon-seal">朱砂 · No. {quota.used}</span>
      </footer>
    </main>
  );
}
