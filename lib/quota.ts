import { NextResponse } from "next/server";

export const FREE_LIMIT = Number(process.env.FREE_LIMIT ?? 5);
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const USED_COOKIE = "gi2_used";
const GRANT_COOKIE = "gi2_grant";

export type Quota = {
  limit: number;
  used: number;
  remaining: number;
  grant: number;
};

function readIntCookie(req: Request, name: string): number {
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`${name}=(\\d+)`));
  if (!match) return 0;
  const n = Number(match[1]);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

export function readQuota(req: Request): Quota {
  const used = readIntCookie(req, USED_COOKIE);
  const grant = readIntCookie(req, GRANT_COOKIE);
  const limit = FREE_LIMIT + grant;
  return {
    limit,
    used,
    grant,
    remaining: Math.max(limit - used, 0),
  };
}

export function setQuotaCookies(
  res: NextResponse,
  values: { used?: number; grant?: number },
) {
  if (typeof values.used === "number") {
    res.headers.append(
      "Set-Cookie",
      `${USED_COOKIE}=${values.used}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax; HttpOnly`,
    );
  }
  if (typeof values.grant === "number") {
    res.headers.append(
      "Set-Cookie",
      `${GRANT_COOKIE}=${values.grant}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax; HttpOnly`,
    );
  }
}
