import Link from "next/link";
import { notFound } from "next/navigation";
import { ReviewEditor } from "../../../../components/ReviewEditor";
import { LessonError } from "../../../../lib/errors";
import { getLessonDetail, requirePageUser } from "../../../../lib/lessonService";

export const dynamic = "force-dynamic";

export default async function EditLessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageUser();
  const lesson = await getLessonDetail(user.id, id).catch((error: unknown) => {
    if (error instanceof LessonError && error.status === 404) {
      notFound();
    }
    throw error;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-brand">Kiểm tra trích xuất</p>
          <h1 className="text-3xl font-semibold">{lesson.title}</h1>
          <p className="mt-1 text-sm text-stone-500">{lesson.originalFilename}</p>
        </div>
        <Link href={`/lessons/${lesson.id}`} className="text-sm font-medium text-brand">
          Xem bài
        </Link>
      </div>
      <ReviewEditor lesson={lesson} />
    </div>
  );
}
