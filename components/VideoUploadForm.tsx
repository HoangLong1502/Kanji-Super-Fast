"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MAX_VIDEO_BYTES, MAX_VIDEO_LABEL } from "../lib/videoLimits";

export function VideoUploadForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError("Hãy ghi tiêu đề cho video.");
      return;
    }
    if (cleanTitle.length > 120) {
      setError("Tiêu đề tối đa 120 ký tự.");
      return;
    }
    if (!file) {
      setError("Hãy chọn một file video.");
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      setError(`Video lớn hơn ${MAX_VIDEO_LABEL}.`);
      return;
    }

    setBusy(true);
    setError("");
    setProgress(0);
    setStatus("Đang tải video lên…");

    try {
      const body = new FormData();
      body.append("title", cleanTitle);
      body.append("file", file);
      const payload = await uploadVideo(body, setProgress);
      setStatus("Đã lưu. Đang mở trình phát…");
      router.push(`/videos/${payload.id}`);
      router.refresh();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Tải video thất bại.");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="rounded-3xl border border-line bg-paper p-5 shadow-card">
      <label className="block text-sm font-medium" htmlFor="video-title">
        Tiêu đề
      </label>
      <input
        id="video-title"
        name="title"
        value={title}
        maxLength={120}
        required
        disabled={busy}
        placeholder="Ví dụ: Bài 3 — hội thoại ở nhà ga"
        onChange={(event) => setTitle(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3"
      />
      <label className="mt-4 block text-sm font-medium" htmlFor="video-file">
        File video
      </label>
      <input
        id="video-file"
        name="file"
        type="file"
        accept="video/mp4,video/webm,video/quicktime,video/ogg,.mp4,.webm,.mov,.m4v,.mkv,.ogg"
        disabled={busy}
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        className="mt-2 block w-full text-sm text-stone-600 file:mr-3 file:rounded-full file:border-0 file:bg-brand file:px-4 file:py-2 file:font-medium file:text-white"
      />
      <p className="mt-2 text-sm text-stone-500">
        MP4 xem ổn định nhất. Dung lượng tối đa {MAX_VIDEO_LABEL}. Video chỉ hiện trong tài khoản của bạn.
      </p>
      {file ? <p className="mt-2 text-sm text-stone-600">{file.name}</p> : null}
      {busy ? (
        <div className="mt-4" aria-live="polite">
          <div className="h-2 overflow-hidden rounded-full bg-stone-100">
            <div className="h-full bg-brand transition-all" style={{ width: `${Math.max(progress, 8)}%` }} />
          </div>
          <p className="mt-2 text-sm text-stone-600">{status}</p>
        </div>
      ) : null}
      {error ? (
        <p className="mt-4 text-sm text-brand" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={busy} className="mt-5 rounded-full bg-brand px-5 py-3 font-semibold text-white disabled:opacity-60">
        Tải lên và xem
      </button>
    </form>
  );
}

function uploadVideo(body: FormData, onProgress: (value: number) => void): Promise<{ id: string; title: string }> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", "/api/videos/upload");
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    request.onload = () => {
      const payload = JSON.parse(request.responseText || "{}") as { id?: string; title?: string; error?: string };
      if (request.status >= 400 || !payload.id) {
        reject(new Error(payload.error ?? "Tải video thất bại."));
        return;
      }
      resolve({ id: payload.id, title: payload.title ?? "" });
    };
    request.onerror = () => reject(new Error("Mất kết nối khi tải video."));
    request.send(body);
  });
}
