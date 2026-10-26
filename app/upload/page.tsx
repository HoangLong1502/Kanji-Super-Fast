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
          Nhận .pptx và PDF có lớp chữ. File .ppt cũ bị từ chối vì có thể chứa macro. PDF scan sẽ được báo là chưa có OCR, không bị bỏ im lặng.
        </p>
      </div>
      <UploadForm />
    </div>
  );
}
