import { UploadForm } from "../../components/UploadForm";
import { requirePageUser } from "../../lib/lessonService";

export const dynamic = "force-dynamic";

export default async function UploadPage() {
  await requirePageUser();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <p className="text-sm font-medium text-brand">Tải tài liệu</p>
        <h1 className="mt-1 text-3xl font-semibold">Đưa bài học vào SuperKanji</h1>
        <p className="mt-2 text-stone-600">
          Nhận .pptx, PDF có lớp chữ, hoặc ảnh JPG/PNG/WebP/GIF (OCR tiếng Nhật). File .ppt cũ bị từ chối vì có thể chứa macro. Ảnh OCR cần kiểm tra lại vì có thể lệch chữ.
        </p>
      </div>
      <UploadForm />
    </div>
  );
}
