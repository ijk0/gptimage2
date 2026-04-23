import type { Metadata } from "next";
import {
  Source_Serif_4,
  Noto_Serif_SC,
  Archivo,
  Noto_Sans_SC,
  JetBrains_Mono,
} from "next/font/google";
import "./globals.css";
import {
  SITE_DESCRIPTION_CN,
  SITE_DESCRIPTION_EN,
  SITE_NAME,
  SITE_TAGLINE,
  siteUrl,
} from "@/lib/site-url";

const serifLatin = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-serif-latin",
  display: "swap",
});

const serifCJK = Noto_Serif_SC({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-serif-cjk",
  display: "swap",
  preload: false,
});

const sansLatin = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans-latin",
  display: "swap",
});

const sansCJK = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-sans-cjk",
  display: "swap",
  preload: false,
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

const SITE_URL = siteUrl();
const DESCRIPTION = `${SITE_DESCRIPTION_CN} ${SITE_DESCRIPTION_EN}`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: "%s · 像素工坊",
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  generator: "Next.js",
  keywords: [
    "像素工坊",
    "Pixel Foundry",
    "gpt-image-2",
    "AI 图像生成",
    "AI 绘画",
    "文生图",
    "图生图",
    "图像编辑",
    "智能提示词",
    "MUSE",
    "生成式 AI",
    "AI image generation",
    "text to image",
    "image editing",
    "prompt engineering",
    "generative AI",
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "technology",
  classification: "AI Image Generation Tool",
  referrer: "origin-when-cross-origin",
  formatDetection: { email: false, address: false, telephone: false },
  alternates: {
    canonical: "/",
    languages: {
      "zh-CN": "/",
      "en-US": "/",
      "x-default": "/",
    },
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: DESCRIPTION,
    locale: "zh_CN",
    alternateLocale: ["en_US"],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION_EN,
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  other: {
    "apple-mobile-web-app-title": "像素工坊",
  },
};

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#software`,
      name: SITE_NAME,
      alternateName: ["像素工坊", "Pixel Foundry"],
      url: SITE_URL,
      description: DESCRIPTION,
      applicationCategory: "DesignApplication",
      applicationSubCategory: "AI Image Generation",
      operatingSystem: "Web",
      inLanguage: ["zh-CN", "en"],
      slogan: SITE_TAGLINE,
      softwareRequirements: "Modern web browser",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
      },
      featureList: [
        "文生图 · Text-to-image generation (gpt-image-2)",
        "图生图 · Image editing and transformation",
        "风格预设 · Curated style presets (ink, film, print, etc.)",
        "MUSE 智能提示词构思 · AI-assisted prompt crafting",
        "中英双语排版界面 · Bilingual typographic interface",
        "配额与兑换码系统 · Quota and redemption-code system",
      ],
      creator: {
        "@type": "Organization",
        name: SITE_NAME,
        url: SITE_URL,
      },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: DESCRIPTION,
      inLanguage: "zh-CN",
      publisher: { "@id": `${SITE_URL}/#software` },
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const fontClasses = [
    serifLatin.variable,
    serifCJK.variable,
    sansLatin.variable,
    sansCJK.variable,
    mono.variable,
  ].join(" ");

  return (
    <html lang="zh-CN" className={fontClasses}>
      <body>
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
        />
      </body>
    </html>
  );
}
