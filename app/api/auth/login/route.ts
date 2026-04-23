import { NextResponse } from "next/server";
import {
  createSession,
  isUserAuthAvailable,
  setUserCookie,
  verifyCredentials,
} from "@/lib/user-auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!isUserAuthAvailable()) {
    return NextResponse.json(
      { error: "用户系统未启用：请配置 Upstash Redis 环境变量。" },
      { status: 503 },
    );
  }

  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法的 JSON" }, { status: 400 });
  }

  const username = await verifyCredentials(body.username ?? "", body.password ?? "");
  if (!username) {
    return NextResponse.json({ error: "用户名或密码错误" }, { status: 401 });
  }

  const token = await createSession(username);
  const res = NextResponse.json({ username });
  setUserCookie(res, token);
  return res;
}
