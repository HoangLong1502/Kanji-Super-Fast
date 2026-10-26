import Link from "next/link";
import { notFound } from "next/navigation";
import { ResetProgress } from "../../../components/ResetProgress";
import { LessonError } from "../../../lib/errors";
import { getLessonDetail, requirePageUser } from "../../../lib/lessonService";

export const dynamic = "force-dynamic";

const typeLabel: Record<string, string> = {
  compound_noun: "Danh từ ghép",
  verb: "Động từ",
  suru_verb: "Động từ する",
  adjective: "Tính từ",
  adverb: "Trạng từ",
  other: "Khác"
};

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageUser();
  const lesson = await getLessonDetail(user.id, id).catch((error: unknown) => {
    if (error instanceof LessonError && error.status === 404) {
      notFound();
    }
    throw error;
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-stone-500">{lesson.originalFilename}</p>
          <h1 className="text-3xl font-semibold">{lesson.title}</h1>
          <p className="mt-2 text-stone-600">
            {lesson.kanji.length} kanji · {lesson.vocabulary.length} từ · {lesson.progressPercent}% tiến độ
            {lesson.jlptLevel ? ` · ${lesson.jlptLevel}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link className="rounded-full border border-line px-3 py-2" href={`/lessons/${lesson.id}/edit`}>
            Sửa nội dung
          </Link>
          <a className="rounded-full border border-line px-3 py-2" href={`/api/lessons/${lesson.id}/export`}>
            Xuất JSON
          </a>
          <ResetProgress lessonId={lesson.id} />
        </div>
      </div>

      {lesson.extractionStatus !== "ready" ? (
        <p className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm">
          Bài chưa được xác nhận. Hãy kiểm tra và bấm “Xác nhận và tạo bài” trước khi luyện.
        </p>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-3">
        <ModeCard
          href={`/lessons/${lesson.id}/study/flashcards`}
          eyebrow="Quizlet"
          title="Flashcard"
          text="Lật kanji và từ. Mặt trước không hiện cách đọc của từ."
          className="border-t-brand"
          disabled={lesson.extractionStatus !== "ready"}
        />
        <ModeCard
          href={`/lessons/${lesson.id}/study/hanviet`}
          eyebrow="Hán Việt"
          title="Gõ Hán Việt"
          text="Chỉ hỏi từng kanji. Gõ đúng âm Hán Việt, có dấu."
          className="border-t-amber-500"
          disabled={lesson.extractionStatus !== "ready"}
        />
        <ModeCard
          href={`/lessons/${lesson.id}/study/reading`}
          eyebrow="Đọc kiểm tra"
          title="Gõ hiragana"
          text="Hỏi cả từ, gồm động từ する và okurigana. Không hỏi kanji đứng một mình."
          className="border-t-indigo-700"
          disabled={lesson.extractionStatus !== "ready"}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-xl font-semibold">Kanji</h2>
          <ul className="space-y-2">
            {lesson.kanji.map((item) => (
              <li key={item.id} className="rounded-2xl border border-line bg-paper px-4 py-3">
                <span className="font-jp text-3xl">{item.character}</span>
                <span className="ml-3 text-sm text-stone-600">
                  {item.hanViet || "chưa có Hán Việt"}
                  {item.hanVietOrigin === "suggested" ? " · gợi ý từ điển" : ""}
                  {" · on "}
                  {item.onReadings.join("、") || "—"}
                  {" · kun "}
                  {item.kunReadings.join("、") || "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="mb-3 text-xl font-semibold">Từ vựng</h2>
          <ul className="space-y-2">
            {lesson.vocabulary.map((item) => (
              <li key={item.id} className="rounded-2xl border border-line bg-paper px-4 py-3">
                <p className="font-jp text-2xl">{item.writtenForm}</p>
                <p className="text-sm text-stone-600">
                  {item.hiragana || "chưa có hiragana"}
                  {item.readingOrigin === "suggested" ? " · gợi ý từ điển" : ""} · {item.meanings.join("; ") || "chưa có nghĩa"} · {typeLabel[item.vocabularyType] ?? item.vocabularyType}
                </p>
                <p className="text-xs text-stone-500">Kanji: {item.kanjiCharacters.join(" ") || "—"}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {lesson.incorrectCount > 0 ? (
        <Link className="inline-flex rounded-full bg-stone-900 px-4 py-2 text-sm text-white" href={`/lessons/${lesson.id}/study/reading?retry=1`}>
          Ôn {lesson.incorrectCount} mục đã sai
        </Link>
      ) : null}
    </div>
  );
}

function ModeCard({
  href,
  eyebrow,
  title,
  text,
  className,
  disabled
}: {
  href: string;
  eyebrow: string;
  title: string;
  text: string;
  className: string;
  disabled: boolean;
}) {
  const body = (
    <article className={`h-full rounded-3xl border border-line border-t-4 bg-paper p-5 shadow-card ${className}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-stone-600">{text}</p>
    </article>
  );

  if (disabled) {
    return <div className="opacity-60">{body}</div>;
  }

  return <Link href={href}>{body}</Link>;
}
