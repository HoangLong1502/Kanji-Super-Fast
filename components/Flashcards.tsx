"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Card {
  id: string;
  itemType: "kanji" | "vocabulary";
  prompt: string;
  back: {
    hanViet?: string;
    onReadings?: string[];
    kunReadings?: string[];
    meanings?: string[];
    notes?: string;
    examples?: Array<{ writtenForm: string; hiragana: string; meanings: string[] }>;
    hiragana?: string;
    kanji?: Array<{ character: string; hanViet: string }>;
    vocabularyType?: string;
  };
}

export function Flashcards({ lessonId, retry, include }: { lessonId: string; retry: boolean; include: string }) {
  const [cards, setCards] = useState<Card[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(0);
  const [again, setAgain] = useState(0);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await fetch(`/api/lessons/${lessonId}/study-sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "flashcards", include, retryIncorrect: retry })
      });
      const payload = await response.json();
      if (cancelled) return;
      if (!response.ok) {
        setError(payload.error ?? "Không mở được bộ thẻ.");
        return;
      }
      setSessionId(payload.id);
      setCards(payload.questions ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [include, lessonId, retry]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === " ") {
        event.preventDefault();
        setFlipped((value) => !value);
      }
      if (event.key === "ArrowRight") move(1);
      if (event.key === "ArrowLeft") move(-1);
      if (event.key === "1") void rate("known");
      if (event.key === "2") void rate("again");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const card = cards[index];

  async function rate(answer: "known" | "again") {
    if (!card || !sessionId) return;
    await fetch(`/api/study-sessions/${sessionId}/answers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: card.id, answer })
    });
    if (answer === "known") setKnown((value) => value + 1);
    else setAgain((value) => value + 1);
    if (index + 1 >= cards.length) {
      await fetch(`/api/study-sessions/${sessionId}/complete`, { method: "POST" });
      setDone(true);
      return;
    }
    setIndex((value) => value + 1);
    setFlipped(false);
  }

  function move(step: number) {
    setIndex((value) => Math.min(cards.length - 1, Math.max(0, value + step)));
    setFlipped(false);
  }

  function shuffle() {
    setCards((items) => [...items].sort(() => Math.random() - 0.5));
    setIndex(0);
    setFlipped(false);
  }

  if (error) return <p className="text-brand">{error}</p>;
  if (!card && !done) return <p>Đang mở bộ thẻ…</p>;
  if (cards.length === 0) return <p>Bộ thẻ trống. Hãy kiểm tra lại bài hoặc bộ lọc.</p>;

  if (done) {
    return (
      <section className="rounded-3xl border border-line bg-paper p-8 text-center shadow-card">
        <h2 className="text-2xl font-semibold">Hết bộ thẻ</h2>
        <p className="mt-2">Đã thuộc {known} · Cần ôn {again}</p>
        <div className="mt-4 flex justify-center gap-2">
          <button type="button" className="rounded-full bg-brand px-4 py-2 text-white" onClick={() => window.location.reload()}>
            Học lại
          </button>
          <Link className="rounded-full border border-line px-4 py-2" href={`/lessons/${lessonId}`}>
            Về bài học
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm">
        <p>
          Thẻ {index + 1} / {cards.length}
        </p>
        <div className="flex gap-2">
          <button type="button" className="rounded-full border border-line px-3 py-1" onClick={shuffle}>
            Xáo trộn
          </button>
          <button type="button" className="rounded-full border border-line px-3 py-1" onClick={() => { setIndex(0); setFlipped(false); setDone(false); }}>
            Học lại từ đầu
          </button>
        </div>
      </div>
      <div className="flip-scene">
        <button
          type="button"
          className={`flip-card w-full rounded-3xl border-t-4 border-brand text-left ${flipped ? "is-flipped" : ""}`}
          onClick={() => setFlipped((value) => !value)}
          aria-label={flipped ? "Mặt sau thẻ" : "Mặt trước thẻ, bấm để lật"}
        >
          <span aria-hidden={flipped} className="flip-face flex items-center justify-center rounded-3xl border border-line bg-paper p-8 shadow-card">
            <span className="font-jp text-7xl font-bold sm:text-8xl">{card.prompt}</span>
          </span>
          <span aria-hidden={!flipped} className="flip-face flip-back overflow-auto rounded-3xl border border-line bg-[#fff7f5] p-6 shadow-card">
            <CardBack card={card} />
          </span>
        </button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="rounded-full border border-line px-4 py-2" onClick={() => move(-1)}>
          Trước
        </button>
        <button type="button" className="rounded-full border border-line px-4 py-2" onClick={() => move(1)}>
          Sau
        </button>
        <button type="button" className="rounded-full bg-emerald-700 px-4 py-2 text-white" onClick={() => void rate("known")}>
          Đã thuộc (1)
        </button>
        <button type="button" className="rounded-full bg-brand px-4 py-2 text-white" onClick={() => void rate("again")}>
          Cần ôn (2)
        </button>
      </div>
      <p className="mt-3 text-sm text-stone-500">Phím cách để lật, mũi tên để chuyển thẻ.</p>
    </section>
  );
}

function CardBack({ card }: { card: Card }) {
  if (card.itemType === "kanji") {
    return (
      <div className="space-y-2 text-sm">
        <p className="font-jp text-5xl">{card.prompt}</p>
        <p>Hán Việt: {card.back.hanViet || "chưa có"}</p>
        <p>On: {(card.back.onReadings ?? []).join("、") || "—"}</p>
        <p>Kun: {(card.back.kunReadings ?? []).join("、") || "—"}</p>
        <p>Nghĩa: {(card.back.meanings ?? []).join("; ") || "—"}</p>
        {(card.back.examples ?? []).length > 0 ? (
          <ul>
            {card.back.examples?.map((example) => (
              <li key={example.writtenForm}>
                {example.writtenForm} {example.hiragana ? `· ${example.hiragana}` : ""} {example.meanings[0] ? `· ${example.meanings[0]}` : ""}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="font-jp text-4xl">{card.prompt}</p>
      <p className="text-2xl">{card.back.hiragana || "Chưa có hiragana"}</p>
      <p>{(card.back.meanings ?? []).join("; ")}</p>
      <p className="text-sm">
        Kanji: {(card.back.kanji ?? []).map((item) => `${item.character}${item.hanViet ? ` (${item.hanViet})` : ""}`).join(" · ") || "—"}
      </p>
    </div>
  );
}
