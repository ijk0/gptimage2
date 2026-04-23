"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

type RedeemCode = {
  code: string;
  amount: number;
  repeatable: boolean;
  createdAt: string;
  redeemed: boolean;
  redeemedAt?: string;
  redeemedCount: number;
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function AdminDashboard({
  initialCodes,
}: {
  initialCodes: RedeemCode[];
}) {
  const router = useRouter();
  const [codes, setCodes] = useState<RedeemCode[]>(initialCodes);
  const [code, setCode] = useState("");
  const [amount, setAmount] = useState("10");
  const [repeatable, setRepeatable] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const stats = useMemo(() => {
    const total = codes.length;
    // "Used" = one-time codes that were consumed. Repeatable codes stay
    // available as long as they exist, regardless of redemption count.
    const used = codes.filter((c) => !c.repeatable && c.redeemed).length;
    const totalAmount = codes.reduce((sum, c) => sum + c.amount, 0);
    return { total, used, available: total - used, totalAmount };
  }, [codes]);

  async function refresh() {
    const res = await fetch("/api/admin/codes", { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as { codes: RedeemCode[] };
      setCodes(data.codes);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setCreating(true);
    try {
      const res = await fetch("/api/admin/codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, amount: Number(amount), repeatable }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "创建失败");
        return;
      }
      const data = (await res.json()) as { code: RedeemCode };
      setCodes((prev) => [data.code, ...prev]);
      const typeLabel = data.code.repeatable ? "可重复" : "一次性";
      setNotice(
        `已创建 ${data.code.code}（+${data.code.amount} 次 · ${typeLabel}）`,
      );
      setCode("");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(target: string) {
    if (!confirm(`确认删除兑换码 ${target}？`)) return;
    setPendingDelete(target);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(
        `/api/admin/codes/${encodeURIComponent(target)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "删除失败");
        return;
      }
      setCodes((prev) => prev.filter((c) => c.code !== target));
      setNotice(`已删除 ${target}`);
    } finally {
      setPendingDelete(null);
    }
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    startTransition(() => {
      router.replace("/admin/login");
      router.refresh();
    });
  }

  function copy(value: string) {
    navigator.clipboard?.writeText(value).then(
      () => setNotice(`已复制 ${value}`),
      () => setError("复制失败"),
    );
  }

  return (
    <main className="admin">
      <div className="admin__shell">
        <header className="admin__header">
          <div>
            <h1 className="admin__title">兑换码后台</h1>
            <p className="admin__subtitle">
              兑换码管理 · 共 {stats.total} 张 · 一次性可用 {stats.available} ·
              已用 {stats.used}
            </p>
          </div>
          <div className="admin__header-actions">
            <button type="button" className="admin__btn admin__btn--ghost" onClick={refresh}>
              刷新
            </button>
            <button type="button" className="admin__btn admin__btn--ghost" onClick={handleLogout}>
              退出
            </button>
          </div>
        </header>

        <section className="admin__panel">
          <h2 className="admin__panel-title">新建兑换码</h2>
          <form className="admin__form" onSubmit={handleCreate}>
            <div className="admin__field">
              <label htmlFor="admin-code">兑换码</label>
              <input
                id="admin-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="例如 WELCOME"
                pattern="[A-Z0-9_\-]{2,40}"
                title="2-40 位大写字母、数字、_- "
                required
              />
            </div>
            <div className="admin__field">
              <label htmlFor="admin-amount">充值次数</label>
              <input
                id="admin-amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min={1}
                max={100000}
                required
              />
            </div>
            <div className="admin__field admin__field--check">
              <label htmlFor="admin-repeatable" className="admin__check">
                <input
                  id="admin-repeatable"
                  type="checkbox"
                  checked={repeatable}
                  onChange={(e) => setRepeatable(e.target.checked)}
                />
                <span>可重复使用</span>
              </label>
              <span className="admin__field-hint">
                {repeatable
                  ? "多人可用，每位用户仅可兑换一次"
                  : "全局一次性兑换码，使用后作废"}
              </span>
            </div>
            <button
              type="submit"
              className="admin__btn admin__btn--primary"
              disabled={creating}
            >
              {creating ? "创建中…" : "创建"}
            </button>
          </form>
          {error ? <p className="admin__msg admin__msg--err">{error}</p> : null}
          {notice ? <p className="admin__msg admin__msg--ok">{notice}</p> : null}
        </section>

        <section className="admin__panel">
          <h2 className="admin__panel-title">兑换码列表</h2>
          {codes.length === 0 ? (
            <p className="admin__hint">暂无兑换码。在上方表单中新建一个。</p>
          ) : (
            <div className="admin__table-wrap">
              <table className="admin__table">
                <thead>
                  <tr>
                    <th>兑换码</th>
                    <th>+次数</th>
                    <th>类型</th>
                    <th>状态</th>
                    <th>已兑换</th>
                    <th>创建时间</th>
                    <th>最近使用</th>
                    <th aria-label="操作" />
                  </tr>
                </thead>
                <tbody>
                  {codes.map((c) => {
                    const depleted = !c.repeatable && c.redeemed;
                    return (
                      <tr key={c.code} className={depleted ? "is-redeemed" : ""}>
                        <td>
                          <button
                            type="button"
                            className="admin__codecell"
                            onClick={() => copy(c.code)}
                            title="点击复制"
                          >
                            {c.code}
                          </button>
                        </td>
                        <td>+{c.amount}</td>
                        <td>
                          <span
                            className={`admin__badge admin__badge--${c.repeatable ? "repeat" : "once"}`}
                          >
                            {c.repeatable ? "可重复" : "一次性"}
                          </span>
                        </td>
                        <td>
                          {depleted ? (
                            <span className="admin__badge admin__badge--used">
                              已使用
                            </span>
                          ) : (
                            <span className="admin__badge admin__badge--ok">
                              可用
                            </span>
                          )}
                        </td>
                        <td>{c.redeemedCount}</td>
                        <td className="admin__cell-time">
                          {formatDate(c.createdAt)}
                        </td>
                        <td className="admin__cell-time">
                          {c.redeemedAt ? formatDate(c.redeemedAt) : "—"}
                        </td>
                        <td className="admin__cell-actions">
                          <button
                            type="button"
                            className="admin__btn admin__btn--danger"
                            onClick={() => handleDelete(c.code)}
                            disabled={pendingDelete === c.code}
                          >
                            {pendingDelete === c.code ? "删除中…" : "删除"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
