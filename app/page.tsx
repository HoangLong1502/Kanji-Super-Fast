import Link from "next/link";
import { LessonActions } from "../components/LessonActions";
import { getDashboard, requirePageUser } from "../lib/lessonService";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  processing: "Đang xử lý",
  review: "Chờ duyệt",
  ready: "Sẵn sàng",
  failed: "Lỗi trích xuất"
};

export default async function DashboardPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; jlpt?: string }>;
}) {
  const query = await searchParams;
  const user = await requirePageUser();
  const data = await getDashboard(user.id, { q: query.q, jlpt: query.jlpt });

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-brand">Xin chào, {user.name}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Bài học của bạn</h1>
          <p className="mt-2 max-w-2xl text-stone-600">
            Tải PowerPoint hoặc PDF, kiểm tra kanji và từ ghép, rồi luyện bằng flashcard, Hán Việt hoặc đọc hiragana.
          </p>
        </div>
        <Link href="/upload" className="rounded-full bg-brand px-5 py-3 font-semibold text-white shadow-card">
          Tải tài liệu
        </Link>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Bài học" value={data.stats.lessons} />
        <Stat label="Kanji đã thuộc" value={data.stats.kanjiLearned} />
        <Stat label="Từ đã thuộc" value={data.stats.vocabularyLearned} />
        <Stat label="Cần ôn lại" value={data.stats.review} href="/review" />
      </section>

      <form className="flex flex-wrap gap-2" action="/">
        <label className="sr-only" htmlFor="q">
          Tìm bài
        </label>
        <input
          id="q"
          name="q"
          defaultValue={query.q ?? ""}
          placeholder="Tìm theo tên bài hoặc tên file"
          className="min-w-0 flex-1 rounded-2xl border border-line bg-paper px-4 py-3"
        />
        <label className="sr-only" htmlFor="jlpt">
          Lọc JLPT
        </label>
        <select id="jlpt" name="jlpt" defaultValue={query.jlpt ?? ""} className="rounded-2xl border border-line bg-paper px-4 py-3">
          <option value="">Mọi cấp JLPT</option>
          {["N5", "N4", "N3", "N2", "N1"].map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
        <button className="rounded-2xl border border-line bg-white px-4 py-3 font-medium" type="submit">
          Lọc
        </button>
      </form>

      {data.recent.length > 0 ? (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Học gần đây</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {data.recent.map((lesson) => (
              <a key={lesson.id} href={`/lessons/${lesson.id}`} className="rounded-3xl border border-line bg-paper p-4 shadow-card">
                <p className="font-semibold">{lesson.title}</p>
                <p className="mt-1 text-sm text-stone-500">{lesson.progressPercent}% tiến độ</p>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      <section id="lessons">
        <h2 className="mb-3 text-lg font-semibold">Tất cả bài</h2>
        {data.lessons.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-line bg-paper px-6 py-12 text-center">
            <p className="text-lg font-medium">Chưa có bài nào</p>
            <p className="mt-2 text-stone-600">Tải một file .pptx hoặc PDF sách giáo khoa để tạo bài đầu tiên.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {data.lessons.map((lesson) => (
              <article key={lesson.id} className="rounded-3xl border border-line bg-paper p-5 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-semibold">{lesson.title}</h3>
                    <p className="mt-1 text-sm text-stone-500">{lesson.originalFilename}</p>
                  </div>
                  <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium">
                    {statusLabel[lesson.extractionStatus] ?? lesson.extractionStatus}
                  </span>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-2 text-sm text-stone-600">
                  <div>{lesson.kanjiCount} kanji</div>
                  <div>{lesson.vocabularyCount} từ ghép</div>
                  <div>{lesson.jlptLevel ?? "Chưa gán JLPT"}</div>
                  <div>{lesson.progressPercent}% tiến độ</div>
                  <div className="col-span-2">
                    Học lần cuối: {lesson.lastStudiedAt ? new Date(lesson.lastStudiedAt).toLocaleString("vi") : "chưa học"}
                  </div>
                </dl>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-stone-100">
                  <div className="h-full bg-brand" style={{ width: `${lesson.progressPercent}%` }} />
                </div>
                <div className="mt-4">
                  <LessonActions id={lesson.id} title={lesson.title} />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href?: string }) {
  const body = (
    <div className="rounded-3xl border border-line bg-paper p-4 shadow-card">
      <p className="text-sm text-stone-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
