import { toRomaji } from "wanakana";

const JAPANESE_TEXT_PATTERN = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u;
const KANJI_PATTERN = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u;
const JAPANESE_RUN_PATTERN = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaffー々〆〤]+/gu;

export function normalizePptText(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .trim();
}

export function containsJapanese(text: string): boolean {
  return JAPANESE_TEXT_PATTERN.test(text);
}

export function isKanji(character: string): boolean {
  return KANJI_PATTERN.test(character);
}

export function extractKanjiCharacters(text: string): string[] {
  return [...new Set([...text].filter(isKanji))];
}

export function extractJapaneseRuns(text: string): string[] {
  return [...text.matchAll(JAPANESE_RUN_PATTERN)].map((match) => match[0]);
}

export function kanaToRomaji(reading: string | undefined): string | undefined {
  return reading ? toRomaji(reading) : undefined;
}
