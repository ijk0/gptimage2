import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getRedis, isConfigured as isRedisConfigured } from "./redis";

export const USER_COOKIE = "gi2_user";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const USERNAME_RE = /^[a-z0-9_-]{3,32}$/;

export type UserRecord = {
  hashedPw: string;
  salt: string;
  createdAt: string;
};

export type CreateUserResult =
  | { ok: true }
  | { ok: false; reason: "invalid_username" | "invalid_password" | "exists" };

function userKey(username: string): string {
  return `user:${username}`;
}

function sessionKey(token: string): string {
  return `session:${token}`;
}

function parseUser(raw: unknown): UserRecord | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "object") return raw as UserRecord;
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as UserRecord;
  } catch {
    return null;
  }
}

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString("hex");
}

function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.get("cookie") ?? "";
  const match = raw.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

export function isUserAuthAvailable(): boolean {
  return isRedisConfigured();
}

export async function createUser(
  rawUsername: string,
  password: string,
): Promise<CreateUserResult> {
  const username = normalizeUsername(rawUsername);
  if (!USERNAME_RE.test(username)) return { ok: false, reason: "invalid_username" };
  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    return { ok: false, reason: "invalid_password" };
  }
  const salt = randomBytes(16).toString("hex");
  const record: UserRecord = {
    hashedPw: hashPassword(password, salt),
    salt,
    createdAt: new Date().toISOString(),
  };
  const redis = getRedis();
  const result = await redis.set(userKey(username), JSON.stringify(record), {
    nx: true,
  });
  if (result !== "OK") return { ok: false, reason: "exists" };
  return { ok: true };
}

export async function verifyCredentials(
  rawUsername: string,
  password: string,
): Promise<string | null> {
  const username = normalizeUsername(rawUsername);
  if (!USERNAME_RE.test(username) || typeof password !== "string") return null;
  const redis = getRedis();
  const raw = await redis.get(userKey(username));
  const record = parseUser(raw);
  if (!record) return null;
  const submitted = Buffer.from(hashPassword(password, record.salt), "hex");
  const expected = Buffer.from(record.hashedPw, "hex");
  if (submitted.length !== expected.length) return null;
  if (!timingSafeEqual(submitted, expected)) return null;
  return username;
}

export async function createSession(username: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const redis = getRedis();
  await redis.set(sessionKey(token), username, { ex: SESSION_TTL_SECONDS });
  return token;
}

export async function destroySession(token: string): Promise<void> {
  if (!token) return;
  const redis = getRedis();
  await redis.del(sessionKey(token));
}

export async function readSession(req: Request): Promise<string | null> {
  if (!isRedisConfigured()) return null;
  const token = readCookie(req, USER_COOKIE);
  if (!token) return null;
  const redis = getRedis();
  const username = await redis.get<string>(sessionKey(token));
  return typeof username === "string" && username.length > 0 ? username : null;
}

export function readSessionToken(req: Request): string | null {
  return readCookie(req, USER_COOKIE);
}

export function setUserCookie(res: NextResponse, token: string): void {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.headers.append(
    "Set-Cookie",
    `${USER_COOKIE}=${token}; Path=/; Max-Age=${SESSION_TTL_SECONDS}; SameSite=Lax; HttpOnly${secure}`,
  );
}

export function clearUserCookie(res: NextResponse): void {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.headers.append(
    "Set-Cookie",
    `${USER_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly${secure}`,
  );
}
