"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface KanjiRow {
  id?: string;
  character: string;
  hanViet: string;
  hanVietOrigin: string;
  meanings: string;
  onReadings: string;
  kunReadings: string;
  notes: string;
  verified: boolean;
  sourcePages: number[];
  verificationStatus: string;
}

interface VocabRow {
  id?: string;
  writtenForm: string;
  hiragana: string;
  meanings: string;
  vocabularyType: string;
  readingVariants: string;
  kanjiCharacters: string;
  notes: string;
  verified: boolean;
  sourcePages: number[];
  verificationStatus: string;
  readingOrigin: string;
}

interface UncertainRow {
  id: string;
  text: string;
  sourcePage: number | null;
}

export interface EditorLesson {
  id: string;
  title: string;
  lessonNumber: number | null;
  jlptLevel: string | null;
  extractionStatus: string;
  extractionError: string | null;
  warnings: string[];
  needsOcr: boolean;
  rawBlocks: unknown;
  kanji: Array<{
    id: string;
    character: string;
    hanViet: string;
    hanVietOrigin: string;
    meanings: string[];
    onReadings: string[];
    kunReadings: string[];
    notes: string;
    verificationStatus: string;
    sourcePages: number[];
  }>;
  vocabulary: Array<{
    id: string;
    writtenForm: string;
    hiragana: string;
    meanings: string[];
    vocabularyType: string;
    readingVariants: string[];
    kanjiCharacters: string[];
    notes: string;
    verificationStatus: string;
    readingOrigin: string;
    sourcePages: number[];
  }>;
  uncertain: UncertainRow[];
}

const types = [
  ["compound_noun", "Danh từ ghép"],
  ["verb", "Động từ"],
  ["suru_verb", "Động từ する"],
  ["adjective", "Tính từ"],
  ["adverb", "Trạng từ"],
  ["other", "Khác"]
] as const;

