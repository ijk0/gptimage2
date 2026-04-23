"use client";

import { useEffect, useRef, useState } from "react";

// A browser-side text overlay baker. Users enter Chinese text that gpt-image-2
// couldn't render correctly (or didn't render at all because we asked it to
// leave room), pick a font/size/color/position, and the component composes
// the text directly onto the pixel buffer via Canvas. Because we rasterize in
// the browser, we get 100% CJK fidelity using whichever CJK font the
// browser has loaded (Noto Sans/Serif SC are preloaded by app/layout.tsx;
// system fallbacks cover PingFang/Songti/Kaiti on macOS & Windows).

type FontKey = "heiti" | "songti" | "kaiti";
type ColorKey = "black" | "white" | "cinnabar";
type Position =
  | "tl"
  | "tc"
  | "tr"
  | "ml"
  | "c"
  | "mr"
  | "bl"
  | "bc"
  | "br";

const FONT_STACKS: Record<FontKey, { label: string; stack: string }> = {
  heiti: {
    label: "黑体",
    stack:
      "'Noto Sans SC', 'PingFang SC', 'Heiti SC', 'Microsoft YaHei', sans-serif",
  },
  songti: {
    label: "宋体",
    stack: "'Noto Serif SC', 'Songti SC', 'SimSun', serif",
  },
  kaiti: {
    label: "楷体",
    stack: "'STKaiti', 'Kaiti SC', 'KaiTi', 'BiauKai', cursive",
  },
};

const COLORS: Record<ColorKey, { label: string; hex: string }> = {
  black: { label: "墨色", hex: "#0f0f10" },
  white: { label: "素白", hex: "#fafaf7" },
  cinnabar: { label: "朱砂", hex: "#c94a3a" },
};

const SIZE_PRESETS: { label: string; pct: number }[] = [
  { label: "小", pct: 4 },
  { label: "中", pct: 6 },
  { label: "大", pct: 9 },
  { label: "巨", pct: 14 },
];

const POSITIONS: { key: Position; label: string }[] = [
  { key: "tl", label: "↖" },
  { key: "tc", label: "↑" },
  { key: "tr", label: "↗" },
  { key: "ml", label: "←" },
  { key: "c", label: "●" },
  { key: "mr", label: "→" },
  { key: "bl", label: "↙" },
  { key: "bc", label: "↓" },
  { key: "br", label: "↘" },
];

function positionToDrawSpec(
  pos: Position,
  canvasW: number,
  canvasH: number,
  fontSize: number,
): { x: number; y: number; align: CanvasTextAlign; baseline: CanvasTextBaseline } {
  // Margin scales with canvas so text doesn't crash into the edge on big
  // canvases. 4% of the shorter edge.
  const margin = Math.min(canvasW, canvasH) * 0.04;
  // Baseline/align are the important pieces — they let us anchor from the
  // actual text box edge, not guess about ascender height.
  const col = pos[pos.length - 1]; // last char: l/c/r
  const row = pos[0]; // first char: t/m/b/c
  let x: number;
  let align: CanvasTextAlign;
  if (col === "l") {
    x = margin;
    align = "left";
  } else if (col === "r") {
    x = canvasW - margin;
    align = "right";
  } else {
    x = canvasW / 2;
    align = "center";
  }
  let y: number;
  let baseline: CanvasTextBaseline;
  if (row === "t") {
    y = margin;
    baseline = "top";
  } else if (row === "b") {
    y = canvasH - margin;
    baseline = "bottom";
  } else {
    y = canvasH / 2;
    baseline = "middle";
  }
  // Special case: pos="c" → center. Above code already puts it there.
  void fontSize;
  return { x, y, align, baseline };
}

