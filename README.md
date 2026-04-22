# gpt-image-2 Generator on Vercel

A minimal Next.js app that generates images via a gpt-image-2-compatible API.
The model endpoint and key are read from Vercel environment variables — no
secrets ever reach the browser.

## Environment variables

Set these in **Vercel → Project Settings → Environment Variables** (and in a
local `.env.local` for development):

| Name            | Required | Description                                                                       |
| --------------- | -------- | --------------------------------------------------------------------------------- |
| `IMAGE_API_URL` | yes      | Base URL of the API, e.g. `https://api.openai.com/v1`. No trailing path.          |
| `IMAGE_API_KEY` | yes      | Bearer token for the API.                                                         |
| `IMAGE_MODEL`   | no       | Model name. Defaults to `gpt-image-2`.                                            |

The server calls `POST {IMAGE_API_URL}/images/generations` with a Bearer auth
header and an OpenAI-shaped body (`model`, `prompt`, `n`, `size`, `quality`).
It accepts responses where each item has either `b64_json` or `url`.

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
