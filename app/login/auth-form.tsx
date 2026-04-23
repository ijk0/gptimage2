"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Mode = "login" | "register";

export function AuthForm({ initialMode }: { initialMode: Mode }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? (mode === "login" ? "登录失败" : "注册失败"));
        return;
      }
      startTransition(() => {
        router.replace("/");
        router.refresh();
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="admin__form admin__form--login" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className={`admin__btn ${mode === "login" ? "admin__btn--primary" : "admin__btn--ghost"}`}
            onClick={() => {
              setMode("login");
              setError(null);
            }}
            style={{ flex: 1 }}
          >
            登录
          </button>
          <button
            type="button"
            className={`admin__btn ${mode === "register" ? "admin__btn--primary" : "admin__btn--ghost"}`}
            onClick={() => {
              setMode("register");
              setError(null);
            }}
            style={{ flex: 1 }}
          >
            注册
          </button>
        </div>
      </div>
      <form className="admin__form admin__form--login" onSubmit={handleSubmit}>
        <div className="admin__field">
          <label htmlFor="auth-username">用户名</label>
          <input
            id="auth-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
            required
            minLength={3}
            maxLength={32}
            pattern="[a-zA-Z0-9_-]+"
            placeholder="3-32 位字母、数字、下划线或短横线"
          />
        </div>
        <div className="admin__field">
          <label htmlFor="auth-password">密码</label>
          <input
            id="auth-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            minLength={8}
            maxLength={128}
            placeholder="至少 8 个字符"
          />
        </div>
        <button
          type="submit"
          className="admin__btn admin__btn--primary"
          disabled={submitting}
        >
          {submitting
            ? mode === "login"
              ? "登录中…"
              : "注册中…"
            : mode === "login"
              ? "登录"
              : "注册并登录"}
        </button>
        {error ? <p className="admin__msg admin__msg--err">{error}</p> : null}
      </form>
      <p className="admin__hint" style={{ marginTop: 16 }}>
        <Link href="/">返回首页</Link>
      </p>
    </div>
  );
}
