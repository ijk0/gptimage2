import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

const COOKIE_NAME = "admin_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD?.trim());
}

export function hashPassword(pw: string): string {
  return createHash("sha256").update(pw, "utf8").digest("hex");
}

export function verifyPassword(submitted: string): boolean {
  const expected = process.env.ADMIN_PASSWORD?.trim();
  if (!expected) return false;
  const a = Buffer.from(hashPassword(submitted));
  const b = Buffer.from(hashPassword(expected));
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.get("cookie") ?? "";
  const match = raw.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function isAdminRequest(req: Request): boolean {
  const expected = process.env.ADMIN_PASSWORD?.trim();
  if (!expected) return false;
  const cookie = readCookie(req, COOKIE_NAME);
  if (!cookie) return false;
  const a = Buffer.from(cookie);
  const b = Buffer.from(hashPassword(expected));
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function isAdminCookieValue(value: string | undefined): boolean {
  const expected = process.env.ADMIN_PASSWORD?.trim();
  if (!expected || !value) return false;
  const a = Buffer.from(value);
  const b = Buffer.from(hashPassword(expected));
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function setAdminCookie(res: NextResponse): void {
  const expected = process.env.ADMIN_PASSWORD?.trim();
  if (!expected) return;
  const value = hashPassword(expected);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.headers.append(
    "Set-Cookie",
    `${COOKIE_NAME}=${value}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax; HttpOnly${secure}`,
  );
}

export function clearAdminCookie(res: NextResponse): void {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.headers.append(
    "Set-Cookie",
    `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly${secure}`,
  );
}

export function requireAdmin(req: Request): NextResponse | null {
  if (!adminConfigured()) {
    return NextResponse.json(
      { error: "管理后台未启用：请设置 ADMIN_PASSWORD 环境变量。" },
      { status: 503 },
    );
  }
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }
  return null;
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME;
