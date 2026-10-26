import Link from "next/link";
import { getReviewQueue, requirePageUser } from "../../lib/lessonService";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const user = await requirePageUser();
  const items = await getReviewQueue(user.id);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-brand">Ôn lỗi</p>
        <h1 className="text-3xl font-semibold">Những mục chưa thuộc</h1>
      </div>
      {items.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-line bg-paper px-6 py-12 text-center text-stone-600">
          Chưa có câu sai. Khi bạn trả lời nhầm trong bài luyện, mục đó sẽ hiện ở đây.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-line bg-paper px-4 py-3">
              <div>
                <p className="font-jp text-3xl">{item.prompt}</p>
                <p className="text-sm text-stone-600">
                  {item.lessonTitle} · {item.itemType === "kanji" ? "Hán Việt" : "Hiragana"} {item.detail || "chưa có"} · sai {item.incorrectCount} lần
                </p>
              </div>
              <Link
                className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white"
                href={`/lessons/${item.lessonId}/study/${item.itemType === "kanji" ? "hanviet" : "reading"}?retry=1`}
              >
                Ôn lại
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
