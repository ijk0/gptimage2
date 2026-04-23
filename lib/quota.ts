import { NextResponse } from "next/server";
import { getRedis } from "./redis";
import { readSession } from "./user-auth";

export const FREE_LIMIT = Number(process.env.FREE_LIMIT ?? 5);

// Normalize the provider base URL so both forms work:
//   https://example.com           -> https://example.com/v1
//   https://example.com/v1        -> https://example.com/v1
//   https://example.com/v1/       -> https://example.com/v1
//   https://example.com/api/v1    -> https://example.com/api/v1
export function apiBase(): string {
  const raw = (process.env.IMAGE_API_URL ?? "").trim().replace(/\/+$/, "");
  if (!raw) return "";
  return /\/v\d+(?:\/|$)/.test(raw + "/") ? raw : `${raw}/v1`;
}
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const USED_COOKIE = "gi2_used";
const GRANT_COOKIE = "gi2_grant";

export type Quota = {
  limit: number;
  used: number;
  remaining: number;
  grant: number;
};

export type UnifiedQuota = Quota & { username: string | null };

type StoredUserQuota = { used: number; grant: number };

function userQuotaKey(username: string): string {
  return `userq:${username}`;
}

function parseUserQuota(raw: unknown): StoredUserQuota {
  if (raw && typeof raw === "object") {
    const r = raw as Partial<StoredUserQuota>;
    return {
      used: Number.isFinite(r.used) ? Math.max(0, Math.floor(r.used as number)) : 0,
      grant: Number.isFinite(r.grant) ? Math.max(0, Math.floor(r.grant as number)) : 0,
    };
  }
  if (typeof raw === "string") {
    try {
      return parseUserQuota(JSON.parse(raw));
    } catch {
      return { used: 0, grant: 0 };
    }
  }
  return { used: 0, grant: 0 };
}

function buildQuota(stored: StoredUserQuota): Quota {
  const limit = FREE_LIMIT + stored.grant;
  return {
    limit,
    used: stored.used,
    grant: stored.grant,
    remaining: Math.max(limit - stored.used, 0),
  };
}

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

async function loadUserQuota(username: string): Promise<StoredUserQuota> {
  const redis = getRedis();
  const raw = await redis.get(userQuotaKey(username));
  return parseUserQuota(raw);
}

async function saveUserQuota(
  username: string,
  next: StoredUserQuota,
): Promise<void> {
  const redis = getRedis();
  await redis.set(userQuotaKey(username), JSON.stringify(next));
}

export async function getQuotaUnified(req: Request): Promise<UnifiedQuota> {
  const username = await readSession(req);
  if (username) {
    const stored = await loadUserQuota(username);
    return { ...buildQuota(stored), username };
  }
  return { ...readQuota(req), username: null };
}

export type QuotaUpdate = {
  quota: Quota;
  applyCookies: (res: NextResponse) => void;
};

const noopCookies = () => {};

export async function recordUsage(
  req: Request,
  delta: number,
): Promise<QuotaUpdate> {
  const inc = Math.max(0, Math.floor(delta));
  const username = await readSession(req);
  if (username) {
    const stored = await loadUserQuota(username);
    const next: StoredUserQuota = { used: stored.used + inc, grant: stored.grant };
    await saveUserQuota(username, next);
    return { quota: buildQuota(next), applyCookies: noopCookies };
  }
  const current = readQuota(req);
  const newUsed = current.used + inc;
  const next: StoredUserQuota = { used: newUsed, grant: current.grant };
  return {
    quota: buildQuota(next),
    applyCookies: (res) => setQuotaCookies(res, { used: newUsed, grant: current.grant }),
  };
}

export async function addGrant(
  req: Request,
  amount: number,
): Promise<QuotaUpdate> {
  const add = Math.max(0, Math.floor(amount));
  const username = await readSession(req);
  if (username) {
    const stored = await loadUserQuota(username);
    const next: StoredUserQuota = { used: stored.used, grant: stored.grant + add };
    await saveUserQuota(username, next);
    return { quota: buildQuota(next), applyCookies: noopCookies };
  }
  const current = readQuota(req);
  const newGrant = current.grant + add;
  const next: StoredUserQuota = { used: current.used, grant: newGrant };
  return {
    quota: buildQuota(next),
    applyCookies: (res) => setQuotaCookies(res, { grant: newGrant }),
  };
}