export function ReviewEditor({ lesson }: { lesson: EditorLesson }) {
  const router = useRouter();
  const [title, setTitle] = useState(lesson.title);
  const [jlptLevel, setJlptLevel] = useState(lesson.jlptLevel ?? "");
  const [kanji, setKanji] = useState<KanjiRow[]>(
    lesson.kanji.map((item) => ({
      id: item.id,
      character: item.character,
      hanViet: item.hanViet,
      hanVietOrigin: item.hanVietOrigin,
      meanings: item.meanings.join("\n"),
      onReadings: item.onReadings.join("、"),
      kunReadings: item.kunReadings.join("、"),
      notes: item.notes,
      verified: item.verificationStatus === "verified",
      sourcePages: item.sourcePages,
      verificationStatus: item.verificationStatus
    }))
  );
  const [vocabulary, setVocabulary] = useState<VocabRow[]>(
    lesson.vocabulary.map((item) => ({
      id: item.id,
      writtenForm: item.writtenForm,
      hiragana: item.hiragana,
      meanings: item.meanings.join("\n"),
      vocabularyType: item.vocabularyType,
      readingVariants: item.readingVariants.join("、"),
      kanjiCharacters: item.kanjiCharacters.join(""),
      notes: item.notes,
      verified: item.verificationStatus === "verified",
      sourcePages: item.sourcePages,
      verificationStatus: item.verificationStatus,
      readingOrigin: item.readingOrigin
    }))
  );
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const blocks = Array.isArray(lesson.rawBlocks) ? lesson.rawBlocks : [];

  async function save(confirmAfter = false) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/lessons/${lesson.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          jlptLevel: jlptLevel || null,
          lessonNumber: lesson.lessonNumber,
          resolvedUncertainIds: dismissed,
          kanji: kanji.map((item) => ({
            id: item.id,
            character: item.character,
            hanViet: item.hanViet,
            meanings: item.meanings,
            onReadings: item.onReadings,
            kunReadings: item.kunReadings,
            notes: item.notes,
            verified: item.verified
          })),
          vocabulary: vocabulary.map((item) => ({
            id: item.id,
            writtenForm: item.writtenForm,
            hiragana: item.hiragana,
            meanings: item.meanings,
            vocabularyType: item.vocabularyType,
            readingVariants: item.readingVariants,
            kanjiCharacters: [...item.kanjiCharacters].filter((character) => character.trim()),
            notes: item.notes,
            verified: item.verified
          }))
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Không lưu được.");
      }

      if (confirmAfter) {
        const confirmed = await fetch(`/api/lessons/${lesson.id}/confirm`, { method: "POST" });
        const confirmPayload = await confirmed.json();
        if (!confirmed.ok) {
          throw new Error(confirmPayload.error ?? "Chưa tạo được bài.");
        }
        router.push(`/lessons/${lesson.id}`);
        router.refresh();
        return;
      }

      setMessage("Đã lưu các sửa đổi.");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không lưu được.");
    } finally {
      setBusy(false);
    }
  }

  async function suggest() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/lessons/${lesson.id}/suggest`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Từ điển không trả lời.");
      }
      setMessage(`Đã điền gợi ý cho ${payload.filled} mục trống. Gợi ý chưa phải dữ liệu trong file.`);
      router.refresh();
    } catch (suggestError) {
      setError(suggestError instanceof Error ? suggestError.message : "Không gợi ý được.");
    } finally {
      setBusy(false);
    }
  }

  async function retry() {
    setBusy(true);
    setError("");
    const response = await fetch(`/api/lessons/${lesson.id}/retry`, { method: "POST" });
    const payload = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(payload.error ?? "Thử lại thất bại.");
      return;
    }
    router.refresh();
  }

  function mergeDuplicates() {
    const merged: VocabRow[] = [];
    for (const row of vocabulary) {
      const key = `${row.writtenForm}\u0000${row.hiragana}`;
      const existing = merged.find((item) => `${item.writtenForm}\u0000${item.hiragana}` === key);
      if (!existing) {
        merged.push(row);
        continue;
      }
      existing.meanings = [existing.meanings, row.meanings].filter(Boolean).join("\n");
      existing.readingVariants = [existing.readingVariants, row.readingVariants].filter(Boolean).join("、");
    }
    setVocabulary(merged);
    setMessage("Đã gộp các từ trùng chữ viết và trùng hiragana.");
  }

  return (
    <div className="space-y-6">
      {lesson.needsOcr ? (
        <p className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm">
          OCR cho PDF scan chưa được bật. Kết quả bên dưới chỉ là phần chữ đọc được, không phải bản nhận dạng ảnh.
        </p>
      ) : null}
      {lesson.warnings.map((warning) => (
        <p key={warning} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
          {warning}
        </p>
      ))}
      {lesson.extractionError ? (
        <div className="rounded-2xl border border-brand/30 bg-red-50 px-4 py-3 text-sm">
          <p>{lesson.extractionError}</p>
          <button type="button" className="mt-2 font-semibold text-brand" onClick={() => void retry()}>
            Thử trích xuất lại
          </button>
        </div>
      ) : null}

      <div className="grid gap-3 rounded-3xl border border-line bg-paper p-4 md:grid-cols-[1fr_160px]">
        <label className="block text-sm font-medium">
          Tên bài
          <input className="mt-1 w-full rounded-2xl border border-line px-3 py-2" value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="block text-sm font-medium">
          JLPT
          <select className="mt-1 w-full rounded-2xl border border-line px-3 py-2" value={jlptLevel} onChange={(event) => setJlptLevel(event.target.value)}>
            <option value="">Chưa rõ</option>
            {["N5", "N4", "N3", "N2", "N1"].map((level) => (
              <option key={level}>{level}</option>
            ))}
          </select>
        </label>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">Kanji</h2>
          <button
            type="button"
            className="rounded-full border border-line px-3 py-1.5 text-sm"
            onClick={() =>
              setKanji((rows) => [
                ...rows,
                { character: "", hanViet: "", hanVietOrigin: "none", meanings: "", onReadings: "", kunReadings: "", notes: "", verified: false, sourcePages: [], verificationStatus: "unverified" }
              ])
            }
          >
            Thêm kanji
          </button>
        </div>
        <div className="overflow-x-auto rounded-3xl border border-line bg-paper">
          <table className="min-w-[860px] w-full border-collapse text-sm">
            <thead className="bg-stone-50 text-left">
              <tr>
                {["Kanji", "Hán Việt", "On'yomi", "Kun'yomi", "Nghĩa", "Trang", "Trạng thái", ""].map((heading) => (
                  <th key={heading} className="px-3 py-2 font-medium">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {kanji.map((row, index) => (
                <tr key={row.id ?? `new-${index}`} className="border-t border-line align-top">
                  <td className="px-3 py-2">
                    <input className="w-16 rounded-xl border border-line px-2 py-2 font-jp text-2xl" value={row.character} onChange={(event) => updateKanji(index, { character: event.target.value })} />
                    {row.notes ? <p className="mt-1 max-w-40 text-xs text-stone-500">{row.notes}</p> : null}
                  </td>
                  <td className="px-3 py-2">
                    <input className="w-28 rounded-xl border border-line px-2 py-2" value={row.hanViet} onChange={(event) => updateKanji(index, { hanViet: event.target.value })} />
                    <Origin origin={row.hanVietOrigin} />
                  </td>
                  <td className="px-3 py-2">
                    <input className="w-36 rounded-xl border border-line px-2 py-2" value={row.onReadings} onChange={(event) => updateKanji(index, { onReadings: event.target.value })} />
                  </td>
                  <td className="px-3 py-2">
                    <input className="w-36 rounded-xl border border-line px-2 py-2" value={row.kunReadings} onChange={(event) => updateKanji(index, { kunReadings: event.target.value })} />
                  </td>
                  <td className="px-3 py-2">
                    <input className="w-40 rounded-xl border border-line px-2 py-2" value={row.meanings} onChange={(event) => updateKanji(index, { meanings: event.target.value })} />
                  </td>
                  <td className="px-3 py-2 text-stone-500">{row.sourcePages.join(", ") || "—"}</td>
                  <td className="px-3 py-2">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={row.verified} onChange={(event) => updateKanji(index, { verified: event.target.checked })} />
                      Đã kiểm tra
                    </label>
                    <span className="mt-1 block text-xs text-stone-500">{statusText(row.verificationStatus)}</span>
                  </td>
                  <td className="px-3 py-2">
                    <button type="button" className="text-brand" onClick={() => setKanji((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}>
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">Từ vựng</h2>
          <div className="flex gap-2">
            <button type="button" className="rounded-full border border-line px-3 py-1.5 text-sm" onClick={mergeDuplicates}>
              Gộp từ trùng
            </button>
            <button
              type="button"
              className="rounded-full border border-line px-3 py-1.5 text-sm"
              onClick={() =>
                setVocabulary((rows) => [
                  ...rows,
                  {
                    writtenForm: "",
                    hiragana: "",
                    meanings: "",
                    vocabularyType: "compound_noun",
                    readingVariants: "",
                    kanjiCharacters: "",
                    notes: "",
                    verified: false,
                    sourcePages: [],
                    verificationStatus: "unverified",
                    readingOrigin: "none"
                  }
                ])
              }
            >
              Thêm từ
            </button>
          </div>
        </div>
        <div className="overflow-x-auto rounded-3xl border border-line bg-paper">
          <table className="min-w-[980px] w-full border-collapse text-sm">
            <thead className="bg-stone-50 text-left">
              <tr>
                {["Từ", "Hiragana", "Nghĩa", "Loại", "Kanji liên quan", "Trang", "Trạng thái", ""].map((heading) => (
                  <th key={heading} className="px-3 py-2 font-medium">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vocabulary.map((row, index) => (
                <tr key={row.id ?? `vocab-${index}`} className="border-t border-line align-top">
                  <td className="px-3 py-2">
                    <input className="w-32 rounded-xl border border-line px-2 py-2 font-jp text-xl" value={row.writtenForm} onChange={(event) => updateVocab(index, { writtenForm: event.target.value })} />
                  </td>
                  <td className="px-3 py-2">
                    <input className="w-36 rounded-xl border border-line px-2 py-2" value={row.hiragana} onChange={(event) => updateVocab(index, { hiragana: event.target.value })} />
                    <Origin origin={row.readingOrigin} />
                  </td>
                  <td className="px-3 py-2">
                    <input className="w-44 rounded-xl border border-line px-2 py-2" value={row.meanings} onChange={(event) => updateVocab(index, { meanings: event.target.value })} />
                  </td>
                  <td className="px-3 py-2">
                    <select className="rounded-xl border border-line px-2 py-2" value={row.vocabularyType} onChange={(event) => updateVocab(index, { vocabularyType: event.target.value })}>
                      {types.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input className="w-24 rounded-xl border border-line px-2 py-2 font-jp" value={row.kanjiCharacters} onChange={(event) => updateVocab(index, { kanjiCharacters: event.target.value })} />
                  </td>
                  <td className="px-3 py-2 text-stone-500">{row.sourcePages.join(", ") || "—"}</td>
                  <td className="px-3 py-2">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={row.verified} onChange={(event) => updateVocab(index, { verified: event.target.checked })} />
                      Đã kiểm tra
                    </label>
                    <span className="mt-1 block text-xs text-stone-500">{statusText(row.verificationStatus)}</span>
                  </td>
                  <td className="px-3 py-2">
                    <button type="button" className="text-brand" onClick={() => setVocabulary((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}>
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold">Chưa phân loại</h2>
        <p className="mt-1 text-sm text-stone-600">Những dòng này còn trong file nhưng chưa được xếp chắc vào kanji hay từ.</p>
        <ul className="mt-3 space-y-2">
          {lesson.uncertain.filter((item) => !dismissed.includes(item.id)).map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-paper px-3 py-2">
              <span>
                <span className="text-xs text-stone-500">Trang {item.sourcePage ?? "?"}</span>
                <span className="mt-1 block">{item.text}</span>
              </span>
              <span className="flex gap-2">
                <button
                  type="button"
                  className="rounded-full border border-line px-3 py-1 text-sm"
                  onClick={() => {
                    setVocabulary((rows) => [
                      ...rows,
                      {
                        writtenForm: item.text.slice(0, 24),
                        hiragana: "",
                        meanings: "",
                        vocabularyType: "other",
                        readingVariants: "",
                        kanjiCharacters: "",
                        notes: "",
                        verified: false,
                        sourcePages: item.sourcePage ? [item.sourcePage] : [],
                        verificationStatus: "unverified",
                        readingOrigin: "none"
                      }
                    ]);
                    setDismissed((ids) => [...ids, item.id]);
                  }}
                >
                  Thêm thành từ
                </button>
                <button type="button" className="text-sm text-stone-500" onClick={() => setDismissed((ids) => [...ids, item.id])}>
                  Bỏ qua
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <details className="rounded-3xl border border-line bg-paper p-4">
        <summary className="cursor-pointer font-medium">Chữ gốc trích từ file</summary>
        <div className="mt-3 space-y-3 text-sm">
          {blocks.map((block, index) => {
            const page = block && typeof block === "object" && "page" in block ? String(block.page) : "?";
            const text = block && typeof block === "object" && "text" in block ? String(block.text) : "";
            return (
              <pre key={`${page}-${index}`} className="overflow-x-auto whitespace-pre-wrap rounded-2xl bg-stone-50 p-3">
                Trang {page}
                {"\n"}
                {text}
              </pre>
            );
          })}
        </div>
      </details>

      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? (
        <p className="text-sm text-brand" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} className="rounded-full border border-line bg-white px-4 py-3 font-medium" onClick={() => void save(false)}>
          Lưu sửa đổi
        </button>
        <button type="button" disabled={busy} className="rounded-full border border-line bg-white px-4 py-3 font-medium" onClick={() => void suggest()}>
          Gợi ý từ điển cho ô trống
        </button>
        <button type="button" disabled={busy} className="rounded-full bg-brand px-4 py-3 font-semibold text-white" onClick={() => void save(true)}>
          Xác nhận và tạo bài
        </button>
      </div>
    </div>
  );

  function updateKanji(index: number, patch: Partial<KanjiRow>) {
    setKanji((rows) => rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  function updateVocab(index: number, patch: Partial<VocabRow>) {
    setVocabulary((rows) => rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }
}

function Origin({ origin }: { origin: string }) {
  if (origin === "source") {
    return <span className="mt-1 block text-xs text-emerald-700">Trong file</span>;
  }
  if (origin === "suggested") {
    return <span className="mt-1 block text-xs text-amber-700">Gợi ý từ điển</span>;
  }
  if (origin === "verified") {
    return <span className="mt-1 block text-xs text-sky-700">Đã sửa</span>;
  }
  return <span className="mt-1 block text-xs text-stone-400">Chưa có</span>;
}

function statusText(status: string): string {
  if (status === "source") return "Lấy từ file";
  if (status === "suggested") return "Gợi ý, chưa kiểm";
  if (status === "verified") return "Đã kiểm tra";
  return "Chưa rõ";
}
