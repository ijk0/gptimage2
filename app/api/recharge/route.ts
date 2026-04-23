import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { addGrant } from "@/lib/quota";
import { isConfigured } from "@/lib/redis";
import { consumeCode } from "@/lib/redeem-codes";
import { readSession } from "@/lib/user-auth";

export const runtime = "nodejs";

const ANON_ID_COOKIE = "gi2_aid";
const ANON_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 2; // 2 years

function readAnonId(req: Request): string | null {
  const raw = req.headers.get("cookie") ?? "";
  const match = raw.match(/(?:^|; )gi2_aid=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function setAnonIdCookie(res: NextResponse, id: string): void {
  res.headers.append(
    "Set-Cookie",
    `${ANON_ID_COOKIE}=${id}; Path=/; Max-Age=${ANON_COOKIE_MAX_AGE}; SameSite=Lax; HttpOnly`,
  );
}

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

  const username = await readSession(req);
  let anonId: string | null = null;
  let issuedAnonId = false;
  let identity: string;
  if (username) {
    identity = `user:${username}`;
  } else {
    anonId = readAnonId(req);
    if (!anonId) {
      anonId = randomBytes(16).toString("hex");
      issuedAnonId = true;
    }
    identity = `aid:${anonId}`;
  }

  const result = await consumeCode(code, identity);
  if (!result.ok) {
    const message =
      result.reason === "already_redeemed_by_user"
        ? "该兑换码你已使用过"
        : "兑换码无效或已被兑换";
    const res = NextResponse.json({ error: message }, { status: 400 });
    if (issuedAnonId && anonId) setAnonIdCookie(res, anonId);
    return res;
  }

  const update = await addGrant(req, result.amount);
  const res = NextResponse.json({
    added: result.amount,
    limit: update.quota.limit,
    used: update.quota.used,
    grant: update.quota.grant,
    remaining: update.quota.remaining,
  });
  update.applyCookies(res);
  if (issuedAnonId && anonId) setAnonIdCookie(res, anonId);
  return res;
}

export async function GET() {
  return NextResponse.json({ enabled: isConfigured() });
}
