"use client";

import { useEffect, useRef, useState } from "react";

type Status = "idle" | "loading" | "error";
type Quota = { limit: number; used: number; remaining: number; grant?: number };
type RechargeState = "idle" | "submitting" | "ok" | "error";
type MuseState = "idle" | "generating" | "error";
type Mode = "generate" | "edit";

// Presets grouped by job-to-be-done, informed by cross-app category analysis
// (Midjourney, Ideogram, Canva Magic Media, Recraft, Adobe Firefly Boards,
// 即梦, 妙鸭, 美图WHEE, 稿定, 堆友, 文心一格). Each item carries an optional
// suggested size that auto-fills the size picker on selection.
type PresetItem = { label: string; text: string; size?: string };

const PRESETS: { group: string; items: PresetItem[] }[] = [
  {
    group: "人像写真 · Portrait",
    items: [
      {
        label: "LinkedIn 证件照",
        text: "职场 LinkedIn 头像，半身证件照，深色西装配白衬衫，中性灰背景，柔和左前侧光，自然轻笑，面部清晰干净",
        size: "1024x1024",
      },
      {
        label: "小红书氛围写真",
        text: "小红书风格人像写真，女孩侧脸倚窗，柔软发丝被风轻拂，奶油色针织衫，淡粉唇色，清晨柔光，胶片颗粒",
        size: "1024x1536",
      },
      {
        label: "古风汉服人像",
        text: "古风汉服人像，明制竖领斜襟长袄，青绿色绣花披帛，手持团扇立于庭院梅树旁，斜阳落在面颊",
        size: "1024x1536",
      },
      {
        label: "二次元动漫头像",
        text: "二次元动漫头像，清新少女，蓝紫渐变瞳色，长发随风飘扬，樱花树下仰望天空，日系插画质感",
        size: "1024x1024",
      },
      {
        label: "情侣双人写真",
        text: "情侣海边写真，并肩坐在礁石上望向海平线，白色亚麻衬衫与米色连衣裙，黄昏暖金光线，胶片质感",
        size: "1536x1024",
      },
      {
        label: "旧照翻新",
        text: "一张 1960 年代家庭老照片的数字化修复版，保留原有颗粒与暖色偏，人物面部轮廓清晰、衣料纹理可辨",
      },
    ],
  },
  {
    group: "电商产品图 · E-commerce",
    items: [
      {
        label: "白底主图",
        text: "独立站白底产品主图，单件商品居中，纯净亮白背景，无投影或极轻柔阴影，产品边缘清晰锐利，三分之二角度呈现",
        size: "1024x1024",
      },
      {
        label: "生活场景图",
        text: "产品生活场景图，一只陶瓷马克杯置于木质早餐桌上，旁边散落报纸与一枝小雏菊，晨光自窗外斜入",
        size: "1024x1024",
      },
      {
        label: "服装模特上身",
        text: "女装模特上身展示图，米白色针织毛衣搭配高腰牛仔裤，极简灰色墙面背景，正面半身取景，自然站姿",
        size: "1024x1536",
      },
      {
        label: "美妆精修",
        text: "护肤精华液精修图，一瓶透明玻璃瓶置于水滴飞溅的浅色背景前，光线折射出液体通透感，硬光高光",
        size: "1024x1024",
      },
      {
        label: "食品包装场景",
        text: "食品包装场景图，一盒手工巧克力摆放在纯棉米色桌布上，点缀薄荷叶与可可豆碎片，自然侧光",
        size: "1024x1024",
      },
      {
        label: "3D 产品渲染",
        text: "3D 产品渲染图，一副无线耳机悬浮于淡灰渐变背景前，磨砂金属与哑光塑料材质，柔和工作室光塑造形态",
        size: "1024x1024",
      },
    ],
  },
  {
    group: "社交配图 · Social",
    items: [
      {
        label: "小红书封面",
        text: "小红书封面竖版配图，干净生活场景，一本摊开的书置于木桌上，左上方留出较大标题空间，温暖日系色调",
        size: "1024x1536",
      },
      {
        label: "朋友圈壁纸",
        text: "朋友圈分享用方形壁纸配图，抽象暖色渐变色块与极简手绘线条元素，氛围感强，轻度颗粒",
        size: "1024x1024",
      },
      {
        label: "节日祝福海报",
        text: "春节祝福海报，深红底色配金色祥云与梅花装饰，中央留出「新年快乐」排版空间，现代东方平面设计",
        size: "1024x1536",
      },
      {
        label: "生日贺卡",
        text: "生日贺卡设计，手绘水彩花束环绕在浅米色卡片周边，顶部预留姓名空间，温暖柔和水彩渲染",
        size: "1024x1536",
      },
      {
        label: "文字日签",
        text: "日签文字海报，莫兰迪灰绿背景，中央居中留出短句排版空间，下方点缀极简黑色线条插画",
        size: "1024x1536",
      },
      {
        label: "活动传单",
        text: "横版活动宣传海报，简洁几何构图，左侧图形元素右侧留白供文案排版，高对比色块，现代极简平面设计",
        size: "1536x1024",
      },
    ],
  },
  {
    group: "美食摄影 · Food",
    items: [
      {
        label: "精致摆盘",
        text: "餐厅菜单主图，精致摆盘的意大利面置于深色釉面瓷盘中，撒上帕玛森芝士与现磨黑椒，侧顶光突出质感",
        size: "1024x1024",
      },
      {
        label: "家常俯拍",
        text: "家常料理俯拍，一桌丰盛晚餐摆满木纹桌面，花盘、筷子、酒杯错落有致，柔和顶光，温馨氛围",
        size: "1024x1024",
      },
      {
        label: "烘焙特写",
        text: "烘焙甜点特写，一块奶油蛋糕切面近景，草莓与蓝莓点缀，糖粉轻撒其上，45° 侧光带出纹理",
        size: "1024x1536",
      },
      {
        label: "咖啡饮品",
        text: "手冲咖啡拉花特写，白色陶瓷杯置于水泥台面，蒸汽轻扬，柔和漫射光，浅景深虚化背景",
        size: "1024x1536",
      },
      {
        label: "外卖缩略图",
        text: "外卖平台商家缩略图，一碗热气腾腾的拉面俯拍，配菜整齐摆放，色彩饱满明亮，商业广告级",
        size: "1024x1024",
      },
    ],
  },
  {
    group: "宠物写真 · Pet",
    items: [
      {
        label: "自然光写真",
        text: "宠物毛孩自然光写真，一只橘色虎斑猫坐在窗台上，阳光透过纱帘洒下，毛发细节清晰，浅景深",
        size: "1024x1536",
      },
      {
        label: "拟人插画",
        text: "宠物拟人插画，一只柴犬穿着英伦风西装打领结，绅士姿态站立，水彩手绘质感，米色背景",
        size: "1024x1536",
      },
      {
        label: "节日造型",
        text: "宠物圣诞主题造型，一只金毛戴着红色圣诞帽与格纹围巾，坐在装饰圣诞树前，暖色灯光氛围",
        size: "1024x1024",
      },
      {
        label: "萌宠表情包",
        text: "萌宠表情包风格图，一只柯基抬头卖萌的近景，夸张卡通化表情，纯色背景，适合做聊天表情",
        size: "1024x1024",
      },
      {
        label: "宠物纪念图",
        text: "宠物纪念图，一只老狗和主人温馨对视的暖调剪影，淡金色自然光，轻微胶片颗粒",
        size: "1024x1536",
      },
    ],
  },
  {
    group: "亲子童趣 · Kids",
    items: [
      {
        label: "宝宝百天照",
        text: "宝宝百天纪念照，婴儿穿米色连身衣躺在柔软奶油色毛毯上，自然窗光，柔焦背景，轻微晨曦暖色",
        size: "1024x1536",
      },
      {
        label: "萌娃绘本风",
        text: "萌娃绘本插画，小女孩抱着毛绒兔子在花丛中奔跑，蓬松水彩笔触，童书级质感，柔和暖色调",
        size: "1024x1536",
      },
      {
        label: "亲子合影",
        text: "亲子家庭温馨合影，父母与孩子坐在客厅地毯上大笑，自然窗光，胶片色调，生活化瞬间",
        size: "1536x1024",
      },
      {
        label: "儿童节海报",
        text: "六一儿童节主题海报，卡通云朵与彩色气球漂浮于浅蓝背景，中央预留文字空间，明快糖果色调",
        size: "1024x1536",
      },
      {
        label: "故事书封面",
        text: "儿童故事书封面设计，主角小熊站在魔法森林入口，手绘水彩风格，金色标题装饰，复古童书质感",
        size: "1024x1536",
      },
      {
        label: "手工展示图",
        text: "儿童手工作品展示图，一张彩色剪纸画置于木纹桌面上，柔和阴影，自然窗光，真实质感",
        size: "1024x1024",
      },
    ],
  },
  {
    group: "整屋 · House",
    items: [
      {
        label: "日式现代住宅",
        text: "日式现代住宅外观，单层嵌入坡地，深出檐遮阳廊，手刨雪松外立面配黑色金属收边，整面玻璃推拉门通向砾石庭院",
        size: "1536x1024",
      },
      {
        label: "北欧极简公寓",
        text: "北欧极简公寓客厅，白橡宽板地板，亚麻沙发，极简石灰白墙，大面积北窗引入柔光，角落一盆橄榄树",
        size: "1536x1024",
      },
      {
        label: "地中海别墅",
        text: "地中海山丘别墅外观，白色石灰外墙与赤陶瓦屋顶，钴蓝色木门窗，橄榄树与紫葳藤缠绕院墙",
        size: "1536x1024",
      },
      {
        label: "工业风 Loft",
        text: "工业风 loft 内景，裸露红砖与钢梁，抛光水泥地，大窗引入侧光，棕色皮沙发与长条木桌",
        size: "1536x1024",
      },
      {
        label: "明清中式院落",
        text: "明清中式四合院俯视，青砖灰瓦坡屋顶，正房厢房围合，中央方形庭院种两棵老槐，青石板路",
        size: "1024x1024",
      },
      {
        label: "侘寂茶屋",
        text: "侘寂风茶屋，土墙、黑松木柱、苔藓石径通向纸障子，简素榻榻米室内，光从高窗斜射",
        size: "1024x1536",
      },
    ],
  },
  {
    group: "单间 · Room",
    items: [
      {
        label: "温暖极简客厅",
        text: "温暖极简客厅，米色亚麻沙发，圆形旅行灰石材茶几，厚羊毛地毯，落地窗外见花园绿意",
        size: "1536x1024",
      },
      {
        label: "莫兰迪卧室",
        text: "莫兰迪色卧室，哑粉米色床品，素色亚麻帷帐，床头陶瓶插干枝，柔和晨光",
        size: "1536x1024",
      },
      {
        label: "日式原木厨房",
        text: "日式家庭厨房，浅色橡木橱柜与灰泥墙，方形石材中岛，推拉纸门通向后院苔藓庭",
        size: "1536x1024",
      },
      {
        label: "石材温泉浴室",
        text: "温泉主题浴室，整面洞石墙与地面，独立铸铁浴缸，黄铜淋浴与毛巾架，天光自上方洒下",
        size: "1024x1536",
      },
      {
        label: "黑胡桃书房",
        text: "黑胡桃书房，整面内嵌式书墙，深绿皮扶手椅与黄铜台灯，壁炉暖光",
        size: "1536x1024",
      },
      {
        label: "儿童游戏房",
        text: "儿童游戏房，浅木地板与奶油色墙面，低矮帆布帐篷，原木积木与软棉玩偶散落，侧窗柔光",
        size: "1536x1024",
      },
    ],
  },
  {
    group: "庭院 · Yard",
    items: [
      {
        label: "日式枯山水",
        text: "日式枯山水庭院，耙纹白砾石、几块深色立石、苔藓与一株老松，木质侧廊与纸障子",
        size: "1536x1024",
      },
      {
        label: "英式花境",
        text: "英式花境小径，多年生草本层层绽放，低矮黄杨绿篱，碎石小径通向橡木拱门",
        size: "1536x1024",
      },
      {
        label: "地中海露台",
        text: "地中海露台，橄榄与柠檬树盆栽，赤陶地砖，白石灰矮墙，木质长桌与藤编灯串",
        size: "1536x1024",
      },
      {
        label: "现代无边泳池",
        text: "现代山景别墅的无边泳池，洞石泳池边，棕榈与橄榄树，远处海平线，黄昏暖光",
        size: "1536x1024",
      },
      {
        label: "小阳台花园",
        text: "城市公寓小阳台花园，竹木地板，藤编椅与小几，多肉与草本盆栽沿栏杆排列，傍晚软光",
        size: "1024x1024",
      },
      {
        label: "苏州园林一角",
        text: "苏州园林一角，白墙黛瓦，月洞门，几竿湘妃竹映在墙上，石阶青苔，池水静谧",
        size: "1024x1024",
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

const EDIT_PRESETS: { label: string; text: string }[] = [
  {
    label: "背景换场",
    text: "把背景换成一片柔和的晨雾山景，保留主体轮廓与色调",
  },
  {
    label: "风格化",
    text: "转成水彩手绘风，保留构图与主要细节，笔触松散温柔",
  },
  {
    label: "补元素",
    text: "在画面右下角加入一只安静趴着的小橘猫，毛发细腻、光线一致",
  },
  { label: "色彩调校", text: "把整体色调调成莫兰迪灰绿，降低饱和，保留结构" },
  { label: "清理杂物", text: "移除画面中所有杂乱物品，保持构图干净整洁" },
  { label: "季节切换", text: "把场景换成冬季，加入轻柔雪花与冷色调光线" },
];

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

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

function prettyBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Tolerant JSON parser for fetch responses. If the server (or a proxy /
// dev-server error page in between) returned HTML instead of JSON, surface a
// clean Chinese error rather than the raw "Unexpected token '<'" exception.
async function safeJson(res: Response): Promise<Record<string, unknown>> {
  const raw = await res.text();
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    const snippet = raw.trim().slice(0, 80).replace(/\s+/g, " ");
    throw new Error(
      `服务器返回了非 JSON 响应（HTTP ${res.status}）。请稍后重试。片段：${snippet}…`,
    );
  }
}

function todayStamp(): string {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}·${mm}·${dd}`;
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("generate");

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

  // Edit-mode state
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editPreview, setEditPreview] = useState<string | null>(null);
  const [editInstruction, setEditInstruction] = useState("");
  const [inputFidelity, setInputFidelity] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);

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
  const gallerySectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setStamp(todayStamp());
    (async () => {
      try {
        const r = await fetch("/api/generate");
        if (r.ok) {
          const d = (await safeJson(r)) as unknown as Quota;
          setQuota(d);
        }
      } catch {
        /* bootstrap failure is silent; UI falls back to default quota */
      }
      try {
        const r = await fetch("/api/recharge");
        const d = (await safeJson(r)) as { enabled?: boolean };
        setRechargeEnabled(!!d.enabled);
      } catch {
        /* recharge feature simply stays hidden on bootstrap failure */
      }
    })();
  }, []);

  // Revoke object URL when preview changes / component unmounts.
  useEffect(() => {
    if (!editPreview) return;
    return () => {
      URL.revokeObjectURL(editPreview);
    };
  }, [editPreview]);

  function applyEditFile(file: File | null) {
    if (!file) {
      setEditFile(null);
      setEditPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("仅支持图片文件（PNG / JPEG / WEBP）");
      setStatus("error");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`图片过大（上限 ${MAX_UPLOAD_BYTES / 1024 / 1024}MB）`);
      setStatus("error");
      return;
    }
    setEditFile(file);
    setEditPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setError(null);
    setStatus("idle");
  }

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
      const data = await safeJson(res);
      if (!res.ok) {
        const detail =
          typeof data?.details === "string"
            ? (data.details as string)
            : data?.details
              ? JSON.stringify(data.details)
              : "";
        throw new Error(
          data?.error
            ? `${data.error as string}${detail ? `：${detail}` : ""}`
            : "生成失败",
        );
      }
      if (typeof data.prompt === "string" && data.prompt.trim()) {
        setPrompt((data.prompt as string).trim());
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
      const data = await safeJson(res);
      if (!res.ok) throw new Error((data?.error as string) ?? "兑换失败");
      setQuota({
        limit: data.limit as number,
        used: data.used as number,
        remaining: data.remaining as number,
        grant: data.grant as number,
      });
      setRechargeState("ok");
      setRechargeMsg(`兑换成功，次数 +${data.added as number}`);
      setRechargeCode("");
      if (error) setError(null);
    } catch (err) {
      setRechargeState("error");
      setRechargeMsg((err as Error).message);
    }
  }

  const quotaExhausted = quota.remaining <= 0;

  const generateDisabled =
    status === "loading" || !prompt.trim() || quotaExhausted;
  const editDisabled =
    status === "loading" ||
    !editFile ||
    !editInstruction.trim() ||
    quotaExhausted;
  const disabled = mode === "generate" ? generateDisabled : editDisabled;

  const effectiveN = Math.min(n, Math.max(quota.remaining, 1));
  const selectedSize = SIZES.find((s) => s.value === size) ?? SIZES[0];
  const plateRatio =
    selectedSize.value === "auto" ? "1 / 1" : selectedSize.ratio;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled) return;
    setStatus("loading");
    setError(null);
    requestAnimationFrame(() => {
      gallerySectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
    try {
      const res =
        mode === "generate"
          ? await fetch("/api/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                prompt,
                size,
                quality,
                n,
                output_format: format,
              }),
            })
          : await (async () => {
              const body = new FormData();
              body.set("prompt", editInstruction);
              body.set("size", size);
              body.set("quality", quality);
              body.set("n", String(n));
              body.set("output_format", format);
              if (inputFidelity) body.set("input_fidelity", "high");
              body.set("image", editFile as File, (editFile as File).name);
              return fetch("/api/edit", { method: "POST", body });
            })();
      const data = await safeJson(res);
      if (!res.ok) {
        if (res.status === 429 && typeof data?.limit === "number") {
          setQuota({
            limit: data.limit as number,
            used: (data.used as number | undefined) ?? (data.limit as number),
            remaining: 0,
          });
        }
        const detail =
          typeof data?.details === "string"
            ? (data.details as string)
            : data?.details
              ? JSON.stringify(data.details)
              : "";
        throw new Error(
          data?.error
            ? `${data.error as string}${detail ? `:${detail}` : ""}`
            : "请求失败",
        );
      }
      setImages((data.images as string[]) ?? []);
      if (typeof data.limit === "number") {
        setQuota({
          limit: data.limit as number,
          used: data.used as number,
          remaining: data.remaining as number,
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

      <div className="mode-tabs" role="tablist" aria-label="模式">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "generate"}
          className={`mode-tab${mode === "generate" ? " is-on" : ""}`}
          onClick={() => setMode("generate")}
        >
          <span className="mode-tab-label">生成 · Generate</span>
          <span className="mode-tab-hint">从文字落笔</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "edit"}
          className={`mode-tab${mode === "edit" ? " is-on" : ""}`}
          onClick={() => setMode("edit")}
        >
          <span className="mode-tab-label">编辑 · Edit</span>
          <span className="mode-tab-hint">在已有图像上改写</span>
        </button>
      </div>

      <form onSubmit={onSubmit}>
        {mode === "generate" ? (
          <section className="sec">
            <div className="sec-head">
              <span className="sec-title">创作工坊</span>
              <span className="sec-no">— BRIEF</span>
            </div>

            <div className="workbench">
              <div className="intent-col">
                <div className="intent-field">
                  <div className="intent-head">
                    <span className="micro-label">立意 · What do you want</span>
                    <span className="intent-count">{intent.length} / 600</span>
                  </div>
                  <textarea
                    className="intent-input"
                    value={intent}
                    onChange={(e) => setIntent(e.target.value)}
                    placeholder="写下你想看到的画面，一句或一段都好。&#10;例：一只戴围巾的柴犬坐在月球上，背后地球正在升起，胶片颗粒。"
                    rows={4}
                    maxLength={600}
                  />
                  <span className="intent-hint">
                    先写下你想看到的画面，再挑一个风格，MUSE 会替你写详细提示词。
                  </span>
                  <div className="tpl-field">
                    <span className="micro-label">题材模板 · Preset</span>
                    <select
                      className="tpl-select"
                      value=""
                      onChange={(e) => {
                        const label = e.target.value;
                        if (!label) return;
                        const hit = PRESETS.flatMap((g) => g.items).find(
                          (t) => t.label === label,
                        );
                        if (hit) {
                          setIntent(hit.text);
                          if (hit.size) setSize(hit.size);
                        }
                        e.target.value = "";
                      }}
                    >
                      <option value="">— 选一个日常题材开始 —</option>
                      {PRESETS.map((group) => (
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
        ) : (
          <section className="sec">
            <div className="sec-head">
              <span className="sec-title">编辑工坊</span>
              <span className="sec-no">— EDIT</span>
            </div>

            <div className="workbench">
              <div className="intent-col">
                <span className="micro-label">原图 · Source image</span>
                <div
                  className={`drop-zone${editPreview ? " has-image" : ""}${dragOver ? " is-drag" : ""}`}
                  onClick={() => {
                    if (!editPreview) editFileInputRef.current?.click();
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) applyEditFile(file);
                  }}
                  role={editPreview ? undefined : "button"}
                  tabIndex={editPreview ? -1 : 0}
                  onKeyDown={(e) => {
                    if (
                      !editPreview &&
                      (e.key === "Enter" || e.key === " ")
                    ) {
                      e.preventDefault();
                      editFileInputRef.current?.click();
                    }
                  }}
                >
                  {editPreview ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={editPreview}
                        alt="已选原图"
                        className="drop-preview"
                      />
                      <div className="drop-meta">
                        <span className="drop-filename">
                          {editFile?.name ?? ""}
                        </span>
                        <span className="drop-filesize">
                          {editFile ? prettyBytes(editFile.size) : ""}
                        </span>
                      </div>
                      <div className="drop-actions">
                        <button
                          type="button"
                          className="drop-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            editFileInputRef.current?.click();
                          }}
                        >
                          换一张
                        </button>
                        <button
                          type="button"
                          className="drop-btn drop-btn-ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            applyEditFile(null);
                          }}
                        >
                          移除
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="drop-icon" aria-hidden>
                        ⇪
                      </span>
                      <span className="drop-title">拖入图片，或点击选择</span>
                      <span className="drop-hint">
                        支持 PNG / JPEG / WEBP · 最大 25 MB
                      </span>
                    </>
                  )}
                  <input
                    ref={editFileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    style={{ display: "none" }}
                    onChange={(e) => applyEditFile(e.target.files?.[0] ?? null)}
                  />
                </div>

                <label className="fidelity-row">
                  <input
                    type="checkbox"
                    checked={inputFidelity}
                    onChange={(e) => setInputFidelity(e.target.checked)}
                  />
                  <span className="fidelity-label">
                    <span className="fidelity-main">保留原图质感</span>
                    <span className="fidelity-hint">
                      input_fidelity=high · 适合人像 / 品牌 / 质感敏感场景
                    </span>
                  </span>
                </label>
              </div>

              <div className="prompt-col">
                <div className="prompt-head">
                  <span className="micro-label">编辑指令 · Instruction</span>
                  <span className="prompt-origin">
                    {editInstruction ? `${editInstruction.length} 字` : ""}
                  </span>
                </div>
                <textarea
                  className="prompt-area"
                  value={editInstruction}
                  onChange={(e) => setEditInstruction(e.target.value)}
                  placeholder="例：把背景换成晨雾山景，保留主体轮廓与色调；或：在画面右下角加入一只安静趴着的小橘猫。"
                />
                <div className="prompt-foot">
                  <div className="edit-preset-row">
                    {EDIT_PRESETS.map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        className="edit-preset-chip"
                        onClick={() => setEditInstruction(p.text)}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="clear-btn"
                    onClick={() => setEditInstruction("")}
                    disabled={!editInstruction}
                  >
                    清空
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

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
                {mode === "generate" ? "制版中" : "重绘中"}
              </>
            ) : quotaExhausted ? (
              "额度用尽"
            ) : mode === "generate" ? (
              <>
                <span>落 印</span>
                <span className="press-dash">·</span>
                <span>生成图像</span>
              </>
            ) : (
              <>
                <span>落 印</span>
                <span className="press-dash">·</span>
                <span>重绘图像</span>
              </>
            )}
          </button>
        </div>
      </form>

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

      <section
        ref={gallerySectionRef}
        className="sec gallery-sec"
        aria-live="polite"
      >
        <div className="sec-head">
          <span className="sec-title">版面</span>
          <span className="gallery-meta">
            {status === "loading"
              ? `${mode === "generate" ? "制版中" : "重绘中"} · 共 ${effectiveN} 版`
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
                  <span>{mode === "generate" ? "制版中…" : "重绘中…"}</span>
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
            {mode === "generate"
              ? "尚无版面 —— 写下立意、按下落印，此处将呈现你的第一张图。"
              : "尚无版面 —— 上传一张图、写下编辑指令，按下落印，此处将呈现新版。"}
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
