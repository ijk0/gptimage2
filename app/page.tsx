"use client";

import { useState } from "react";

type Status = "idle" | "loading" | "error";

const DEFAULT_PROMPT =
  "极简主义水墨山水画，远山云雾缭绕，一叶扁舟漂于湖面，留白充足，淡雅写意，柔和的东方美学";

const PROMPT_PRESETS: { label: string; text: string }[] = [
  {
    label: "赛博朋克夜景",
    text: "赛博朋克风格的雨夜街景，霓虹灯倒映在湿漉漉的街道上，远处高耸的摩天大楼与全息广告，电影级光影",
  },
  {
    label: "童话插画",
    text: "一只穿着宇航服的柴犬站在月球上仰望地球，温暖的童话书插画风格，柔和的水彩质感",
  },
  {
    label: "极简产品图",
    text: "极简主义产品摄影：一只陶瓷咖啡杯置于米色背景上，柔和的侧光，干净的阴影，杂志封面感",
  },
  {
    label: "蒸汽朋克机械",
    text: "蒸汽朋克风格的机械怀表剖面图，黄铜齿轮与红色宝石，昏黄灯光，复古工业质感",
  },
];

const SIZES = [
  { value: "auto", label: "自动（推荐）" },
  { value: "1024x1024", label: "方形 · 1024 × 1024" },
  { value: "1536x1024", label: "横版 · 1536 × 1024" },
  { value: "1024x1536", label: "竖版 · 1024 × 1536" },
  { value: "2048x2048", label: "高清方形 · 2048 × 2048" },
];

const QUALITIES = [
  { value: "auto", label: "自动" },
  { value: "low", label: "低（最快）" },
  { value: "medium", label: "中" },
  { value: "high", label: "高（最佳）" },
];

const FORMATS = [
  { value: "png", label: "PNG" },
  { value: "jpeg", label: "JPEG" },
  { value: "webp", label: "WebP" },
];

export default function Home() {
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [size, setSize] = useState("auto");
  const [quality, setQuality] = useState("auto");
  const [format, setFormat] = useState("png");
  const [n, setN] = useState(1);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);

  const disabled = status === "loading" || !prompt.trim();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;
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
      setStatus("idle");
    } catch (err) {
      setError((err as Error).message);
      setStatus("error");
    }
  }

  function applyPreset(text: string) {
    setPrompt(text);
  }

  return (
    <main className="shell">
      <header className="header">
        <div className="brand">
          <div className="brand-mark" aria-hidden>
            ✦
          </div>
          <div>
            <h1 className="title">gpt-image-2 图像生成器</h1>
            <p className="subtitle">用一句话，生成一张你想要的图。</p>
          </div>
        </div>
        <span className="badge">Powered by Vercel · gpt-image-2</span>
      </header>

      <div className="grid">
        <form className="panel form-stack" onSubmit={onSubmit}>
          <h2>创作参数</h2>

          <div className="prompt-wrap">
            <label className="field-label" htmlFor="prompt">
              提示词
            </label>
            <textarea
              id="prompt"
              className="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="描述你想要的画面，越具体效果越好…"
            />
            <div className="prompt-tools">
              <span>{prompt.length} 字</span>
              <button
                type="button"
                className="chip"
                onClick={() => setPrompt("")}
                disabled={!prompt}
                style={{ opacity: prompt ? 1 : 0.5 }}
              >
                清空
              </button>
            </div>
          </div>

          <div>
            <div className="field-label" style={{ marginBottom: 8 }}>
              灵感预设
            </div>
            <div className="chips">
              {PROMPT_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className="chip"
                  onClick={() => applyPreset(p.text)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="field-row">
            <label className="field">
              <span className="field-label">尺寸</span>
              <select
                className="select"
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

            <label className="field">
              <span className="field-label">质量</span>
              <select
                className="select"
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
          </div>

          <div className="field-row">
            <label className="field">
              <span className="field-label">格式</span>
              <select
                className="select"
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

            <label className="field">
              <span className="field-label">张数</span>
              <select
                className="select"
                value={n}
                onChange={(e) => setN(Number(e.target.value))}
              >
                {[1, 2, 3, 4].map((v) => (
                  <option key={v} value={v}>
                    {v} 张
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button
            type="submit"
            className="button-primary"
            disabled={disabled}
          >
            {status === "loading" ? (
              <>
                <span className="spinner" aria-hidden />
                正在生成…
              </>
            ) : (
              "开始生成"
            )}
          </button>

          {error && <div className="error">{error}</div>}
        </form>

        <section className="panel output" aria-live="polite">
          <div className="output-head">
            <h2 style={{ margin: 0 }}>生成结果</h2>
            {images.length > 0 && (
              <span className="badge">{images.length} 张</span>
            )}
          </div>

          {status === "loading" ? (
            <div className="gallery">
              {Array.from({ length: n }).map((_, i) => (
                <div key={i} className="skeleton" />
              ))}
            </div>
          ) : images.length > 0 ? (
            <div className="gallery">
              {images.map((src, i) => (
                <figure key={i} className="card">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`生成结果 ${i + 1}`} />
                  <figcaption className="card-overlay">
                    <span style={{ color: "#fff", fontSize: 12 }}>
                      #{i + 1}
                    </span>
                    <a
                      className="card-action"
                      href={src}
                      download={`gpt-image-2-${Date.now()}-${i + 1}.${format}`}
                    >
                      下载
                    </a>
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <div className="empty">
              <div className="empty-icon" aria-hidden>
                ✦
              </div>
              <div style={{ fontSize: 14 }}>
                输入提示词，点击"开始生成"查看结果
              </div>
              <div style={{ fontSize: 12 }}>
                建议尝试左侧的灵感预设作为起点
              </div>
            </div>
          )}
        </section>
      </div>

    </main>
  );
}
