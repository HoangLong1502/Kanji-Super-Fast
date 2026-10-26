import { toHiragana } from "wanakana";

export interface HanVietGradeOptions {
  ignoreDiacritics?: boolean;
}

export interface GradeResult {
  correct: boolean;
  normalizedAnswer: string;
  expected: string;
}

export function gradeHanViet(
  answer: string,
  expected: string,
  options: HanVietGradeOptions = {}
): GradeResult {
  const normalizedAnswer = normalizeHanViet(answer);
  const normalizedExpected = normalizeHanViet(expected);
  const correct = options.ignoreDiacritics
    ? foldVietnamese(normalizedAnswer) === foldVietnamese(normalizedExpected) && normalizedExpected.length > 0
    : normalizedAnswer === normalizedExpected && normalizedExpected.length > 0;

  return {
    correct,
    normalizedAnswer,
    expected: expected.trim()
  };
}

export function gradeHiragana(answer: string, expected: string, variants: string[] = []): GradeResult {
  const normalizedAnswer = normalizeReadingAnswer(answer);
  const accepted = [expected, ...variants].map((reading) => normalizeReadingAnswer(reading)).filter(Boolean);
  const correct = normalizedAnswer.length > 0 && accepted.includes(normalizedAnswer);

  return {
    correct,
    normalizedAnswer,
    expected: normalizeReadingAnswer(expected)
  };
}

export function normalizeHanViet(value: string): string {
  return value.normalize("NFC").replace(/\u3000/g, " ").replace(/\s+/g, " ").trim().toLocaleLowerCase("vi");
}

export function foldVietnamese(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d");
}

/**
 * Hiragana stays hiragana. Katakana is converted.
 * Romaji is left unchanged so it cannot pass as a full reading.
 * Required kana are not removed.
 */
export function normalizeReadingAnswer(value: string): string {
  const compact = value.normalize("NFC").replace(/\u3000/g, "").replace(/\s+/g, "").trim();

  if (!compact) {
    return "";
  }

  return toHiragana(compact, { passRomaji: true });
}
