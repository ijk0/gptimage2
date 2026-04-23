import type { Metadata } from "next";
import {
  Source_Serif_4,
  Noto_Serif_SC,
  Archivo,
  Noto_Sans_SC,
  JetBrains_Mono,
} from "next/font/google";
import "./globals.css";

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

export const metadata: Metadata = {
  title: "gpt-image-2 · 图像生成所",
  description: "基于 gpt-image-2 的 AI 图像生成所，部署于 Vercel。",
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
      <body>{children}</body>
    </html>
  );
}
