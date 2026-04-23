import { NextResponse } from "next/server";
import { readQuota, setQuotaCookies } from "@/lib/quota";
import { isConfigured } from "@/lib/redis";
import { consumeCode } from "@/lib/redeem-codes";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!isConfigured()) {
    return NextResponse.json(
      { error: "兑换功能未开启。管理员需配置 Upstash Redis 与兑换码。" },
      { status: 501 },
    );
  }

  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法的 JSON" }, { status: 400 });
  }

  const code = body.code?.trim();
  if (!code) {
    return NextResponse.json({ error: "请输入兑换码" }, { status: 400 });
  }

  const result = await consumeCode(code);
  if (!result.ok) {
    return NextResponse.json(
      { error: "兑换码无效或已过期" },
      { status: 400 },
    );
  }

  const quota = readQuota(req);
  const newGrant = quota.grant + result.amount;
  const newLimit = quota.limit + result.amount;
  const res = NextResponse.json({
    added: result.amount,
    limit: newLimit,
    used: quota.used,
    grant: newGrant,
    remaining: Math.max(newLimit - quota.used, 0),
  });
  setQuotaCookies(res, { grant: newGrant });
  return res;
}

export async function GET() {
  return NextResponse.json({ enabled: isConfigured() });
}
