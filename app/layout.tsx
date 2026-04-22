import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "gpt-image-2 Generator",
  description: "Generate images with gpt-image-2 on Vercel",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
