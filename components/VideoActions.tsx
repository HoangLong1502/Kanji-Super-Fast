"use client";

import { useRouter } from "next/navigation";

export function VideoActions({ id, title, redirectTo }: { id: string; title: string; redirectTo?: string }) {
  const router = useRouter();

  async function rename() {
    const next = window.prompt("Tiêu đề video", title);
    if (!next || next.trim() === title) {
      return;
    }

    const response = await fetch(`/api/videos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: next })
    });
    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      window.alert(payload.error ?? "Không đổi được tiêu đề.");
      return;
    }
    router.refresh();
  }

  async function remove() {
    if (!window.confirm(`Xóa video “${title}”? File trên máy cũng sẽ bị xóa.`)) {
      return;
    }

    const response = await fetch(`/api/videos/${id}`, { method: "DELETE" });
    if (!response.ok) {
      window.alert("Không xóa được video.");
      return;
    }
    if (redirectTo) {
      router.push(redirectTo);
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2 text-sm">
      <a className="rounded-full bg-brand px-3 py-1.5 font-medium text-white" href={`/videos/${id}`}>
        Xem
      </a>
      <button type="button" className="rounded-full border border-line px-3 py-1.5" onClick={() => void rename()}>
        Đổi tiêu đề
      </button>
      <button type="button" className="rounded-full border border-line px-3 py-1.5 text-brand" onClick={() => void remove()}>
        Xóa
      </button>
    </div>
  );
}
