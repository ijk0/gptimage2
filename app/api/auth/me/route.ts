import { NextResponse } from "next/server";
import { getQuotaUnified } from "@/lib/quota";
import { isUserAuthAvailable } from "@/lib/user-auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const quota = await getQuotaUnified(req);
  return NextResponse.json({
    username: quota.username,
    quota: {
      limit: quota.limit,
      used: quota.used,
      grant: quota.grant,
      remaining: quota.remaining,
    },
    authEnabled: isUserAuthAvailable(),
  });
}
