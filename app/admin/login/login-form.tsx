"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "登录失败");
        return;
      }
      startTransition(() => {
        router.replace("/admin");
        router.refresh();
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="admin__form admin__form--login" onSubmit={handleSubmit}>
      <div className="admin__field">
        <label htmlFor="admin-password">管理员密码</label>
        <input
          id="admin-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          autoFocus
          required
        />
      </div>
      <button
        type="submit"
        className="admin__btn admin__btn--primary"
        disabled={submitting}
      >
        {submitting ? "登录中…" : "登录"}
      </button>
      {error ? <p className="admin__msg admin__msg--err">{error}</p> : null}
    </form>
  );
}
