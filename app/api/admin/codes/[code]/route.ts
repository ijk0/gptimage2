import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { isConfigured } from "@/lib/redis";
import { deleteCode } from "@/lib/redeem-codes";

export const runtime = "nodejs";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const guard = requireAdmin(req);
  if (guard) return guard;
  if (!isConfigured()) {
    return NextResponse.json(
      {
        error:
          "Upstash Redis 未配置：请在 Vercel 环境变量中设置 KV_REST_API_URL 与 KV_REST_API_TOKEN。",
      },
      { status: 503 },
    );
  }
  const { code } = await params;
  const removed = await deleteCode(decodeURIComponent(code));
  if (!removed) {
    return NextResponse.json({ error: "兑换码不存在" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
