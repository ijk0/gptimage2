"use client";

import { useEffect, useRef, useState } from "react";
import { TextOverlay } from "./_components/TextOverlay";

type Status = "idle" | "loading" | "error";
type Quota = { limit: number; used: number; remaining: number; grant?: number };
type RechargeState = "idle" | "submitting" | "ok" | "error";
type MuseState = "idle" | "generating" | "error";
type Mode = "generate" | "edit";

// Presets grouped by job-to-be-done, informed by cross-app category analysis
// (Midjourney, Ideogram, Canva Magic Media, Recraft, Adobe Firefly Boards,
// 即梦, 妙鸭, 美图WHEE, 稿定, 堆友, 文心一格). Each item carries an optional
// suggested size that auto-fills the size picker on selection.
type PresetItem = {
  label: string;
  text: string;
  size?: string;
  // Selecting the preset nudges `quality` to this tier when set, otherwise
  // leaves the user's current pick alone. Reserve "high" for presets where
  // face or product detail materially changes the accept rate.
  quality?: string;
  // Optional style chip to auto-select (must exist in STYLES).
  style?: string;
  // Presets where the prompt only makes sense with a user-supplied source
  // image (e.g. "restore this old photo", "turn my pet into a gentleman").
  // Selecting one of these auto-routes to edit mode.
  needsImage?: boolean;
};

