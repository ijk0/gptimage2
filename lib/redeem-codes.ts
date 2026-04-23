import { getRedis } from "./redis";

const HASH_KEY = "redeem:codes";
const USERS_KEY_PREFIX = "redeem:users:"; // set of identities that redeemed this code

export type RedeemCode = {
  code: string;
  amount: number;
  repeatable: boolean;
  createdAt: string;
  redeemed: boolean;
  redeemedAt?: string;
  redeemedCount: number;
};

type StoredCode = {
  amount: number;
  repeatable?: boolean;
  createdAt: string;
  redeemed: boolean;
  redeemedAt?: string;
  redeemedCount?: number;
};

function parseStored(raw: unknown): StoredCode | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "object") return raw as StoredCode;
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as StoredCode;
  } catch {
    return null;
  }
}

function hydrate(code: string, stored: StoredCode): RedeemCode {
  return {
    code,
    amount: stored.amount,
    repeatable: Boolean(stored.repeatable),
    createdAt: stored.createdAt,
    redeemed: Boolean(stored.redeemed),
    redeemedAt: stored.redeemedAt,
    redeemedCount: Number.isFinite(stored.redeemedCount)
      ? (stored.redeemedCount as number)
      : Boolean(stored.redeemed)
        ? 1
        : 0,
  };
}

function normalizeCode(input: string): string {
  return input.trim().toUpperCase();
}

function usersKey(code: string): string {
  return `${USERS_KEY_PREFIX}${code}`;
}

export async function listCodes(): Promise<RedeemCode[]> {
  const redis = getRedis();
  const raw = (await redis.hgetall<Record<string, unknown>>(HASH_KEY)) ?? {};
  const out: RedeemCode[] = [];
  for (const [code, value] of Object.entries(raw)) {
    const parsed = parseStored(value);
    if (!parsed) continue;
    out.push(hydrate(code, parsed));
  }
  out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return out;
}

export type CreateResult =
  | { ok: true; code: RedeemCode }
  | { ok: false; reason: "exists" | "invalid_code" | "invalid_amount" };

export async function createCode(
  rawCode: string,
  rawAmount: number,
  repeatable: boolean,
): Promise<CreateResult> {
  const code = normalizeCode(rawCode);
  if (!code || !/^[A-Z0-9_-]{2,40}$/.test(code)) {
    return { ok: false, reason: "invalid_code" };
  }
  const amount = Math.floor(Number(rawAmount));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) {
    return { ok: false, reason: "invalid_amount" };
  }
  const redis = getRedis();
  const stored: StoredCode = {
    amount,
    repeatable: Boolean(repeatable),
    createdAt: new Date().toISOString(),
    redeemed: false,
    redeemedCount: 0,
  };
  const inserted = await redis.hsetnx(HASH_KEY, code, JSON.stringify(stored));
  if (!inserted) return { ok: false, reason: "exists" };
  return { ok: true, code: hydrate(code, stored) };
}

export async function deleteCode(rawCode: string): Promise<boolean> {
  const code = normalizeCode(rawCode);
  if (!code) return false;
  const redis = getRedis();
  const removed = await redis.hdel(HASH_KEY, code);
  // Best-effort cleanup of the redeemers set.
  await redis.del(usersKey(code));
  return removed > 0;
}

export type ConsumeResult =
  | { ok: true; amount: number }
  | {
      ok: false;
      reason: "not_found" | "already_redeemed" | "already_redeemed_by_user";
    };

// Atomic one-time consume: flip redeemed=true, set redeemedAt, bump count.
const CONSUME_ONCE_LUA = `
local v = redis.call('HGET', KEYS[1], ARGV[1])
if not v then return {0, 'not_found'} end
local ok, data = pcall(cjson.decode, v)
if not ok then return {0, 'not_found'} end
if data.redeemed then return {0, 'already_redeemed'} end
data.redeemed = true
data.redeemedAt = ARGV[2]
data.redeemedCount = (data.redeemedCount or 0) + 1
redis.call('HSET', KEYS[1], ARGV[1], cjson.encode(data))
return {1, tostring(data.amount)}
`;

// Atomic repeatable consume: add identity to set; if it was already a member,
// reject. Otherwise increment redeemedCount on the code record.
const CONSUME_REPEAT_LUA = `
local v = redis.call('HGET', KEYS[1], ARGV[1])
if not v then return {0, 'not_found'} end
local ok, data = pcall(cjson.decode, v)
if not ok then return {0, 'not_found'} end
if not data.repeatable then return {0, 'not_found'} end
local added = redis.call('SADD', KEYS[2], ARGV[3])
if added == 0 then return {0, 'already_redeemed_by_user'} end
data.redeemedCount = (data.redeemedCount or 0) + 1
data.redeemedAt = ARGV[2]
redis.call('HSET', KEYS[1], ARGV[1], cjson.encode(data))
return {1, tostring(data.amount)}
`;

export async function consumeCode(
  rawCode: string,
  identity: string,
): Promise<ConsumeResult> {
  const code = normalizeCode(rawCode);
  if (!code) return { ok: false, reason: "not_found" };
  if (!identity) return { ok: false, reason: "not_found" };
  const redis = getRedis();

  // Peek first to pick the right Lua script. Race is fine: both scripts are
  // atomic and will reject appropriately if the state changed underneath us.
  const raw = await redis.hget(HASH_KEY, code);
  const parsed = parseStored(raw);
  if (!parsed) return { ok: false, reason: "not_found" };

  if (parsed.repeatable) {
    const result = (await redis.eval(
      CONSUME_REPEAT_LUA,
      [HASH_KEY, usersKey(code)],
      [code, new Date().toISOString(), identity],
    )) as [number, string];
    const [okFlag, payload] = result;
    if (okFlag === 1) {
      const amount = Number(payload);
      if (!Number.isFinite(amount) || amount <= 0) {
        return { ok: false, reason: "not_found" };
      }
      return { ok: true, amount };
    }
    if (payload === "already_redeemed_by_user") {
      return { ok: false, reason: "already_redeemed_by_user" };
    }
    return { ok: false, reason: "not_found" };
  }

  const result = (await redis.eval(
    CONSUME_ONCE_LUA,
    [HASH_KEY],
    [code, new Date().toISOString()],
  )) as [number, string];
  const [okFlag, payload] = result;
  if (okFlag === 1) {
    const amount = Number(payload);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, reason: "not_found" };
    }
    return { ok: true, amount };
  }
  if (payload === "already_redeemed") {
    return { ok: false, reason: "already_redeemed" };
  }
  return { ok: false, reason: "not_found" };
}
