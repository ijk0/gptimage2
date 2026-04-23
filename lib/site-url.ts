export const SITE_NAME = "像素工坊 · Pixel Foundry";
export const SITE_TAGLINE = "A typographic console for gpt-image-2";
export const SITE_DESCRIPTION_CN =
  "像素工坊 (Pixel Foundry) 是基于 gpt-image-2 的 AI 图像生成与编辑工作台，支持文生图、图生图、风格预设，内置 MUSE 智能提示词构思。";
export const SITE_DESCRIPTION_EN =
  "Pixel Foundry is a typographic web console for AI image generation and editing powered by gpt-image-2, with text-to-image, image editing, style presets and MUSE prompt crafting.";

export function siteUrl(): string {
  const explicit =
    process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  if (explicit) return stripTrailingSlash(explicit);

  const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelProd) return `https://${stripTrailingSlash(vercelProd)}`;

  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${stripTrailingSlash(vercel)}`;

  return "http://localhost:3000";
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
