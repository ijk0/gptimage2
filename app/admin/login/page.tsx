import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE_NAME, adminConfigured, isAdminCookieValue } from "@/lib/admin-auth";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AdminLoginPage() {
  if (!adminConfigured()) {
    return (
      <main className="admin">
        <div className="admin__shell">
          <h1 className="admin__title">管理后台未启用</h1>
          <p className="admin__hint">
            请在 Vercel 项目环境变量中设置 <code>ADMIN_PASSWORD</code>，然后重新部署。
          </p>
        </div>
      </main>
    );
  }
  const jar = await cookies();
  const cookie = jar.get(ADMIN_COOKIE_NAME)?.value;
  if (isAdminCookieValue(cookie)) {
    redirect("/admin");
  }
  return (
    <main className="admin">
      <div className="admin__shell admin__shell--narrow">
        <h1 className="admin__title">管理后台登录</h1>
        <p className="admin__subtitle">请输入管理员密码以管理兑换码。</p>
        <LoginForm />
      </div>
    </main>
  );
}
