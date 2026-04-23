import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { isConfigured } from "@/lib/redis";
import { createCode, listCodes } from "@/lib/redeem-codes";

export const runtime = "nodejs";

function kvNotConfigured() {
  return NextResponse.json(
    {
      error:
        "Upstash Redis 未配置：请在 Vercel 环境变量中设置 KV_REST_API_URL 与 KV_REST_API_TOKEN。",
    },
    { status: 503 },
  );
}

export async function GET(req: Request) {
  const guard = requireAdmin(req);
  if (guard) return guard;
  if (!isConfigured()) return kvNotConfigured();
  const codes = await listCodes();
  return NextResponse.json({ codes });
}

export async function POST(req: Request) {
  const guard = requireAdmin(req);
  if (guard) return guard;
  if (!isConfigured()) return kvNotConfigured();

  let body: { code?: string; amount?: number | string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法的 JSON" }, { status: 400 });
  }
  const code = (body.code ?? "").toString();
  const amount = Number(body.amount);
  const result = await createCode(code, amount);
  if (!result.ok) {
    const message =
      result.reason === "exists"
        ? "兑换码已存在"
        : result.reason === "invalid_code"
          ? "兑换码格式无效（仅限大写字母、数字、_- ，2-40 位）"
          : "充值数量无效（须为正整数，且不超过 100000）";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  return NextResponse.json({ code: result.code }, { status: 201 });
}
