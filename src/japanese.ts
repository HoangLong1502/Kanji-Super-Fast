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

const HIRAGANA_OR_CHOON = /[\u3040-\u309fー]/u;

function isStudyKanji(character: string): boolean {
  return isKanji(character) || character === "々" || character === "〆";
}

function readKanjiToken(chars: string[], start: number): { text: string; next: number } {
  let index = start;

  while (index < chars.length && isStudyKanji(chars[index])) {
    index += 1;
  }

  let kanaEnd = index;
  while (kanaEnd < chars.length && HIRAGANA_OR_CHOON.test(chars[kanaEnd])) {
    kanaEnd += 1;
  }

  const kana = chars.slice(index, kanaEnd).join("");
  if (kana && !isParticleChunk(kana)) {
    index = kanaEnd;
  }

  return {
    text: chars.slice(start, index).join(""),
    next: index
  };
}

function isParticleChunk(kana: string): boolean {
  return /^(?:から|まで|より|は|が|を|に|へ|と|で|も|の|や|ね|よ|か|わ|さ)+$/u.test(kana);
}

/** Kanji compounds and kanji+okurigana tokens that are literal slices of a Japanese run. */
export function segmentStudyTokens(run: string): string[] {
  const chars = [...run];

  if (!chars.some((character) => isStudyKanji(character))) {
    return [];
  }

  const tokens: string[] = [];
  let index = 0;

  while (index < chars.length) {
    const character = chars[index];

    if (!isStudyKanji(character)) {
      const honorific =
        (character === "お" || character === "ご") &&
        index + 1 < chars.length &&
        isStudyKanji(chars[index + 1]);

      if (honorific) {
        const token = readKanjiToken(chars, index + 1);
        const text = `${character}${token.text}`;
        if (text.length <= 16) {
          tokens.push(text);
        }
        index = token.next;
        continue;
      }

      index += 1;
      continue;
    }

    const token = readKanjiToken(chars, index);
    if (token.text.length > 0 && token.text.length <= 16) {
      tokens.push(token.text);
    }
    index = token.next;
  }

  return tokens;
}
