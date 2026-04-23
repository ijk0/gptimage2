import { NextResponse } from "next/server";
import { readQuota, setQuotaCookies } from "@/lib/quota";

export const runtime = "nodejs";

/**
 * RECHARGE_CODES env format (comma-separated):
 *   WELCOME          → uses RECHARGE_AMOUNT (default 5)
 *   FRIEND:10        → adds 10 generations
 *   VIP:20           → adds 20 generations
 *
 * Unset → recharge disabled.
 */
type CodeMap = Map<string, number>;

function parseCodes(): CodeMap {
  const raw = process.env.RECHARGE_CODES?.trim();
  const defaultAmount = Number(process.env.RECHARGE_AMOUNT ?? 5);
  const map: CodeMap = new Map();
  if (!raw) return map;
  for (const entry of raw.split(",")) {
    const piece = entry.trim();
    if (!piece) continue;
    const [codeRaw, amtRaw] = piece.split(":");
    const code = codeRaw.trim();
    if (!code) continue;
    const amt = amtRaw ? Number(amtRaw.trim()) : defaultAmount;
    if (!Number.isFinite(amt) || amt <= 0) continue;
    map.set(code, Math.floor(amt));
  }
  return map;
}

export async function POST(req: Request) {
  const codes = parseCodes();
  if (codes.size === 0) {
    return NextResponse.json(
      { error: "兑换功能未开启。管理员需配置 RECHARGE_CODES 环境变量。" },
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

  const amount = codes.get(code);
  if (!amount) {
    return NextResponse.json(
      { error: "兑换码无效或已过期" },
      { status: 400 },
    );
  }

  const quota = readQuota(req);
  const newGrant = quota.grant + amount;
  const newLimit = quota.limit + amount;
  const res = NextResponse.json({
    added: amount,
    limit: newLimit,
    used: quota.used,
    grant: newGrant,
    remaining: Math.max(newLimit - quota.used, 0),
  });
  setQuotaCookies(res, { grant: newGrant });
  return res;
}

export async function GET() {
  const codes = parseCodes();
  return NextResponse.json({ enabled: codes.size > 0 });
}