export function TextOverlay({
  image,
  onApply,
  onClose,
}: {
  image: string;
  onApply: (dataUrl: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [font, setFont] = useState<FontKey>("heiti");
  const [sizePct, setSizePct] = useState<number>(6);
  const [color, setColor] = useState<ColorKey>("black");
  const [position, setPosition] = useState<Position>("bc");
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // Load the source image once. crossOrigin="anonymous" lets us read pixels
  // back from remote URLs without a tainted-canvas error; data URLs are
  // unaffected. If a remote URL's server doesn't set permissive CORS headers
  // the load fires `onerror` — surface that explicitly so the user isn't
  // left wondering.
  useEffect(() => {
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => {
      setImgEl(el);
      setLoadError(null);
    };
    el.onerror = () => {
      const isRemote = !image.startsWith("data:");
      setLoadError(
        isRemote
          ? "原图跨域（上游未开放 CORS）。请先下载本地图片再打开「加文字」。"
          : "原图加载失败。",
      );
    };
    el.src = image;
  }, [image]);

  // Redraw preview whenever any control or the loaded image changes.
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !imgEl) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Preview at CSS size to keep the modal light; the actual bake uses the
    // full natural resolution.
    const maxPreview = 480;
    const natW = imgEl.naturalWidth || imgEl.width;
    const natH = imgEl.naturalHeight || imgEl.height;
    const scale = Math.min(1, maxPreview / Math.max(natW, natH));
    const w = Math.round(natW * scale);
    const h = Math.round(natH * scale);
    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(imgEl, 0, 0, w, h);

    if (!text.trim()) return;
    drawText(ctx, w, h, text, font, sizePct, color, position);
  }, [imgEl, text, font, sizePct, color, position]);

  async function handleApply() {
    if (!imgEl || !text.trim()) return;
    // Render at full native resolution. Wait for the chosen font to be
    // loaded — otherwise on cold open the first bake can fall back to the
    // browser's default serif.
    const probePx = Math.max(16, Math.round((imgEl.naturalHeight * sizePct) / 100));
    try {
      await document.fonts.load(`${probePx}px ${FONT_STACKS[font].stack}`);
    } catch {
      // Non-fatal; proceed with whatever is loaded.
    }
    const canvas = document.createElement("canvas");
    canvas.width = imgEl.naturalWidth;
    canvas.height = imgEl.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(imgEl, 0, 0);
    drawText(
      ctx,
      canvas.width,
      canvas.height,
      text,
      font,
      sizePct,
      color,
      position,
    );
    const dataUrl = canvas.toDataURL("image/png");
    onApply(dataUrl);
  }

  return (
    <div className="overlay-modal" role="dialog" aria-modal="true">
      <div className="overlay-panel">
        <div className="overlay-head">
          <span className="overlay-title">加文字 · Text Overlay</span>
          <button
            type="button"
            className="overlay-close"
            onClick={onClose}
            aria-label="关闭"
          >
            ×
          </button>
        </div>
        <div className="overlay-body">
          <div className="overlay-preview">
            {loadError ? (
              <div className="overlay-error">{loadError}</div>
            ) : (
              <canvas ref={previewCanvasRef} />
            )}
          </div>
          <div className="overlay-controls">
            <label className="overlay-field">
              <span className="micro-label">文字内容</span>
              <input
                type="text"
                className="overlay-input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="输入要贴上去的文字（建议 ≤ 12 字）"
                maxLength={40}
              />
            </label>
            <div className="overlay-field">
              <span className="micro-label">字体</span>
              <div className="overlay-chips">
                {(Object.keys(FONT_STACKS) as FontKey[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={`overlay-chip${font === k ? " is-active" : ""}`}
                    onClick={() => setFont(k)}
                    style={{ fontFamily: FONT_STACKS[k].stack }}
                  >
                    {FONT_STACKS[k].label}
                  </button>
                ))}
              </div>
            </div>
            <div className="overlay-field">
              <span className="micro-label">字号</span>
              <div className="overlay-chips">
                {SIZE_PRESETS.map((p) => (
                  <button
                    key={p.pct}
                    type="button"
                    className={`overlay-chip${sizePct === p.pct ? " is-active" : ""}`}
                    onClick={() => setSizePct(p.pct)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="overlay-field">
              <span className="micro-label">颜色</span>
              <div className="overlay-chips">
                {(Object.keys(COLORS) as ColorKey[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={`overlay-chip${color === k ? " is-active" : ""}`}
                    onClick={() => setColor(k)}
                  >
                    <span
                      className="overlay-swatch"
                      style={{ background: COLORS[k].hex }}
                      aria-hidden
                    />
                    {COLORS[k].label}
                  </button>
                ))}
              </div>
            </div>
            <div className="overlay-field">
              <span className="micro-label">位置</span>
              <div className="overlay-pos-grid">
                {POSITIONS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    className={`overlay-pos${
                      position === p.key ? " is-active" : ""
                    }`}
                    onClick={() => setPosition(p.key)}
                    aria-label={`位置 ${p.key}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="overlay-foot">
          <button type="button" className="overlay-cancel" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="overlay-apply"
            onClick={handleApply}
            disabled={!imgEl || !text.trim()}
          >
            落字 · Apply
          </button>
        </div>
      </div>
    </div>
  );
}

function drawText(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  text: string,
  font: FontKey,
  sizePct: number,
  color: ColorKey,
  position: Position,
) {
  const requestedSize = Math.max(12, Math.round((h * sizePct) / 100));
  const margin = Math.min(w, h) * 0.04;
  const maxWidth = Math.max(0, w - 2 * margin);
  // Measure at the requested size; if the string overflows the available
  // inner width, scale the font down proportionally so it always fits.
  // This is a single-line autofit — no wrapping, because wrap semantics
  // in Chinese are ambiguous (no spaces) and wrapping silently would
  // surprise the user more than shrinking.
  ctx.font = `${requestedSize}px ${FONT_STACKS[font].stack}`;
  const measured = ctx.measureText(text).width;
  const fontSize =
    measured > maxWidth && measured > 0
      ? Math.max(12, Math.floor((requestedSize * maxWidth) / measured))
      : requestedSize;
  if (fontSize !== requestedSize) {
    ctx.font = `${fontSize}px ${FONT_STACKS[font].stack}`;
  }
  ctx.fillStyle = COLORS[color].hex;
  const { x, y, align, baseline } = positionToDrawSpec(position, w, h, fontSize);
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  // A thin contrasting outline helps the text read against any background
  // without needing the user to think about it. Light ink gets a dark halo,
  // dark ink gets a light halo.
  const isLight = color === "white";
  ctx.lineWidth = Math.max(1, fontSize * 0.04);
  ctx.strokeStyle = isLight ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.5)";
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
}
