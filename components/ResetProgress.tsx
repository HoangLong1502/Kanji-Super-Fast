"use client";

import { useRouter } from "next/navigation";

export function ResetProgress({ lessonId }: { lessonId: string }) {
  const router = useRouter();

  async function reset() {
    if (!window.confirm("Xóa tiến độ học của bài này?")) {
      return;
    }
    await fetch(`/api/lessons/${lessonId}/reset`, { method: "POST" });
    router.refresh();
  }

  return (
    <button type="button" className="rounded-full border border-line px-3 py-2" onClick={() => void reset()}>
      Học lại từ đầu
    </button>
  );
}
