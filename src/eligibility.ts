import { isKanji } from "./japanese.js";

export type VocabularyType =
  | "compound_noun"
  | "verb"
  | "suru_verb"
  | "adjective"
  | "adverb"
  | "other";

export function countKanji(value: string): number {
  return [...value].filter((character) => isKanji(character)).length;
}

export function classifyVocabulary(writtenForm: string): VocabularyType {
  const kanjiCount = countKanji(writtenForm);

  if (kanjiCount === 0) {
    return "other";
  }

  if (/する$/u.test(writtenForm)) {
    return "suru_verb";
  }

  if (writtenForm.includes("々")) {
    return "adverb";
  }

  if (/[\u3040-\u309f]/u.test(writtenForm)) {
    if (/[い]$/u.test(writtenForm)) {
      return "adjective";
    }

    return "verb";
  }

  return "compound_noun";
}

export function isIsolatedKanji(writtenForm: string): boolean {
  return [...writtenForm].length === 1 && countKanji(writtenForm) === 1;
}

export function eligibleHanVietQuestion(hanViet: string): boolean {
  return hanViet.trim().length > 0;
}

export function eligibleReadingQuestion(writtenForm: string, hiragana: string): boolean {
  if (!hiragana.trim() || isIsolatedKanji(writtenForm)) {
    return false;
  }

  return countKanji(writtenForm) > 0;
}

export function sortUnreviewedFirst<T extends { id: string }>(items: T[], incorrectIds: ReadonlySet<string>): T[] {
  return [...items].sort((left, right) => Number(incorrectIds.has(right.id)) - Number(incorrectIds.has(left.id)));
}
