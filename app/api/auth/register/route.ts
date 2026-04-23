import { NextResponse } from "next/server";
import {
  createSession,
  createUser,
  isUserAuthAvailable,
  setUserCookie,
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

  const username = (body.username ?? "").trim().toLowerCase();
  const password = body.password ?? "";

  const result = await createUser(username, password);
  if (!result.ok) {
    if (result.reason === "exists") {
      return NextResponse.json({ error: "用户名已被占用" }, { status: 409 });
    }
    if (result.reason === "invalid_username") {
      return NextResponse.json(
        { error: "用户名只能包含小写字母、数字、下划线、短横线，长度 3-32" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "密码长度需在 8-128 个字符之间" },
      { status: 400 },
    );
  }

  const token = await createSession(username);
  const res = NextResponse.json({ username });
  setUserCookie(res, token);
  return res;
}
