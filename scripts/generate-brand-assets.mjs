// One-shot brand asset generator for 像素工坊 · Pixel Foundry.
// Hits the same OpenAI-compatible endpoint the site uses and writes PNGs
// into app/ (Next.js conventions) and public/.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function loadEnv() {
  const raw = readFileSync(resolve(ROOT, ".env"), "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
  return env;
}

const env = loadEnv();
const API_URL = env.IMAGE_API_URL;
const API_KEY = env.IMAGE_API_KEY;
const MODEL = env.IMAGE_MODEL ?? "gpt-image-2";
if (!API_URL || !API_KEY) {
  console.error("Missing IMAGE_API_URL or IMAGE_API_KEY in .env");
  process.exit(1);
}

const ICON_PROMPT = [
  "Minimal square app icon on a warm cream rice-paper background with very subtle paper grain.",
  "Centered subject: a 3-by-3 grid of equal square tiles, filling the middle 70 percent of the canvas with a generous cream margin around it. The tiles are arranged on a strict geometric grid with thin cream gutters (about 6 percent of a tile) between them.",
  "Tile states, specified row by row from top to bottom:",
  "Row 1: [solid red][solid red][solid red].",
  "Row 2: [empty cream][solid red][empty cream].",
  "Row 3: [solid red][solid red][solid red].",
  "Overall this forms a capital letter 'I' shape, which is the Chinese character 工 (gong, 'craft/workshop') rendered as a 3x3 pixel mosaic — total of 7 solid red tiles and 2 empty cream tiles.",
  "Each red tile is a flat vermilion cinnabar-red (朱砂) square with very slight hand-pressed ink bleed at the edges, as if stamped onto paper with a cast type block. No gradients, no drop shadows, no highlights, no bevels.",
  "Composition references letterpress type blocks and low-resolution pixel-art typography simultaneously — digital craftsmanship, not calligraphy.",
  "No other text, no English letters, no extra characters, no border, no logo.",
  "Flat 2D illustration, clean geometry, precise alignment, iconic, legible at 32 pixels.",
].join(" ");

const LOGO_PROMPT = [
  "A minimalist horizontal wordmark logo on a warm cream rice-paper background with very subtle paper grain. Generous whitespace.",
  "Left side (about one fifth of the width): a small pixel-mark composed of a 3-by-3 grid of equal square tiles with thin cream gutters between them. Tile pattern row by row: row 1 all three tiles solid vermilion cinnabar-red (朱砂); row 2 left empty cream, center solid red, right empty cream; row 3 all three tiles solid red. This forms a capital-I / 工 shape out of 7 red tiles and 2 cream tiles. Each red tile is flat with slight hand-pressed letterpress ink-bleed at its edges. No gradients, no shadows, no bevels.",
  "Right of the pixel-mark, an editorial typographic wordmark set in two stacked lines, deep warm-black ink.",
  "Line one (larger): 像素工坊 · Pixel Foundry — the Chinese characters in an elegant Chinese serif like Noto Serif SC, medium weight; the middle dot and 'Pixel Foundry' in a refined latin serif; all on the same baseline.",
  "Line two (smaller, beneath, uppercase, slightly greyer ink, thin monospace): A TYPOGRAPHIC CONSOLE FOR GPT-IMAGE-2.",
  "All Chinese and English text must be spelled correctly and rendered cleanly.",
  "Letterpress / editorial newspaper aesthetic, restrained, sophisticated, calm. Flat minimal design, no gradients, no 3D, no decorative flourishes, no borders.",
].join(" ");

async function generate({ prompt, size, label }) {
  console.log(`→ generating ${label} (${size})…`);
  const res = await fetch(`${API_URL}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      n: 1,
      size,
      output_format: "png",
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`  ✖ ${label} failed (${res.status}): ${text.slice(0, 400)}`);
    return null;
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error(`  ✖ ${label} non-JSON: ${text.slice(0, 200)}`);
    return null;
  }
  const item = data?.data?.[0];
  if (item?.b64_json) return Buffer.from(item.b64_json, "base64");
  if (item?.url) {
    const buf = await fetch(item.url).then((r) => r.arrayBuffer());
    return Buffer.from(buf);
  }
  console.error(`  ✖ ${label} no image in response`);
  return null;
}

function save(buf, relPath) {
  const abs = resolve(ROOT, relPath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, buf);
  console.log(`  ✓ wrote ${relPath} (${buf.length.toLocaleString()} bytes)`);
}

const target = process.argv[2] ?? "all"; // icon | logo | all

const jobs = [];
if (target === "all" || target === "icon") {
  jobs.push(
    generate({ prompt: ICON_PROMPT, size: "1024x1024", label: "icon" }).then(
      (buf) => {
        if (!buf) return false;
        save(buf, "app/icon.png");
        save(buf, "app/apple-icon.png");
        save(buf, "public/logo-mark.png");
        return true;
      },
    ),
  );
}
if (target === "all" || target === "logo") {
  jobs.push(
    generate({ prompt: LOGO_PROMPT, size: "1536x1024", label: "logo/og" }).then(
      (buf) => {
        if (!buf) return false;
        save(buf, "app/opengraph-image.png");
        save(buf, "app/twitter-image.png");
        save(buf, "public/logo.png");
        return true;
      },
    ),
  );
}

const results = await Promise.all(jobs);
if (results.some((ok) => !ok)) process.exit(1);
console.log("done.");
