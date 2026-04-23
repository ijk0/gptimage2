import { NextResponse } from "next/server";
import {
  clearUserCookie,
  destroySession,
  isUserAuthAvailable,
  readSessionToken,
} from "@/lib/user-auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const token = readSessionToken(req);
  if (token && isUserAuthAvailable()) {
    await destroySession(token);
  }
  const res = NextResponse.json({ ok: true });
  clearUserCookie(res);
  return res;
}
