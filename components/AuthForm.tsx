"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type Mode = "login" | "register";

export function AuthForm({ mode, nextPath = "/" }: { mode: Mode; nextPath?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const response = await fetch(mode === "login" ? "/api/auth/login" : "/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "login" ? { email, password } : { email, name, password })
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Không đăng nhập được.");
      }

      router.replace(nextPath.startsWith("/") ? nextPath : "/");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Có lỗi xảy ra.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-3xl border border-line bg-paper p-6 shadow-card">
      {mode === "register" ? (
        <label className="block space-y-1">
          <span className="text-sm font-medium">Tên hiển thị</span>
          <input
            className="w-full rounded-2xl border border-line bg-white px-4 py-3"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            required
            maxLength={60}
          />
        </label>
      ) : null}

      <label className="block space-y-1">
        <span className="text-sm font-medium">Email</span>
        <input
          type="email"
          className="w-full rounded-2xl border border-line bg-white px-4 py-3"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Mật khẩu</span>
        <input
          type="password"
          className="w-full rounded-2xl border border-line bg-white px-4 py-3"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
          minLength={6}
        />
      </label>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-full bg-brand px-5 py-3 font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Đang xử lý…" : mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
      </button>

      <p className="text-center text-sm text-stone-600">
        {mode === "login" ? (
          <>
            Chưa có tài khoản?{" "}
            <Link href="/register" className="font-medium text-brand">
              Đăng ký
            </Link>
          </>
        ) : (
          <>
            Đã có tài khoản?{" "}
            <Link href="/login" className="font-medium text-brand">
              Đăng nhập
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
