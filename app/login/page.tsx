import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isUserAuthAvailable, USER_COOKIE } from "@/lib/user-auth";
import { getRedis } from "@/lib/redis";
import { AuthForm } from "./auth-form";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  if (!isUserAuthAvailable()) {
    return (
      <main className="admin">
        <div className="admin__shell admin__shell--narrow">
          <h1 className="admin__title">用户系统未启用</h1>
          <p className="admin__hint">
            请先在环境变量中设置 <code>KV_REST_API_URL</code> 与{" "}
            <code>KV_REST_API_TOKEN</code>（Upstash Redis 免费套餐即可）。
          </p>
        </div>
      </main>
    );
  }

  const jar = await cookies();
  const token = jar.get(USER_COOKIE)?.value;
  if (token) {
    const username = await getRedis().get<string>(`session:${token}`);
    if (username) redirect("/");
  }

  const params = await searchParams;
  const initialMode = params.mode === "register" ? "register" : "login";

  return (
    <main className="admin">
      <div className="admin__shell admin__shell--narrow">
        <h1 className="admin__title">账号登录 / 注册</h1>
        <p className="admin__subtitle">
          登录后，免费额度与兑换记录将随账号同步，可在不同设备使用。
        </p>
        <AuthForm initialMode={initialMode} />
      </div>
    </main>
  );
}
