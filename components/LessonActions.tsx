"use client";

import { useRouter } from "next/navigation";

export function LessonActions({ id, title }: { id: string; title: string }) {
  const router = useRouter();

  async function rename() {
    const next = window.prompt("Tên bài học", title);
    if (!next || next.trim() === title) {
      return;
    }

    const response = await fetch(`/api/lessons/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: next })
    });
    if (!response.ok) {
      const payload = await response.json();
      window.alert(payload.error ?? "Không đổi được tên.");
      return;
    }
    router.refresh();
  }

  async function remove() {
    if (!window.confirm(`Xóa bài “${title}” và toàn bộ tiến độ của bài này?`)) {
      return;
    }

    const response = await fetch(`/api/lessons/${id}`, { method: "DELETE" });
    if (!response.ok) {
      window.alert("Không xóa được bài.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2 text-sm">
      <a className="rounded-full bg-brand px-3 py-1.5 font-medium text-white" href={`/lessons/${id}`}>
        Mở
      </a>
      <a className="rounded-full border border-line px-3 py-1.5" href={`/lessons/${id}/edit`}>
        Sửa
      </a>
      <a className="rounded-full border border-line px-3 py-1.5" href={`/api/lessons/${id}/export`}>
        Xuất
      </a>
      <button type="button" className="rounded-full border border-line px-3 py-1.5" onClick={() => void rename()}>
        Đổi tên
      </button>
      <button type="button" className="rounded-full border border-line px-3 py-1.5 text-brand" onClick={() => void remove()}>
        Xóa
      </button>
    </div>
  );
}
