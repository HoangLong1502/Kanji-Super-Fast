"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Question {
  id: string;
  prompt: string;
}

interface WrongItem {
  prompt: string;
  answer: string;
  expected: string;
}

export function TypingStudy({
  lessonId,
  mode,
  retry
}: {
  lessonId: string;
  mode: "hanviet" | "reading";
  retry: boolean;
}) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<{ correct: boolean; expected: string; meanings: string[] } | null>(null);
  const [score, setScore] = useState({ correct: 0, wrong: 0 });
  const [wrongs, setWrongs] = useState<WrongItem[]>([]);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<{ score: number; total: number } | null>(null);
  const accent = mode === "hanviet" ? "border-amber-500 bg-[#fffaf3]" : "border-indigo-700 bg-[#f5f7ff]";

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await fetch(`/api/lessons/${lessonId}/study-sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, retryIncorrect: retry })
      });
      const payload = await response.json();
      if (cancelled) return;
      if (!response.ok) {
        setError(payload.error ?? "Không mở được bài luyện.");
        return;
      }
      setSessionId(payload.id);
      setQuestions(payload.questions ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [lessonId, mode, retry]);

  const question = questions[index];

  async function submit() {
    if (!question || !sessionId || feedback) return;
    const response = await fetch(`/api/study-sessions/${sessionId}/answers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: question.id, answer })
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "Không chấm được.");
      return;
    }
    setFeedback({ correct: payload.correct, expected: payload.expected, meanings: payload.meanings ?? [] });
    setScore((current) => ({
      correct: current.correct + (payload.correct ? 1 : 0),
      wrong: current.wrong + (payload.correct ? 0 : 1)
    }));
    if (!payload.correct) {
      setWrongs((items) => [...items, { prompt: question.prompt, answer, expected: payload.expected }]);
    }
  }

  async function next() {
    if (index + 1 >= questions.length) {
      const response = await fetch(`/api/study-sessions/${sessionId}/complete`, { method: "POST" });
      const payload = await response.json();
      setSummary({ score: payload.score ?? score.correct, total: payload.total ?? questions.length });
      return;
    }
    setIndex((value) => value + 1);
    setAnswer("");
    setFeedback(null);
  }

  if (error) return <p className="text-brand">{error}</p>;
  if (!question && !summary) return <p>Đang chuẩn bị câu hỏi…</p>;

  if (questions.length === 0) {
    return (
      <p className="rounded-3xl border border-line bg-paper p-6">
        Không có câu nào đủ dữ liệu. Hán Việt cần âm Hán Việt của từng kanji. Bài đọc cần hiragana của cả từ, không phải kanji đứng một mình.
      </p>
    );
  }

  if (summary) {
    return (
      <section className={`rounded-3xl border-t-4 ${accent} p-6 shadow-card`}>
        <h2 className="text-2xl font-semibold">Kết quả {summary.score}/{summary.total}</h2>
        {wrongs.length > 0 ? (
          <ul className="mt-4 space-y-2 text-sm">
            {wrongs.map((item) => (
              <li key={`${item.prompt}-${item.expected}`}>
                <span className="font-jp text-xl">{item.prompt}</span> — bạn nhập “{item.answer || "(trống)"}”, đáp án {item.expected}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2">Không có câu sai.</p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link className="rounded-full bg-brand px-4 py-2 text-white" href={`/lessons/${lessonId}/study/${mode}?retry=1`}>
            Luyện câu sai
          </Link>
          <button type="button" className="rounded-full border border-line px-4 py-2" onClick={() => window.location.assign(`/lessons/${lessonId}/study/${mode}`)}>
            Làm lại
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={`rounded-3xl border-t-4 ${accent} p-5 shadow-card sm:p-8`}>
      <p className="text-sm text-stone-500">
        Câu {index + 1} / {questions.length} · Đúng {score.correct} · Sai {score.wrong}
      </p>
      <p className="mt-2 text-sm font-medium">{mode === "hanviet" ? "Gõ Hán Việt của kanji" : "Gõ hiragana của cả từ"}</p>
      <p className="mt-4 text-center font-jp text-7xl font-bold sm:text-8xl">{question.prompt}</p>
      <form
        className="mx-auto mt-6 max-w-md"
        onSubmit={(event) => {
          event.preventDefault();
          if (feedback) void next();
          else void submit();
        }}
      >
        <label className="block text-sm font-medium" htmlFor="answer">
          {mode === "hanviet" ? "Hán Việt" : "Hiragana"}
        </label>
        <input
          id="answer"
          autoFocus
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          value={answer}
          disabled={Boolean(feedback)}
          onChange={(event) => setAnswer(event.target.value)}
          className="mt-1 w-full rounded-2xl border border-line px-4 py-3 text-lg"
          placeholder={mode === "hanviet" ? "Ví dụ THỜI" : "Ví dụ じかん"}
        />
        <button type="submit" className="mt-3 w-full rounded-full bg-stone-900 px-4 py-3 font-semibold text-white">
          {feedback ? "Câu tiếp" : "Kiểm tra"}
        </button>
      </form>
      {feedback ? (
        <div className={`mt-4 rounded-2xl px-4 py-3 ${feedback.correct ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-brand"}`} role="status">
          <p className="font-semibold">{feedback.correct ? "Đúng" : "Chưa đúng"}</p>
          {!feedback.correct ? <p className="mt-1">Đáp án: {feedback.expected}</p> : null}
          {feedback.meanings.length > 0 ? <p className="mt-1">Nghĩa: {feedback.meanings.join("; ")}</p> : null}
        </div>
      ) : (
        <p className="mt-3 text-sm text-stone-500">Nhấn Enter để nộp. Romaji không được tính là đúng ở bài đọc.</p>
      )}
    </section>
  );
}
