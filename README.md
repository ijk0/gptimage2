# gpt-image-2 Generator on Vercel

A minimal Next.js app that generates images via a gpt-image-2-compatible API.
The model endpoint and key are read from Vercel environment variables — no
secrets ever reach the browser.

## One-click deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fijk0%2Fgptimage2&env=IMAGE_API_URL,IMAGE_API_KEY&envDescription=Base%20URL%20and%20bearer%20key%20for%20your%20gpt-image-2%20API&project-name=gptimage2&repository-name=gptimage2)

Click the button, sign in to Vercel, and you'll be prompted for
`IMAGE_API_URL` and `IMAGE_API_KEY` before the first build.

## Environment variables

Set these in **Vercel → Project Settings → Environment Variables** (and in a
local `.env.local` for development):

| Name            | Required | Description                                                                       |
| --------------- | -------- | --------------------------------------------------------------------------------- |
| `IMAGE_API_URL` | yes      | Base URL of the API. Either the v1-rooted form (`https://api.openai.com/v1`) or a bare host (`https://cc.example.com`) works — `/v1` is auto-appended when missing. |
| `IMAGE_API_KEY` | yes      | Bearer token for the API.                                                         |
| `IMAGE_MODEL`   | no       | Model name. Defaults to `gpt-image-2`.                                            |
| `TEXT_MODEL`    | no       | Chat model for "AI 构思" prompt crafting. Defaults to `gpt-5.4`. Must be served at `{IMAGE_API_URL}/chat/completions` by the same key. |
| `FREE_LIMIT`    | no       | Baseline free generations per visitor. Defaults to `0` — users start with zero quota and must redeem a code to unlock generations. Set to a positive number to hand out a free baseline. |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | no | Upstash Redis credentials. Required for the `/admin` redemption-code panel **and** for user registration / login (`/login`). Free tier works. |
| `ADMIN_PASSWORD` | no       | Enables `/admin` for managing redemption codes. Codes can be one-time (single global use) or repeatable (any user may redeem, but only once per user). |

The server calls `POST {IMAGE_API_URL}/images/generations` with a Bearer auth
header and an OpenAI-shaped body (`model`, `prompt`, `n`, `size`, `quality`).
It accepts responses where each item has either `b64_json` or `url`.

### 用户注册与登录（需 Upstash Redis）

Visit `/login` to register a username + password. Logged-in users get
server-side quota and redemption credits stored in Redis (keys `user:<name>`,
`userq:<name>`, `session:<token>`), so the same account works across browsers
and devices. Sessions are 30-day HttpOnly cookies. Anonymous visitors keep the
existing cookie-based quota — no behavior change if Redis is unset.

Implementation is dependency-free: passwords use `crypto.scryptSync` with a
per-user random salt, sessions are random 32-byte tokens. There is no email
verification or password reset flow (no SMTP needed = stays free).

## Local development

```bash
npm install
cp .env.example .env.local  # then fill in values
npm run dev
```

Open <http://localhost:3000>.

## Deploying to Vercel

1. Push this repo to Git.
2. Import the project in Vercel.
3. Add `IMAGE_API_URL` and `IMAGE_API_KEY` under Environment Variables.
4. Deploy.

The API route (`app/api/generate/route.ts`) runs on the Node.js runtime with a
5-minute max duration so large images have time to generate.

## Custom subdomain via Cloudflare

Point a subdomain like `image.yourdomain.com` at your Vercel deployment using
Cloudflare DNS.

1. **Add the domain in Vercel**
   - Go to the project → **Settings → Domains**
   - Enter your subdomain (e.g. `image.yourdomain.com`) and click **Add**
   - Vercel shows a CNAME target: `cname.vercel-dns.com`

2. **Add the DNS record in Cloudflare**
   - Cloudflare dashboard → your domain → **DNS → Records → Add record**
   - **Type**: `CNAME`
   - **Name**: `image` (or whatever subdomain you chose)
   - **Target**: `cname.vercel-dns.com`
   - **Proxy status**: **DNS only** (gray cloud) — do *not* enable the orange-cloud proxy, or Vercel cannot issue its Let's Encrypt cert and the two SSL layers will conflict
   - Save

3. **Wait for SSL**
   - Back in Vercel the domain will go from *Invalid Configuration* to *Valid Configuration* within a minute or two and HTTPS will work automatically.

> Note: Vercel has no official mainland-China route. `cname.vercel-dns.com` and
> Cloudflare free-tier IPs are both frequently blocked or slowed by the GFW.
> For reliable mainland access you need a China-friendly CDN in front (e.g.
> Tencent Cloud EdgeOne / Alibaba Cloud CDN with ICP filing) or a
> Hong-Kong / Japan VPS reverse-proxying Vercel.
