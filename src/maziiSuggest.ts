import { toHiragana } from "wanakana";
import type { DictionaryLookup } from "./lessonDraft.js";

const MAZII_URL = "https://mazii.net/api/search";
const wordCache = new Map<string, { reading?: string; meaning?: string } | null>();
const kanjiCache = new Map<string, { hanViet?: string; on?: string[]; kun?: string[]; meaning?: string } | null>();

export function createMaziiLookup(): DictionaryLookup {
  return {
    lookupWord,
    lookupKanji
  };
}

export async function lookupWord(word: string): Promise<{ reading?: string; meaning?: string } | undefined> {
  if (wordCache.has(word)) {
    return wordCache.get(word) ?? undefined;
  }

  const payload = await postMazii({ dict: "javi", type: "word", query: word, limit: 5, page: 1 });
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  const exact = rows.find((row) => row?.word === word);
  if (!exact) {
    wordCache.set(word, null);
    return undefined;
  }

  const reading = cleanReading(exact.phonetic) ?? cleanReading(exact.pronunciation?.[0]?.kana);
  const meaning = cleanMeaning(exact.short_mean) ?? cleanMeaning(exact.means?.[0]?.mean);
  const suggestion = reading || meaning ? { reading, meaning } : null;
  wordCache.set(word, suggestion);
  return suggestion ?? undefined;
}

export async function lookupKanji(
  character: string
): Promise<{ hanViet?: string; on?: string[]; kun?: string[]; meaning?: string } | undefined> {
  if (kanjiCache.has(character)) {
    return kanjiCache.get(character) ?? undefined;
  }

  const payload = await postMazii({ dict: "javi", type: "kanji", query: character, limit: 3, page: 1 });
  const rows = Array.isArray(payload?.results) ? payload.results : [];
  const exact = rows.find((row) => row?.kanji === character) ?? rows[0];
  if (!exact || exact.kanji !== character) {
    kanjiCache.set(character, null);
    return undefined;
  }

  const hanViet = cleanHanViet(exact.mean);
  const on = splitKanaList(exact.on);
  const kun = splitKanaList(exact.kun).map((reading) => reading.replace(/^-/u, ""));
  const suggestion = hanViet || on.length || kun.length ? { hanViet, on, kun } : null;
  kanjiCache.set(character, suggestion);
  return suggestion ?? undefined;
}

async function postMazii(body: Record<string, unknown>): Promise<MaziiPayload | undefined> {
  try {
    const response = await fetch(MAZII_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000)
    });

    if (!response.ok) {
      return undefined;
    }

    return (await response.json()) as MaziiPayload;
  } catch {
    return undefined;
  }
}

function cleanReading(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const reading = toHiragana(value.replace(/\s+/g, ""), { passRomaji: true });
  if (!reading || /[\u3400-\u9fff]/u.test(reading)) {
    return undefined;
  }

  return reading;
}

function cleanMeaning(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const first = value.replace(/\s+/g, " ").trim().split(/[;；]/u)[0]?.trim() ?? "";
  const withoutNominal = first.replace(/^sự\s+/iu, "");
  return withoutNominal || undefined;
}

function cleanHanViet(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 24 || /[\u3040-\u9fff0-9.;:]/u.test(trimmed)) {
    return undefined;
  }

  if (trimmed !== trimmed.toLocaleUpperCase("vi")) {
    return undefined;
  }

  return trimmed;
}

function splitKanaList(value: unknown): string[] {
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  return value
    .split(/[\s,、]+/u)
    .map((part) => toHiragana(part.trim(), { passRomaji: true }))
    .filter((part) => part && /[\u3040-\u30ff]/u.test(part));
}

interface MaziiPayload {
  data?: Array<{
    word?: string;
    phonetic?: string;
    short_mean?: string;
    pronunciation?: Array<{ kana?: string }>;
    means?: Array<{ mean?: string }>;
  }>;
  results?: Array<{
    kanji?: string;
    mean?: string;
    on?: string;
    kun?: string;
  }>;
}
