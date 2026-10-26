"use client";

import { useState } from "react";

export function SettingsForm({ ignoreDiacritics, revealMeaning }: { ignoreDiacritics: boolean; revealMeaning: boolean }) {
  const [diacritics, setDiacritics] = useState(ignoreDiacritics);
  const [meaning, setMeaning] = useState(revealMeaning);
  const [message, setMessage] = useState("");

  async function save() {
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ignoreDiacritics: diacritics, revealMeaning: meaning })
    });
    setMessage(response.ok ? "Đã lưu." : "Không lưu được.");
  }

  return (
    <form
      className="space-y-4 rounded-3xl border border-line bg-paper p-5"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <label className="flex gap-3">
        <input type="checkbox" checked={diacritics} onChange={(event) => setDiacritics(event.target.checked)} />
        <span>
          <span className="font-medium">Chấp nhận Hán Việt thiếu dấu</span>
          <span className="mt-1 block text-sm text-stone-600">Mặc định tắt. “thoi” không được tính là “THỜI” nếu bạn không bật mục này.</span>
        </span>
      </label>
      <label className="flex gap-3">
        <input type="checkbox" checked={meaning} onChange={(event) => setMeaning(event.target.checked)} />
        <span>
          <span className="font-medium">Hiện nghĩa tiếng Việt sau khi trả lời</span>
          <span className="mt-1 block text-sm text-stone-600">Chỉ hiện sau khi nộp, không hiện trên câu hỏi.</span>
        </span>
      </label>
      <p className="text-sm text-stone-500">Giao diện tiếng Anh sẽ được thêm sau. Hiện ứng dụng dùng tiếng Việt.</p>
      <button type="submit" className="rounded-full bg-brand px-4 py-2 font-semibold text-white">
        Lưu
      </button>
      {message ? <p className="text-sm">{message}</p> : null}
    </form>
  );
}
