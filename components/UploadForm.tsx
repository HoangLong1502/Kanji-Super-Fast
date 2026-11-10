"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function UploadForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(selected = file) {
    if (!selected) {
      setError("Hãy chọn file .pptx, PDF hoặc ảnh (JPG/PNG/WebP/GIF).");
      return;
    }

    if (selected.size > 500 * 1024 * 1024) {
      setError("File lớn hơn 500MB.");
      return;
    }

    const isImage = selected.type.startsWith("image/");
    if (isImage && selected.size > 25 * 1024 * 1024) {
      setError("Ảnh OCR nên dưới 25MB. Hãy nén hoặc cắt ảnh rồi tải lại.");
      return;
    }

    setBusy(true);
    setError("");
    setProgress(0);
    setStatus(isImage ? "Đang tải ảnh lên… (OCR có thể mất thêm vài phút)" : "Đang tải file lên…");

    try {
      const body = new FormData();
      body.append("file", selected);
      const payload = await upload(body, setProgress);
      setStatus(payload.duplicate ? "File này đã có bài. Đang mở bài cũ…" : "Đã trích xuất. Đang mở trang kiểm tra…");
      router.push(`/lessons/${payload.lessonId}/edit`);
      router.refresh();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Tải lên thất bại.");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="rounded-3xl border border-line bg-paper p-5 shadow-card"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <label
        htmlFor="material"
        className="flex cursor-pointer flex-col items-center rounded-3xl border border-dashed border-brand/40 bg-[#fff7f5] px-4 py-12 text-center"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const dropped = event.dataTransfer.files?.[0];
          if (dropped) {
            setFile(dropped);
            void submit(dropped);
          }
        }}
      >
        <span className="text-lg font-semibold">Kéo thả PPTX, PDF hoặc ảnh vào đây</span>
        <span className="mt-2 text-sm text-stone-600">
          hoặc bấm để chọn · PPT/PDF tới 500MB · ảnh tới 25MB
        </span>
        <span className="mt-3 font-medium text-brand">{file ? file.name : "Chưa chọn file"}</span>
        <input
          id="material"
          name="file"
          type="file"
          accept=".ppt,.pptx,.pdf,.jpg,.jpeg,.png,.gif,.webp,application/pdf,image/jpeg,image/png,image/gif,image/webp,application/vnd.openxmlformats-officedocument.presentationml.presentation"
          className="sr-only"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
      </label>
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
        Trích xuất và xem lại
      </button>
    </form>
  );
}

function upload(body: FormData, onProgress: (value: number) => void): Promise<{ lessonId: string; duplicate: boolean }> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", "/api/lessons/upload");
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 70));
      }
    };
    request.onreadystatechange = () => {
      if (request.readyState === XMLHttpRequest.HEADERS_RECEIVED) {
        onProgress(80);
      }
    };
    request.onload = () => {
      onProgress(100);
      const payload = JSON.parse(request.responseText || "{}") as { lessonId?: string; duplicate?: boolean; error?: string };
      if (request.status >= 400 || !payload.lessonId) {
        reject(new Error(payload.error ?? "Không trích xuất được file."));
        return;
      }
      resolve({ lessonId: payload.lessonId, duplicate: Boolean(payload.duplicate) });
    };
    request.onerror = () => reject(new Error("Mất kết nối khi tải file."));
    request.send(body);
  });
}
