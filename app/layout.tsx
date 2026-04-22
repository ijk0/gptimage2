import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "gpt-image-2 图像生成器",
  description: "基于 gpt-image-2 的 AI 图像生成，部署于 Vercel。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
