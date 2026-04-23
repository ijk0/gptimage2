"use client";

import { useEffect, useRef, useState } from "react";

type Status = "idle" | "loading" | "error";
type Quota = { limit: number; used: number; remaining: number; grant?: number };
type RechargeState = "idle" | "submitting" | "ok" | "error";
type MuseState = "idle" | "generating" | "error";

const DESIGN_TEMPLATES: {
  group: string;
  items: { label: string; text: string }[];
}[] = [
  {
    group: "整屋 · House",
    items: [
      {
        label: "日式现代住宅",
        text: "日式现代住宅外观，单层嵌入坡地，深出檐遮阳廊，手刨雪松外立面配黑色金属收边，整面玻璃推拉门通向砾石庭院",
      },
      {
        label: "北欧极简公寓",
        text: "北欧极简公寓客厅，白橡宽板地板，亚麻沙发，极简石灰白墙，大面积北窗引入柔光，角落一盆橄榄树",
      },
      {
        label: "地中海别墅",
        text: "地中海山丘别墅外观，白色石灰外墙与赤陶瓦屋顶，钴蓝色木门窗，橄榄树与紫葳藤缠绕院墙",
      },
      {
        label: "工业风 Loft",
        text: "工业风 loft 内景，裸露红砖与钢梁，抛光水泥地，大窗引入侧光，棕色皮沙发与长条木桌",
      },
      {
        label: "明清中式院落",
        text: "明清中式四合院俯视，青砖灰瓦坡屋顶，正房厢房围合，中央方形庭院种两棵老槐，青石板路",
      },
      {
        label: "侘寂茶屋",
        text: "侘寂风茶屋，土墙、黑松木柱、苔藓石径通向纸障子，简素榻榻米室内，光从高窗斜射",
      },
    ],
  },
  {
    group: "单间 · Room",
    items: [
      {
        label: "温暖极简客厅",
        text: "温暖极简客厅，米色亚麻沙发，圆形旅行灰石材茶几，厚羊毛地毯，落地窗外见花园绿意",
      },
      {
        label: "莫兰迪卧室",
        text: "莫兰迪色卧室，哑粉米色床品，素色亚麻帷帐，床头陶瓶插干枝，柔和晨光",
      },
      {
        label: "日式原木厨房",
        text: "日式家庭厨房，浅色橡木橱柜与灰泥墙，方形石材中岛，推拉纸门通向后院苔藓庭",
      },
      {
        label: "石材温泉浴室",
        text: "温泉主题浴室，整面洞石墙与地面，独立铸铁浴缸，黄铜淋浴与毛巾架，天光自上方洒下",
      },
      {
        label: "黑胡桃书房",
        text: "黑胡桃书房，整面内嵌式书墙，深绿皮扶手椅与黄铜台灯，壁炉暖光",
      },
      {
        label: "儿童游戏房",
        text: "儿童游戏房，浅木地板与奶油色墙面，低矮帆布帐篷，原木积木与软棉玩偶散落，侧窗柔光",
      },
    ],
  },
  {
    group: "庭院 · Yard",
    items: [
      {
        label: "日式枯山水",
        text: "日式枯山水庭院，耙纹白砾石、几块深色立石、苔藓与一株老松，木质侧廊与纸障子",
      },
      {
        label: "英式花境",
        text: "英式花境小径，多年生草本层层绽放，低矮黄杨绿篱，碎石小径通向橡木拱门",
      },
      {
        label: "地中海露台",
        text: "地中海露台，橄榄与柠檬树盆栽，赤陶地砖，白石灰矮墙，木质长桌与藤编灯串",
      },
      {
        label: "现代无边泳池",
        text: "现代山景别墅的无边泳池，洞石泳池边，棕榈与橄榄树，远处海平线，黄昏暖光",
      },
      {
        label: "小阳台花园",
        text: "城市公寓小阳台花园，竹木地板，藤编椅与小几，多肉与草本盆栽沿栏杆排列，傍晚软光",
      },
      {
        label: "苏州园林一角",
        text: "苏州园林一角，白墙黛瓦，月洞门，几竿湘妃竹映在墙上，石阶青苔，池水静谧",
      },
    ],
  },
];

const STYLES: { value: string; label: string }[] = [
  { value: "", label: "无" },
  { value: "胶片", label: "胶片" },
  { value: "电影", label: "电影" },
  { value: "时尚", label: "时尚" },
  { value: "极简", label: "极简" },
  { value: "童话", label: "童话" },
  { value: "水墨", label: "水墨" },
  { value: "东方", label: "东方" },
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
                <div className="tpl-field">
                  <span className="micro-label">设计题材 · Design preset</span>
                  <select
                    className="tpl-select"
                    value=""
                    onChange={(e) => {
                      const label = e.target.value;
                      if (!label) return;
                      const hit = DESIGN_TEMPLATES.flatMap((g) => g.items).find(
                        (t) => t.label === label,
                      );
                      if (hit) setIntent(hit.text);
                      e.target.value = "";
                    }}
                  >
                    <option value="">— 从住宅/房间/庭院题材中选一 —</option>
                    {DESIGN_TEMPLATES.map((group) => (
                      <optgroup key={group.group} label={group.group}>
                        {group.items.map((t) => (
                          <option key={t.label} value={t.label}>
                            {t.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
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
