import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE_NAME, adminConfigured, isAdminCookieValue } from "@/lib/admin-auth";
import { isConfigured as redisConfigured } from "@/lib/redis";
import { listCodes } from "@/lib/redeem-codes";
import { AdminDashboard } from "./dashboard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AdminPage() {
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
  if (!isAdminCookieValue(cookie)) {
    redirect("/admin/login");
  }

  if (!redisConfigured()) {
    return (
      <main className="admin">
        <div className="admin__shell">
          <h1 className="admin__title">兑换码后台</h1>
          <p className="admin__hint">
            Upstash Redis 未配置：请在 Vercel Marketplace 添加 Upstash for Redis 集成，
            它会自动注入 <code>KV_REST_API_URL</code> 与 <code>KV_REST_API_TOKEN</code>。
          </p>
        </div>
      </main>
    );
  }

  const codes = await listCodes();
  return <AdminDashboard initialCodes={codes} />;
}
