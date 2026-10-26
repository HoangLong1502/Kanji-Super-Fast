import Link from "next/link";
import { notFound } from "next/navigation";
import { Flashcards } from "../../../../../components/Flashcards";
import { TypingStudy } from "../../../../../components/TypingStudy";
import { LessonError } from "../../../../../lib/errors";
import { getLessonDetail, requirePageUser } from "../../../../../lib/lessonService";

export const dynamic = "force-dynamic";

export default async function StudyPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string; mode: string }>;
  searchParams: Promise<{ retry?: string; include?: string }>;
}) {
  const { id, mode } = await params;
  const query = await searchParams;
  if (mode !== "flashcards" && mode !== "hanviet" && mode !== "reading") {
    notFound();
  }

  const user = await requirePageUser();
  const lesson = await getLessonDetail(user.id, id).catch((error: unknown) => {
    if (error instanceof LessonError && error.status === 404) {
      notFound();
    }
    throw error;
  });

  const titles = {
    flashcards: "Flashcard",
    hanviet: "Hán Việt",
    reading: "Đọc kiểm tra"
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/lessons/${lesson.id}`} className="text-sm text-stone-500">
            {lesson.title}
          </Link>
          <h1 className="text-3xl font-semibold">{titles[mode]}</h1>
        </div>
        {mode === "flashcards" ? (
          <div className="flex gap-2 text-sm">
            <Link className="rounded-full border border-line px-3 py-1" href={`/lessons/${lesson.id}/study/flashcards?include=kanji`}>
              Kanji
            </Link>
            <Link className="rounded-full border border-line px-3 py-1" href={`/lessons/${lesson.id}/study/flashcards?include=vocabulary`}>
              Từ vựng
            </Link>
            <Link className="rounded-full border border-line px-3 py-1" href={`/lessons/${lesson.id}/study/flashcards?include=both`}>
              Cả hai
            </Link>
          </div>
        ) : null}
      </div>
      {mode === "flashcards" ? (
        <Flashcards lessonId={lesson.id} retry={query.retry === "1"} include={query.include === "kanji" || query.include === "vocabulary" ? query.include : "both"} />
      ) : (
        <TypingStudy lessonId={lesson.id} mode={mode} retry={query.retry === "1"} />
      )}
    </div>
  );
}
