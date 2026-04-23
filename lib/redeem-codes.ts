import { getRedis } from "./redis";

const HASH_KEY = "redeem:codes";

export type RedeemCode = {
  code: string;
  amount: number;
  createdAt: string;
  redeemed: boolean;
  redeemedAt?: string;
};

type StoredCode = Omit<RedeemCode, "code">;

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

function normalizeCode(input: string): string {
  return input.trim().toUpperCase();
}

export async function listCodes(): Promise<RedeemCode[]> {
  const redis = getRedis();
  const raw = (await redis.hgetall<Record<string, unknown>>(HASH_KEY)) ?? {};
  const out: RedeemCode[] = [];
  for (const [code, value] of Object.entries(raw)) {
    const parsed = parseStored(value);
    if (!parsed) continue;
    out.push({ code, ...parsed });
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
    createdAt: new Date().toISOString(),
    redeemed: false,
  };
  // HSETNX-equivalent: only insert if field absent.
  const inserted = await redis.hsetnx(HASH_KEY, code, JSON.stringify(stored));
  if (!inserted) return { ok: false, reason: "exists" };
  return { ok: true, code: { code, ...stored } };
}

export async function deleteCode(rawCode: string): Promise<boolean> {
  const code = normalizeCode(rawCode);
  if (!code) return false;
  const redis = getRedis();
  const removed = await redis.hdel(HASH_KEY, code);
  return removed > 0;
}

export type ConsumeResult =
  | { ok: true; amount: number }
  | { ok: false; reason: "not_found" | "already_redeemed" };

const CONSUME_LUA = `
local v = redis.call('HGET', KEYS[1], ARGV[1])
if not v then return {0, 'not_found'} end
local ok, data = pcall(cjson.decode, v)
if not ok then return {0, 'not_found'} end
if data.redeemed then return {0, 'already_redeemed'} end
data.redeemed = true
data.redeemedAt = ARGV[2]
redis.call('HSET', KEYS[1], ARGV[1], cjson.encode(data))
return {1, tostring(data.amount)}
`;

export async function consumeCode(rawCode: string): Promise<ConsumeResult> {
  const code = normalizeCode(rawCode);
  if (!code) return { ok: false, reason: "not_found" };
  const redis = getRedis();
  const result = (await redis.eval(
    CONSUME_LUA,
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
