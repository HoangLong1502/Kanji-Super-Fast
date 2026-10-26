"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/", label: "Bảng điều khiển" },
  { href: "/upload", label: "Tải tài liệu" },
  { href: "/review", label: "Ôn lỗi" },
  { href: "/settings", label: "Cài đặt" }
];

export function Nav({ userName }: { userName?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (pathname === "/login" || pathname === "/register") {
    return null;
  }

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <header className="border-b border-line bg-paper/90">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="font-jp text-2xl font-bold tracking-tight text-brand">
          SuperKanji
        </Link>
        <nav className="flex flex-wrap items-center gap-1" aria-label="Chính">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-3 py-2 text-sm font-medium ${active ? "bg-brand text-white" : "text-stone-700 hover:bg-stone-100"}`}
                aria-current={active ? "page" : undefined}
              >
                {link.label}
              </Link>
            );
          })}
          {userName ? (
            <span className="ml-1 hidden rounded-full bg-stone-100 px-3 py-2 text-sm text-stone-600 sm:inline">{userName}</span>
          ) : null}
          <button
            type="button"
            onClick={() => void logout()}
            disabled={busy}
            className="rounded-full px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-60"
          >
            Đăng xuất
          </button>
        </nav>
      </div>
    </header>
  );
}
