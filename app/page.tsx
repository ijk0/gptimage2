"use client";

import { useEffect, useState } from "react";

type Status = "idle" | "loading" | "error";

type Quota = { limit: number; used: number; remaining: number };

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

const ROMAN = ["I", "II", "III", "IV"];

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

  useEffect(() => {
    setStamp(todayStamp());
    fetch("/api/generate")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Quota | null) => {
        if (d) setQuota(d);
      })
      .catch(() => {});
  }, []);

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
                  {ROMAN[i] ?? String(i + 1)}
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
                      Plate {ROMAN[i] ?? i + 1}
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
                      Plate {ROMAN[i] ?? i + 1}
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
