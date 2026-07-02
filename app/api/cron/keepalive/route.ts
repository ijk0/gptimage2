import { NextResponse } from "next/server";
import { getRedis, isConfigured } from "@/lib/redis";

export const runtime = "nodejs";

// 每天由 Vercel Cron 调用一次，向 Upstash 发一条 PING，
// 防止免费版数据库因长期无访问被归档。
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!isConfigured()) {
    return NextResponse.json(
      { ok: false, reason: "redis_not_configured" },
      { status: 501 },
    );
  }

  // 诊断用:回显实际连接的 Redis 主机名(不含 token)与真实报错,便于定位 env 问题。
  const rawUrl =
    process.env.KV_REST_API_URL?.trim() ||
    process.env.UPSTASH_REDIS_REST_URL?.trim() ||
    "";
  let host = "";
  try {
    host = new URL(rawUrl).host;
  } catch {
    host = "(unparseable)";
  }

  try {
    const pong = await getRedis().ping();
    return NextResponse.json({ ok: pong === "PONG", host });
  } catch (err) {
    console.error("keepalive ping failed:", err);
    return NextResponse.json(
      { ok: false, host, error: (err as Error)?.message ?? "unknown" },
      { status: 500 },
    );
  }
}
