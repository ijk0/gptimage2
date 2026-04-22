"use client";

import { useState } from "react";

type Status = "idle" | "loading" | "error";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState("1024x1024");
  const [quality, setQuality] = useState("auto");
  const [n, setN] = useState(1);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, size, quality, n }),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail =
          typeof data?.details === "string"
            ? data.details
            : data?.details
              ? JSON.stringify(data.details)
              : "";
        throw new Error(data?.error ? `${data.error}${detail ? `: ${detail}` : ""}` : "Request failed");
      }
      setImages(data.images ?? []);
      setStatus("idle");
    } catch (err) {
      setError((err as Error).message);
      setStatus("error");
    }
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px" }}>
      <header style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5 }}>
          gpt-image-2 generator
        </h1>
        <p style={{ color: "#a1a1aa", marginTop: 6, fontSize: 14 }}>
          Powered by your configured gpt-image-2 endpoint on Vercel.
        </p>
      </header>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the image you want to generate…"
          rows={4}
          style={{
            background: "#111113",
            border: "1px solid #27272a",
            borderRadius: 10,
            padding: 14,
            resize: "vertical",
            outline: "none",
          }}
        />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          <label style={fieldLabel}>
            <span style={labelText}>Size</span>
            <select value={size} onChange={(e) => setSize(e.target.value)} style={fieldInput}>
              <option value="1024x1024">1024 × 1024</option>
              <option value="1024x1536">1024 × 1536</option>
              <option value="1536x1024">1536 × 1024</option>
              <option value="auto">Auto</option>
            </select>
          </label>

          <label style={fieldLabel}>
            <span style={labelText}>Quality</span>
            <select value={quality} onChange={(e) => setQuality(e.target.value)} style={fieldInput}>
              <option value="auto">Auto</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>

          <label style={fieldLabel}>
            <span style={labelText}>Count</span>
            <select
              value={n}
              onChange={(e) => setN(Number(e.target.value))}
              style={fieldInput}
            >
              {[1, 2, 3, 4].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          type="submit"
          disabled={status === "loading" || !prompt.trim()}
          style={{
            marginTop: 4,
            background: status === "loading" ? "#3f3f46" : "#f5f5f5",
            color: status === "loading" ? "#a1a1aa" : "#0a0a0a",
            border: "none",
            borderRadius: 10,
            padding: "12px 16px",
            fontWeight: 600,
            opacity: !prompt.trim() ? 0.5 : 1,
          }}
        >
          {status === "loading" ? "Generating…" : "Generate"}
        </button>
      </form>

      {error && (
        <div
          style={{
            marginTop: 20,
            padding: 12,
            border: "1px solid #7f1d1d",
            background: "#2a0d0d",
            borderRadius: 10,
            color: "#fca5a5",
            fontSize: 13,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {error}
        </div>
      )}

      {images.length > 0 && (
        <section
          style={{
            marginTop: 28,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 12,
          }}
        >
          {images.map((src, i) => (
            <a
              key={i}
              href={src}
              download={`gpt-image-2-${Date.now()}-${i}.png`}
              style={{
                display: "block",
                border: "1px solid #27272a",
                borderRadius: 10,
                overflow: "hidden",
                background: "#111113",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Generated ${i + 1}`} style={{ width: "100%", display: "block" }} />
            </a>
          ))}
        </section>
      )}
    </main>
  );
}

const fieldLabel: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

const labelText: React.CSSProperties = {
  fontSize: 12,
  color: "#a1a1aa",
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const fieldInput: React.CSSProperties = {
  background: "#111113",
  border: "1px solid #27272a",
  borderRadius: 10,
  padding: "10px 12px",
  outline: "none",
};
