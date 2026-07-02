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

  try {
    const pong = await getRedis().ping();
    return NextResponse.json({ ok: pong === "PONG" });
  } catch (err) {
    console.error("keepalive ping failed:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