const PRESETS: { group: string; items: PresetItem[] }[] = [
  {
    group: "人像写真 · Portrait",
    items: [
      {
        label: "LinkedIn 证件照",
        text: "职场 LinkedIn 头像，半身证件照，深色西装配白衬衫，中性灰背景，柔和左前侧光，自然轻笑，面部清晰干净",
        size: "1024x1024",
        quality: "high",
      },
      {
        label: "小红书氛围写真",
        text: "小红书风格人像写真，女孩侧脸倚窗，柔软发丝被风轻拂，奶油色针织衫，淡粉唇色，清晨柔光，胶片颗粒",
        size: "1024x1536",
        quality: "high",
        style: "胶片",
      },
      {
        label: "古风汉服人像",
        text: "古风汉服人像，明制竖领斜襟长袄，青绿色绣花披帛，手持团扇立于庭院梅树旁，斜阳落在面颊",
        size: "1024x1536",
        quality: "high",
        style: "东方",
      },
      {
        label: "二次元动漫头像",
        text: "把这张照片转成二次元动漫头像，保留人物五官与发型轮廓，蓝紫渐变瞳色，日系插画质感，樱花柔光背景",
        size: "1024x1024",
        quality: "high",
        needsImage: true,
      },
      {
        label: "情侣双人写真",
        text: "情侣海边写真，并肩坐在礁石上望向海平线，白色亚麻衬衫与米色连衣裙，黄昏暖金光线，胶片质感",
        size: "1536x1024",
        quality: "high",
        style: "胶片",
      },
      {
        label: "旧照翻新",
        text: "对这张老照片做数字化修复：去除划痕折痕、提升清晰度、还原自然肤色与衣料纹理，保留原有颗粒与年代感的暖色偏",
        quality: "high",
        needsImage: true,
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
        quality: "high",
        style: "极简",
      },
      {
        label: "生活场景图",
        text: "产品生活场景图，一只陶瓷马克杯置于木质早餐桌上，旁边散落报纸与一枝小雏菊，晨光自窗外斜入",
        size: "1024x1024",
        quality: "high",
      },
      {
        label: "服装模特上身",
        text: "女装模特上身展示图，米白色针织毛衣搭配高腰牛仔裤，极简灰色墙面背景，正面半身取景，自然站姿",
        size: "1024x1536",
        quality: "high",
        style: "时尚",
      },
      {
        label: "美妆精修",
        text: "护肤精华液精修图，一瓶透明玻璃瓶置于水滴飞溅的浅色背景前，光线折射出液体通透感，硬光高光",
        size: "1024x1024",
        quality: "high",
        style: "极简",
      },
      {
        label: "食品包装场景",
        text: "食品包装场景图，一盒手工巧克力摆放在纯棉米色桌布上，点缀薄荷叶与可可豆碎片，自然侧光",
        size: "1024x1024",
        quality: "high",
      },
      {
        label: "3D 产品渲染",
        text: "3D 产品渲染图，一副无线耳机悬浮于淡灰渐变背景前，磨砂金属与哑光塑料材质，柔和工作室光塑造形态",
        size: "1024x1024",
        quality: "high",
        style: "极简",
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
        quality: "high",
        style: "胶片",
      },
      {
        label: "家常俯拍",
        text: "家常料理俯拍，一桌丰盛晚餐摆满木纹桌面，花盘、筷子、酒杯错落有致，柔和顶光，温馨氛围",
        size: "1024x1024",
        quality: "high",
        style: "胶片",
      },
      {
        label: "烘焙特写",
        text: "烘焙甜点特写，一块奶油蛋糕切面近景，草莓与蓝莓点缀，糖粉轻撒其上，45° 侧光带出纹理",
        size: "1024x1536",
        quality: "high",
        style: "胶片",
      },
      {
        label: "咖啡饮品",
        text: "手冲咖啡拉花特写，白色陶瓷杯置于水泥台面，蒸汽轻扬，柔和漫射光，浅景深虚化背景",
        size: "1024x1536",
        quality: "high",
        style: "极简",
      },
      {
        label: "外卖缩略图",
        text: "外卖平台商家缩略图，一碗热气腾腾的拉面俯拍，配菜整齐摆放，色彩饱满明亮，商业广告级",
        size: "1024x1024",
        quality: "high",
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
        text: "把这只宠物画成拟人插画：穿英伦风西装打领结，绅士姿态站立，水彩手绘质感，米色背景，保留原毛色与五官特征",
        size: "1024x1536",
        needsImage: true,
      },
      {
        label: "节日造型",
        text: "为这只宠物加上圣诞主题造型：戴红色圣诞帽与格纹围巾，坐在装饰圣诞树前，暖色灯光氛围，保持原毛色与神态",
        size: "1024x1024",
        needsImage: true,
      },
      {
        label: "萌宠表情包",
        text: "把这只宠物做成表情包：夸张卡通化表情、纯色背景、近景特写，保留原毛色与五官，适合做聊天表情",
        size: "1024x1024",
        needsImage: true,
      },
      {
        label: "宠物纪念图",
        text: "把这只宠物做成温馨纪念图：暖调剪影，与主人对视，淡金色自然光，轻微胶片颗粒，保留原品种特征",
        size: "1024x1536",
        needsImage: true,
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
        quality: "high",
      },
      {
        label: "萌娃绘本风",
        text: "萌娃绘本插画，小女孩抱着毛绒兔子在花丛中奔跑，蓬松水彩笔触，童书级质感，柔和暖色调",
        size: "1024x1536",
        quality: "high",
        style: "童话",
      },
      {
        label: "亲子合影",
        text: "亲子家庭温馨合影，父母与孩子坐在客厅地毯上大笑，自然窗光，胶片色调，生活化瞬间",
        size: "1536x1024",
        quality: "high",
        style: "胶片",
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
        quality: "high",
        style: "童话",
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
  {
    group: "直播带货 · Live-Commerce",
    items: [
      {
        label: "马斯克卖火箭",
        text: "抖音竖屏直播间截图风格，马斯克身穿 SpaceX 黑 T 对镜头大笑，双手高举一枚 Falcon 9 火箭模型，环形补光灯在瞳孔留下圆环高光，桌面堆放 Starship 周边，画面顶部弹幕飘「买了买了」「家人们冲」，中央红底黄字「9.9 秒杀 三二一上链接」贴纸，左下角小黄车图标，过饱和暖色美颜滤镜",
        size: "1024x1536",
        quality: "high",
      },
      {
        label: "川普上链接",
        text: "抖音竖屏直播间实拍感，特朗普戴红色 MAGA 帽指向镜头，桌上堆满金色运动鞋、牛排与小国旗，身后绿幕贴「美国优先 专属价」海报，顶部在线人数 12.3 万，右侧飘过爱心与火箭礼物动画，中央红色秒杀贴纸「限时 $0.99 仅剩 87 件」，底部倒计时 03:42，环形补光灯瞳孔高光",
        size: "1024x1536",
        quality: "high",
      },
      {
        label: "霸总直播首秀",
        text: "抖音直播间首秀截图风格，西装革履的科技公司 CEO 坐在简洁黑色桌前，手握一只最新款消费电子产品对着镜头微微倾身推荐，身后品牌 Logo 灯箱虚化，环形补光灯高光，屏幕顶部显示「在线 56 万」，下方小黄车与「点击购买」CTA，弹幕「老板真的会带货？」「上链接！」飘过",
        size: "1024x1536",
        quality: "high",
      },
      {
        label: "夜市地摊吆喝",
        text: "城中村夜市地摊手机竖屏直播，摊主蹲在塑料布后面，一堆火箭模型、坦克模型、旧手机乱堆，手写纸板「全场 3 块不讲价」，头顶一只白炽灯泡与手机闪光灯混合光源，夜色湿润地面反光，弹幕「老板抽根烟」「这火箭能飞吗」飘过，画面一角 9 块 9 橙色贴纸",
        size: "1024x1536",
        quality: "high",
      },
      {
        label: "9块9秒杀海报",
        text: "抖音电商爆款商品主图风格，纯色明亮橙红渐变背景，中央放置一件荒诞商品（可替换），周围环绕放射状红色贴纸「限时秒杀」「9.9 包邮」「仅剩 199 件」「三二一 上链接」，左下划线价 ¥999 红色直播间专属价 ¥9.9，右上小黄车图标，高饱和糖果色电商风格",
        size: "1024x1024",
        quality: "high",
      },
      {
        label: "名人带货移花接木",
        text: "把照片里的人物放进抖音竖屏直播间：保留其五官与发型，换成带货主播姿态——微微前倾、一手举产品一手比划，身后虚化的产品货架与品牌灯箱，环形补光灯瞳孔高光，画面叠加顶部在线人数、中央「三二一上链接」红底贴纸、弹幕飘屏、左下小黄车，过饱和暖色美颜滤镜",
        quality: "high",
        needsImage: true,
      },
    ],
  },
  {
    group: "学术作图 · Academic",
    items: [
      {
        label: "图形摘要",
        text: "学术期刊 graphical abstract 风格，正方形构图，单一核心机制居中，左到右叙事流，扁平矢量图标与带标签箭头连接，清爽白底留白充足，Okabe-Ito 色板（蓝橙青米）或柔和 teal-navy-coral 三色，Arial 无衬线极小字号占位标签，无装饰性渐变与阴影，印刷级线稿质感",
        size: "1024x1024",
        quality: "high",
        style: "极简",
      },
      {
        label: "生物通路图",
        text: "BioRender 风格生物通路示意图，细胞膜横截面作为舞台，磷脂双层分明，跨膜蛋白、激酶、转录因子以扁平矢量圆角图标呈现，信号传递用黑色实线箭头与虚线反馈箭头标注，teal 与 coral 双色编码不同通路，白底，6–8pt 无衬线占位文字框，期刊发表级",
        size: "1536x1024",
        quality: "high",
        style: "极简",
      },
      {
        label: "神经网络架构",
        text: "机器学习论文 architecture diagram 风格，自左至右横向堆叠输入层、若干隐藏层（用重复长方体立方表示维度）、注意力模块与输出层，层间数据流以细实线箭头标注，淡蓝到深灰渐进填色，浅灰背景，角标 placeholder 维度 B×N×d，极简无衬线字体，ICML/NeurIPS 投稿配图质感",
        size: "1536x1024",
        quality: "high",
        style: "极简",
      },
      {
        label: "实验流程图",
        text: "横向实验流程示意图，五个等距圆角方框串联，箭头连接表示先后，每框内含扁平矢量图标（烧瓶、离心机、样本管、显微镜、数据表）并在下方留出 caption 占位，全图统一 1.5pt 黑色描边与单一主色调 navy，白底充足留白，类似 Nature Protocols 配图风格",
        size: "1536x1024",
        quality: "high",
        style: "极简",
      },
      {
        label: "Nature 封面插画",
        text: "Nature 期刊封面概念插画风格，单一科学概念以视觉隐喻呈现（如 DNA 双螺旋融入宇宙星轨、神经元汇聚成城市夜景），半写实半概念融合，戏剧性低角度主光与深蓝—琥珀对比光，中央留出刊名与期号的排版空间，构图具书影级质感，极高细节",
        size: "1024x1536",
        quality: "high",
        style: "电影",
      },
      {
        label: "学术会议海报",
        text: "A0 纵版学术会议海报布局，顶部深色标题横幅预留大标题与作者单位空间，下方三列均分：左列研究背景与问题，中列方法与实验流程配图占位，右列结果与结论，柱状图/示意图/流程图整齐嵌入，极简 Swiss 排版，深蓝主色搭配中性灰，充足留白，IEEE/ACM/Nature 会议风",
        size: "1024x1536",
        quality: "high",
        style: "极简",
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

// User-facing microcopy for the params strip. Short, concrete tradeoffs so
// users learn which tier matches which task without reading docs.
const SIZE_HINTS: Record<string, string> = {
  auto: "由模型按意图决定画布",
  "1024x1024": "方图 · 基线画布，适合头像/产品/方形海报",
  "1536x1024": "横版 · 适合合影/风景/宽构图",
  "1024x1536": "竖版 · 适合人像/海报/故事书",
  "2048x2048": "大方图 · 生成较慢、成本更高，用于印刷级需求",
};
const QUALITY_HINTS: Record<string, string> = {
  auto: "由模型决定，日常场景可用",
  low: "草稿 · 最快，适合试版与快速迭代",
  medium: "标准 · 日常发布可用的平衡档",
  high: "精制 · 人像 / 产品 / 文字建议使用，生成较慢",
};

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
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [dropZoneFlash, setDropZoneFlash] = useState(false);

  const [quota, setQuota] = useState<Quota>({
    limit: 0,
    used: 0,
    remaining: 0,
  });
  const [stamp, setStamp] = useState("");

  const [rechargeEnabled, setRechargeEnabled] = useState(false);
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [rechargeCode, setRechargeCode] = useState("");
  const [rechargeState, setRechargeState] = useState<RechargeState>("idle");
  const [rechargeMsg, setRechargeMsg] = useState<string | null>(null);
  const rechargePopoverRef = useRef<HTMLSpanElement>(null);
  const rechargeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!rechargeOpen) return;
    const closePopover = () => {
      setRechargeOpen(false);
      setRechargeMsg(null);
    };
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closePopover();
    }
    function onPointerDown(e: MouseEvent) {
      const el = rechargePopoverRef.current;
      if (el && !el.contains(e.target as Node)) closePopover();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointerDown);
    // Autofocus the input on open, and push cursor to end.
    const input = rechargeInputRef.current;
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [rechargeOpen]);

  const [authEnabled, setAuthEnabled] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  const [museState, setMuseState] = useState<MuseState>("idle");
  const [museError, setMuseError] = useState<string | null>(null);
  // Short explanation shown when MUSE auto-upgrades size/quality based on
  // portrait-intent detection. Cleared as soon as the user touches a control.
  const [hintNote, setHintNote] = useState<string | null>(null);
  // Tracks which gallery plate is currently being refined; -1 = none.
  const [refiningIdx, setRefiningIdx] = useState<number>(-1);
  // Index of the plate currently open in the text-overlay modal; -1 = closed.
  const [overlayIdx, setOverlayIdx] = useState<number>(-1);

  const promptRef = useRef<HTMLTextAreaElement>(null);
  const gallerySectionRef = useRef<HTMLElement>(null);
  // Mirror size/quality into refs so the async MUSE handler can check the
  // LATEST user-facing values when the response arrives, rather than the
  // stale values captured in the closure at call time. Without this, a user
  // who changes size/quality mid-flight has their explicit pick overwritten
  // by a late-arriving portrait-intent nudge.
  const sizeRef = useRef(size);
  const qualityRef = useRef(quality);
  useEffect(() => {
    sizeRef.current = size;
  }, [size]);
  useEffect(() => {
    qualityRef.current = quality;
  }, [quality]);

  useEffect(() => {
    setStamp(todayStamp());
    (async () => {
      try {
        const r = await fetch("/api/auth/me");
        if (r.ok) {
          const d = (await safeJson(r)) as {
            username: string | null;
            quota: Quota;
            authEnabled: boolean;
          };
          if (d.quota) setQuota(d.quota);
          setUsername(d.username ?? null);
          setAuthEnabled(!!d.authEnabled);
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

  async function handleLogout() {
    if (authBusy) return;
    setAuthBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUsername(null);
      // Re-pull quota so anonymous cookie quota is reflected.
      const r = await fetch("/api/auth/me");
      if (r.ok) {
        const d = (await safeJson(r)) as { quota: Quota };
        if (d.quota) setQuota(d.quota);
      }
    } finally {
      setAuthBusy(false);
    }
  }

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

  function applyPreset(label: string) {
    const hit = PRESETS.flatMap((g) => g.items).find((t) => t.label === label);
    if (!hit) return;
    const goEdit = hit.needsImage || mode === "edit";
    if (goEdit) {
      if (mode !== "edit") setMode("edit");
      setEditInstruction(hit.text);
      if (hit.size) setSize(hit.size);
      if (hit.quality) setQuality(hit.quality);
      // Style chip is a rewriter input (only relevant in generate mode) — in
      // edit mode we still capture it for when the user switches back, but
      // the edit call itself doesn't consume the style.
      if (hit.style !== undefined) setStyle(hit.style);
      // Nudge attention toward the upload zone if no image is loaded yet.
      if (!editFile) {
        requestAnimationFrame(() => {
          dropZoneRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        });
        setDropZoneFlash(true);
        window.setTimeout(() => setDropZoneFlash(false), 1400);
      }
    } else {
      setIntent(hit.text);
      if (hit.size) setSize(hit.size);
      if (hit.quality) setQuality(hit.quality);
      if (hit.style !== undefined) setStyle(hit.style);
    }
    // Applying a preset is an explicit pick; clear any lingering auto-nudge.
    setHintNote(null);
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
      // Apply server-side hints for portrait-like intents, but only when
      // the user is still on the default "auto" for that control — never
      // overwrite an explicit pick.
      const hints = data.hints as
        | {
            needsHighQuality?: boolean;
            preferredSize?: string;
            reason?: string;
          }
        | undefined;
      if (hints) {
        let nudged = false;
        // Read LATEST size/quality via refs, not closure-captured values —
        // the user may have adjusted either control while the request was
        // in flight; in that case we must leave their explicit pick alone.
        if (hints.needsHighQuality && qualityRef.current === "auto") {
          setQuality("high");
          nudged = true;
        }
        if (hints.preferredSize && sizeRef.current === "auto") {
          setSize(hints.preferredSize);
          nudged = true;
        }
        setHintNote(nudged && hints.reason ? hints.reason : null);
      } else {
        setHintNote(null);
      }
      setMuseState("idle");
    } catch (err) {
      setMuseError((err as Error).message);
      setMuseState("error");
    }
  }

  // Re-run /images/edits on an already-generated plate with a face-targeting
  // refine prompt + input_fidelity=high + quality=high. Honest limits: this
  // can lift apparent sharpness and eye/skin micro-detail on a face that is
  // already reasonably sized; it will NOT rescue a face that was tiny at
  // generation time (for that, Phase 1's portrait-intent auto-upgrade is the
  // preventive fix). The upstream /images/edits endpoint does not support
  // true mask-based inpainting, so we run a full-image edit pass and rely on
  // the Preserve block to hold everything else steady.
  async function onRefineFace(idx: number, src: string) {
    if (refiningIdx !== -1) return;
    if (quota.remaining <= 0) {
      setError("可用次数已用完。");
      setStatus("error");
      return;
    }
    setRefiningIdx(idx);
    setError(null);
    try {
      // Turn the rendered src (data URL or remote URL) into a Blob we can
      // post back. For data URLs, do the conversion in-process; for remote
      // URLs, fetch first (same-origin b64 paths are the common case).
      let blob: Blob;
      if (src.startsWith("data:")) {
        const [header, b64] = src.split(",", 2);
        const mime = header.match(/^data:([^;]+)/)?.[1] ?? "image/png";
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
        blob = new Blob([bytes], { type: mime });
      } else {
        const r = await fetch(src);
        if (!r.ok) throw new Error(`无法读取原图：HTTP ${r.status}`);
        blob = await r.blob();
      }

      const refinePrompt =
        "Enhance the portrait fidelity on this image: render sharp eyes with visible catchlights, a defined nose bridge, individual eyelashes, and natural skin pore texture on every visible face. Preserve identity, pose, expression, framing, lighting, background, color grade, and all non-face content EXACTLY — do not restyle, recompose, crop, add, or remove anything. Only increase apparent sharpness and micro-detail of the face region.";

      const body = new FormData();
      body.set("prompt", refinePrompt);
      // The refine prompt already embeds its own Preserve block, so bypass
      // the server-side Change/Preserve/Constraints wrapper.
      body.set("raw", "1");
      body.set("size", "auto");
      body.set("quality", "high");
      body.set("n", "1");
      body.set("output_format", format);
      body.set("input_fidelity", "high");
      body.set("image", blob, `plate-${idx + 1}.png`);

      const res = await fetch("/api/edit", { method: "POST", body });
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
            : "精修失败",
        );
      }
      const refined = (data.images as string[] | undefined)?.[0];
      if (!refined) throw new Error("精修未返回图片");
      setImages((prev) => prev.map((s, i) => (i === idx ? refined : s)));
      if (typeof data.limit === "number") {
        setQuota({
          limit: data.limit as number,
          used: data.used as number,
          remaining: data.remaining as number,
        });
      }
    } catch (err) {
      setError((err as Error).message);
      setStatus("error");
    } finally {
      setRefiningIdx(-1);
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
  // While a refine is in flight we must block new generate/edit submissions.
  // Quota is read-modify-write server-side (see lib/quota.ts recordUsage),
  // so concurrent requests can lose updates. The frontend gate is the
  // cheap fix until that backend is made atomic.
  const refineInFlight = refiningIdx !== -1;

  const generateDisabled =
    status === "loading" || refineInFlight || !prompt.trim() || quotaExhausted;
  const editDisabled =
    status === "loading" ||
    refineInFlight ||
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
          <h1>像素工坊 · Pixel Foundry</h1>
          <span className="mast-sub">A typographic console for gpt-image-2</span>
        </div>
        <div className="mast-meta">
          <span>No. 0001 · {stamp}</span>
          <span className="mast-quota" ref={rechargePopoverRef}>
            <span className="mast-quota__label">
              可用次数 <span className="cinnabar">{quota.remaining}</span> /{" "}
              {quota.limit}
            </span>
            {rechargeEnabled && (
              <button
                type="button"
                className={`mast-redeem${quotaExhausted ? " is-urgent" : ""}${rechargeOpen ? " is-open" : ""}`}
                onClick={() => {
                  setRechargeOpen((v) => !v);
                  setRechargeMsg(null);
                }}
                aria-expanded={rechargeOpen}
                aria-controls="recharge-popover"
              >
                {quotaExhausted ? "兑换 →" : "兑换"}
              </button>
            )}
            {rechargeEnabled && rechargeOpen && (
              <div
                id="recharge-popover"
                className="recharge-popover"
                role="dialog"
                aria-label="兑换次数"
              >
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
                      ref={rechargeInputRef}
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
              </div>
            )}
          </span>
          {authEnabled ? (
            <span className="mast-auth">
              {username ? (
                <>
                  <span>账号 · {username}</span>
                  <button
                    type="button"
                    className="mast-auth__btn"
                    onClick={handleLogout}
                    disabled={authBusy}
                  >
                    {authBusy ? "退出中…" : "退出"}
                  </button>
                </>
              ) : (
                <a className="mast-auth__btn" href="/login">
                  登录 / 注册
                </a>
              )}
            </span>
          ) : null}
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
                    onChange={(e) => {
                      setIntent(e.target.value);
                      // Any edit to intent invalidates the prior auto-nudge.
                      setHintNote(null);
                    }}
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
                        applyPreset(label);
                        e.target.value = "";
                      }}
                    >
                      <option value="">— 选一个日常题材开始 —</option>
                      {PRESETS.map((group) => (
                        <optgroup key={group.group} label={group.group}>
                          {group.items.map((t) => (
                            <option key={t.label} value={t.label}>
                              {t.label}
                              {t.needsImage ? " · 需原图" : ""}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <span className="tpl-hint">
                      标有「需原图」的题材会自动切到编辑模式，请上传一张作为底图。
                    </span>
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
                        onClick={() => {
                          setStyle(s.value);
                          setHintNote(null);
                        }}
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
                    setHintNote(null);
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
                  ref={dropZoneRef}
                  className={`drop-zone${editPreview ? " has-image" : ""}${dragOver ? " is-drag" : ""}${dropZoneFlash ? " is-flash" : ""}`}
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

                <div className="tpl-field">
                  <span className="micro-label">题材模板 · Recipe</span>
                  <select
                    className="tpl-select"
                    value=""
                    onChange={(e) => {
                      const label = e.target.value;
                      if (!label) return;
                      applyPreset(label);
                      e.target.value = "";
                    }}
                  >
                    <option value="">— 选一个题材作为改写方向 —</option>
                    {PRESETS.map((group) => (
                      <optgroup key={group.group} label={group.group}>
                        {group.items.map((t) => (
                          <option key={t.label} value={t.label}>
                            {t.label}
                            {t.needsImage ? " · 需原图" : ""}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <span className="tpl-hint">
                    选择后将填入下方编辑指令；可在指令框继续微调。
                  </span>
                </div>
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
                onChange={(e) => {
                  setSize(e.target.value);
                  setHintNote(null);
                }}
              >
                {SIZES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {SIZE_HINTS[size] && (
                <span className="param-hint">{SIZE_HINTS[size]}</span>
              )}
            </label>
            <label className="param-inline">
              <span className="micro-label">质量</span>
              <select
                className="param-select"
                value={quality}
                onChange={(e) => {
                  setQuality(e.target.value);
                  setHintNote(null);
                }}
              >
                {QUALITIES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {QUALITY_HINTS[quality] && (
                <span className="param-hint">{QUALITY_HINTS[quality]}</span>
              )}
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
        {hintNote && (
          <div
            className="hint-note"
            role="note"
            aria-live="polite"
          >
            {hintNote}
          </div>
        )}
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
                  {refiningIdx === i && (
                    <div className="plate-refining" aria-live="polite">
                      <span className="spinner" aria-hidden />
                      <span>精修中…</span>
                    </div>
                  )}
                  <div className="plate-overlay">
                    <button
                      type="button"
                      className="plate-refine"
                      onClick={() => setOverlayIdx(i)}
                      title="在图上叠加自定义中文文字（客户端烘焙，100% 字形保真；不消耗额度）。"
                    >
                      加文字
                    </button>
                    <button
                      type="button"
                      className="plate-refine"
                      onClick={() => onRefineFace(i, src)}
                      disabled={refiningIdx !== -1 || quota.remaining <= 0}
                      title="对画面中的人像做一次精修：提升眼神、皮肤与五官清晰度，保留其余内容不变。消耗 1 次额度。"
                    >
                      精修人像
                    </button>
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
        <span>Set in Source Serif 4, Noto Serif SC &amp; Archivo</span>
        <a className="colophon-mail" href="mailto:chatgptplus@outlook.com">
          来信 · chatgptplus@outlook.com
        </a>
        <span className="colophon-seal">朱砂 · No. {quota.used}</span>
      </footer>

      {overlayIdx !== -1 && images[overlayIdx] && (
        <TextOverlay
          image={images[overlayIdx]}
          onClose={() => setOverlayIdx(-1)}
          onApply={(dataUrl) => {
            setImages((prev) =>
              prev.map((s, i) => (i === overlayIdx ? dataUrl : s)),
            );
            setOverlayIdx(-1);
          }}
        />
      )}
    </main>
  );
}
