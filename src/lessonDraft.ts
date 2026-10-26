import { toHiragana } from "wanakana";
import { classifyVocabulary, isIsolatedKanji } from "./eligibility.js";
import { containsJapanese, isKanji, segmentStudyTokens } from "./japanese.js";

export type FieldOrigin = "none" | "source" | "suggested" | "verified";

export interface SourceBlock {
  page: number;
  text: string;
}

export interface DraftKanji {
  character: string;
  hanViet: string;
  hanVietOrigin: FieldOrigin;
  meanings: string[];
  meaningOrigin: FieldOrigin;
  onReadings: string[];
  onOrigin: FieldOrigin;
  kunReadings: string[];
  kunOrigin: FieldOrigin;
  verificationStatus: "unverified" | "source" | "suggested" | "verified";
  sourcePages: number[];
  sourceExcerpt: string;
  notes: string;
  sortOrder: number;
}

export interface DraftVocabulary {
  writtenForm: string;
  hiragana: string;
  katakana: string;
  readingOrigin: FieldOrigin;
  meanings: string[];
  meaningOrigin: FieldOrigin;
  vocabularyType: string;
  readingVariants: string[];
  kanjiCharacters: string[];
  notes: string;
  verificationStatus: "unverified" | "source" | "suggested" | "verified";
  sourcePages: number[];
  sourceExcerpt: string;
  sortOrder: number;
}

export interface DraftUncertain {
  text: string;
  sourcePage: number | null;
}

export interface LessonDraft {
  title: string;
  lessonNumber: number | null;
  jlptLevel: string | null;
  blocks: SourceBlock[];
  kanji: DraftKanji[];
  vocabulary: DraftVocabulary[];
  uncertain: DraftUncertain[];
  warnings: string[];
}

export interface DictionaryLookup {
  lookupWord(word: string): Promise<{ reading?: string; meaning?: string } | undefined>;
  lookupKanji(character: string): Promise<{ hanViet?: string; on?: string[]; kun?: string[]; meaning?: string } | undefined>;
}

const WORD = "[〜～]?[\\u3040-\\u30ff\\u3400-\\u9fff\\uf900-\\ufaff々〆ー]+";
const KANA = "[〜～]?[\\u3040-\\u30ffー]+";

export function parseLessonDocument(blocks: SourceBlock[], filename = "bài học"): LessonDraft {
  const kanji = new Map<string, DraftKanji>();
  const vocabulary = new Map<string, DraftVocabulary>();
  const uncertain: DraftUncertain[] = [];
  const warnings: string[] = [];
  let title = filename.replace(/\.[^.]+$/u, "") || "Bài học";
  let lessonNumber: number | null = null;
  let jlptLevel: string | null = null;
  let currentKanji: string | null = null;
  let sort = 0;

  for (const block of blocks) {
    const lines = block.text.split(/\n+/u).map((line) => line.trim()).filter(Boolean);

    for (const line of lines) {
      const heading = matchLessonHeading(line);
      if (heading) {
        lessonNumber = lessonNumber ?? heading.number;
        if (heading.title) {
          title = heading.title;
        }
        const rest = line.replace(heading.matched, "").trim();
        if (!rest) {
          continue;
        }
      }

      const jlpt = line.match(/JLPT\s*N([1-5])\b/iu);
      if (jlpt) {
        jlptLevel = `N${jlpt[1]}`;
        if (line.trim().length <= `JLPT N${jlpt[1]}`.length + 2) {
          continue;
        }
      }

      // Âm on/kun trên thẻ (トウ / あたま) ngay sau kanji hiện tại, không cần nhãn 音/訓.
      if (currentKanji && /^[\u3040-\u30ffー・.．]+$/u.test(line)) {
        const readings = splitListedReadings(line);
        if (readings.length > 0) {
          const entry = kanji.get(currentKanji);
          const kind = /[\u30a0-\u30ff]/u.test(line) ? "on" : "kun";
          addListedReadings(entry, kind, readings);
          continue;
        }
      }

      const labeled = line.match(/^(音|訓)(?:読み)?\s*[:：]\s*(.*)$/u);
      if (labeled) {
        const kind = labeled[1] === "音" ? "on" : "kun";
        const rest = labeled[2].trim();
        const vocab = rest ? parseVocabularyLine(rest) : null;

        if (vocab) {
          addVocabulary(vocabulary, vocab, block.page, line, () => {
            sort += 1;
            return sort;
          });
          continue;
        }

        const readings = splitListedReadings(rest);
        if (readings.length > 0 && currentKanji) {
          addListedReadings(kanji.get(currentKanji), kind, readings);
          continue;
        }

        uncertain.push({ text: line, sourcePage: block.page });
        continue;
      }

      const header = parseKanjiHeader(line) ?? parseKanjiHeader(line.replace(/^\d+\s*[.)、]?\s*/u, ""));
      if (header) {
        currentKanji = header.character;
        const entry = ensureKanji(kanji, header.character, block.page, line, () => {
          sort += 1;
          return sort;
        });
        if (header.hanViet && entry.hanVietOrigin !== "source" && entry.hanVietOrigin !== "verified") {
          entry.hanViet = header.hanViet;
          entry.hanVietOrigin = "source";
        }
        if (header.meaning) {
          pushUnique(entry.meanings, header.meaning);
          if (entry.meaningOrigin === "none") {
            entry.meaningOrigin = "source";
          }
        }
        refreshKanjiStatus(entry);
        continue;
      }

      const vocab = parseVocabularyLine(line);
      if (vocab) {
        if (isIsolatedKanji(vocab.word)) {
          currentKanji = vocab.word;
          const entry = ensureKanji(kanji, vocab.word, block.page, line, () => {
            sort += 1;
            return sort;
          });
          rememberUnclassifiedReading(entry, vocab.reading);
          if (vocab.meaning) {
            pushUnique(entry.meanings, vocab.meaning);
            if (entry.meaningOrigin === "none") {
              entry.meaningOrigin = "source";
            }
          }
          refreshKanjiStatus(entry);
          continue;
        }

        addVocabulary(vocabulary, vocab, block.page, line, () => {
          sort += 1;
          return sort;
        });
        continue;
      }

      if (!containsJapanese(line)) {
        if (line.length > 1 && !/^[\d.\s)]+$/u.test(line)) {
          uncertain.push({ text: line, sourcePage: block.page });
        }
        continue;
      }

      const tokens = segmentStudyTokens(line);
      const wholeLineIsToken = tokens.length === 1 && tokens[0] === line.replace(/\s+/g, "");

      if (tokens.length === 0) {
        uncertain.push({ text: line, sourcePage: block.page });
        continue;
      }

      for (const token of tokens) {
        if (isIsolatedKanji(token)) {
          // Chữ kanji đứng một mình (ô tổng quan 1–12, hoặc thẻ chưa có Hán Việt) mới là kanji cần học.
          currentKanji = token;
          ensureKanji(kanji, token, block.page, line, () => {
            sort += 1;
            return sort;
          });
          continue;
        }

        // Từ ghép / cụm: chỉ vào vocabulary, không tách từng chữ thành kanji bài học.
        addVocabulary(
          vocabulary,
          { word: token, reading: "", katakana: "", meaning: "" },
          block.page,
          line,
          () => {
            sort += 1;
            return sort;
          }
        );
      }

      if (!wholeLineIsToken) {
        uncertain.push({ text: line, sourcePage: block.page });
      }
    }
  }

  if (lessonNumber !== null && /^bài học$/iu.test(title)) {
    title = `Bài ${lessonNumber}`;
  }

  if (kanji.size === 0 && vocabulary.size === 0) {
    warnings.push("Không tách được kanji hoặc từ vựng. Phần chữ chưa phân loại vẫn được giữ để sửa tay.");
  }

  const missingReadings = [...vocabulary.values()].filter((entry) => !entry.hiragana).length;
  if (missingReadings > 0) {
    warnings.push(`${missingReadings} từ chưa có hiragana trong file. Chúng được đánh dấu chưa rõ, không tự bịa âm.`);
  }

  return {
    title,
    lessonNumber,
    jlptLevel,
    blocks,
    kanji: [...kanji.values()].sort((left, right) => left.sortOrder - right.sortOrder),
    vocabulary: [...vocabulary.values()].sort((left, right) => left.sortOrder - right.sortOrder),
    uncertain,
    warnings
  };
}

export async function applyDictionarySuggestions(draft: LessonDraft, dictionary: DictionaryLookup): Promise<LessonDraft> {
  const next: LessonDraft = {
    ...draft,
    kanji: draft.kanji.map((entry) => ({ ...entry, meanings: [...entry.meanings], onReadings: [...entry.onReadings], kunReadings: [...entry.kunReadings], sourcePages: [...entry.sourcePages] })),
    vocabulary: draft.vocabulary.map((entry) => ({
      ...entry,
      meanings: [...entry.meanings],
      readingVariants: [...entry.readingVariants],
      kanjiCharacters: [...entry.kanjiCharacters],
      sourcePages: [...entry.sourcePages]
    })),
    uncertain: [...draft.uncertain],
    warnings: [...draft.warnings]
  };

  await mapPool(next.vocabulary, 4, async (entry) => {
    if (entry.hiragana || entry.readingOrigin === "source" || entry.readingOrigin === "verified") {
      return;
    }

    const suggestion = await dictionary.lookupWord(entry.writtenForm);
    if (!suggestion) {
      return;
    }

    if (suggestion.reading) {
      const stored = storeReading(suggestion.reading);
      entry.hiragana = stored.hiragana;
      entry.katakana = stored.katakana;
      entry.readingOrigin = "suggested";
    }

    if (suggestion.meaning && entry.meanings.length === 0) {
      entry.meanings.push(suggestion.meaning);
      entry.meaningOrigin = "suggested";
    }

    refreshVocabStatus(entry);
  });

  await mapPool(next.kanji, 4, async (entry) => {
    const needsHan = !entry.hanViet;
    const needsReading = entry.onReadings.length === 0 && entry.kunReadings.length === 0;
    const needsMeaning = entry.meanings.length === 0;
    if (!needsHan && !needsReading && !needsMeaning) {
      return;
    }

    const suggestion = await dictionary.lookupKanji(entry.character);
    if (!suggestion) {
      return;
    }

    if (needsHan && suggestion.hanViet) {
      entry.hanViet = suggestion.hanViet;
      entry.hanVietOrigin = "suggested";
    }

    if (entry.onReadings.length === 0 && suggestion.on && suggestion.on.length > 0 && entry.onOrigin !== "source") {
      entry.onReadings = suggestion.on;
      entry.onOrigin = "suggested";
    }

    if (entry.kunReadings.length === 0 && suggestion.kun && suggestion.kun.length > 0 && entry.kunOrigin !== "source") {
      entry.kunReadings = suggestion.kun;
      entry.kunOrigin = "suggested";
    }

    if (needsMeaning && suggestion.meaning) {
      entry.meanings.push(suggestion.meaning);
      entry.meaningOrigin = "suggested";
    }

    refreshKanjiStatus(entry);
  });

  return next;
}

export function parseVocabularyLine(line: string): { word: string; reading: string; katakana: string; meaning: string } | null {
  const stripped = line.replace(/^\d+\s*[.)、]\s*/u, "").trim();
  const patterns = [
    new RegExp(`^(${WORD})\\s*[（(]\\s*(${KANA})\\s*(?:[-–—]\\s*[A-Za-zĀ-ūā-ū'’\\s]+)?\\s*[）)]\\s*[:：]\\s*(.+)$`, "u"),
    new RegExp(`^(${WORD})\\s*[（(]\\s*(${KANA})\\s*[）)]\\s*[:：\\-–—]?\\s*(.*)$`, "u"),
    new RegExp(`^(${WORD})\\s+(${KANA})\\s*[:：]\\s*(.+)$`, "u"),
    new RegExp(`^([〜～]?[\\u3400-\\u9fff々〆][\\u3040-\\u309f々〆ー\\u3400-\\u9fff]{0,14})\\s+(${KANA})\\s+(\\S.+)$`, "u"),
    // Từ ghép + hiragana (không có nghĩa), dạng slide: 先頭 せんとう / ～頭 とう
    new RegExp(`^(${WORD})\\s+(${KANA})$`, "u")
  ];

  for (const pattern of patterns) {
    const match = stripped.match(pattern);
    if (!match) {
      continue;
    }

    const word = match[1];
    if (!isKanji(word) && ![...word].some((character) => isKanji(character) || character === "々")) {
      continue;
    }

    const stored = storeReading(match[2]);
    return {
      word,
      reading: stored.hiragana,
      katakana: stored.katakana,
      meaning: (match[3] ?? "").trim()
    };
  }

  return null;
}

function parseKanjiHeader(line: string): { character: string; hanViet: string; meaning: string } | null {
  const match = line.match(/^([\u3400-\u9fff\uf900-\ufaff])\s*(?:[（(]\s*([^）)]+)\s*[）)]|[:：\-–—]\s*(\S+))?\s*(.*)$/u);
  if (!match) {
    return null;
  }

  const character = match[1];
  const paren = (match[2] ?? match[3] ?? "").trim();
  const rest = (match[4] ?? "").trim();

  if (!paren && rest) {
    return null;
  }

  if (paren && /[\u3040-\u30ff]/u.test(paren)) {
    return null;
  }

  if (paren && !isHanVietToken(paren)) {
    return null;
  }

  if (!paren && rest) {
    return null;
  }

  return {
    character,
    hanViet: paren ? paren.toLocaleUpperCase("vi") : "",
    meaning: isHanVietToken(rest) ? "" : rest
  };
}

function matchLessonHeading(line: string): { number: number; title: string; matched: string } | null {
  const vietnamese = line.match(/(?:^|\s)(bài\s*(\d+))/iu);
  const english = line.match(/(?:^|\s)(lesson\s*(\d+))/iu);
  const japanese = line.match(/(第\s*(\d+)\s*課)/u);
  const match = vietnamese ?? english ?? japanese;

  if (!match) {
    return null;
  }

  const number = Number(match[2]);
  if (!Number.isInteger(number)) {
    return null;
  }

  return {
    number,
    title: `Bài ${number}`,
    matched: match[1]
  };
}

function isHanVietToken(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || /[\u3040-\u30ff\u3400-\u9fff]/u.test(trimmed)) {
    return false;
  }

  const letters = trimmed.replace(/[^A-Za-zÀ-ỹĂăÂâÊêÔôƠơƯưĐđ]/gu, "");
  return letters.length > 0 && letters === letters.toLocaleUpperCase("vi");
}

function splitListedReadings(value: string): string[] {
  return value
    .split(/[、,，/／]|\s{2,}/u)
    .flatMap((part) => part.trim().split(/\s+/u))
    .map((part) => part.trim())
    .filter((part) => part && /^[\u3040-\u30ffー・.．]+$/u.test(part))
    .map((part) => toHiragana(part, { passRomaji: true }));
}

function storeReading(reading: string): { hiragana: string; katakana: string } {
  const trimmed = reading.normalize("NFC").trim();
  const katakana = /[\u30a0-\u30ff]/u.test(trimmed) && !/[\u3040-\u309f]/u.test(trimmed) ? trimmed : "";

  return {
    hiragana: toHiragana(trimmed, { passRomaji: true }),
    katakana
  };
}

function ensureKanji(
  kanji: Map<string, DraftKanji>,
  character: string,
  page: number,
  excerpt: string,
  nextSort: () => number
): DraftKanji {
  const existing = kanji.get(character);
  if (existing) {
    pushUniqueNumber(existing.sourcePages, page);
    return existing;
  }

  const entry: DraftKanji = {
    character,
    hanViet: "",
    hanVietOrigin: "none",
    meanings: [],
    meaningOrigin: "none",
    onReadings: [],
    onOrigin: "none",
    kunReadings: [],
    kunOrigin: "none",
    verificationStatus: "unverified",
    sourcePages: [page],
    sourceExcerpt: excerpt,
    notes: "",
    sortOrder: nextSort()
  };
  kanji.set(character, entry);
  return entry;
}

function addListedReadings(entry: DraftKanji | undefined, kind: "on" | "kun", readings: string[]): void {
  if (!entry) {
    return;
  }

  const target = kind === "on" ? entry.onReadings : entry.kunReadings;
  for (const reading of readings) {
    pushUnique(target, reading);
  }

  if (kind === "on" && entry.onOrigin === "none") {
    entry.onOrigin = "source";
  }

  if (kind === "kun" && entry.kunOrigin === "none") {
    entry.kunOrigin = "source";
  }

  refreshKanjiStatus(entry);
}

function rememberUnclassifiedReading(entry: DraftKanji, reading: string): void {
  if (!reading) {
    return;
  }

  const note = `Âm trong file, chưa ghi là on hay kun: ${reading}`;
  entry.notes = entry.notes ? `${entry.notes}\n${note}` : note;
}

function addVocabulary(
  vocabulary: Map<string, DraftVocabulary>,
  parsed: { word: string; reading: string; katakana: string; meaning: string },
  page: number,
  excerpt: string,
  nextSort: () => number
): void {
  const key = `${parsed.word}\u0000${parsed.reading}`;
  const existing = findExistingVocabulary(vocabulary, parsed.word, parsed.reading, key);

  if (existing) {
    if (parsed.meaning) {
      pushUnique(existing.meanings, parsed.meaning);
      if (existing.meaningOrigin === "none") {
        existing.meaningOrigin = "source";
      }
    }
    pushUniqueNumber(existing.sourcePages, page);
    refreshVocabStatus(existing);
    return;
  }

  // Chỉ gắn với kanji đã có trong bài (thẻ kanji cần học). Không tạo kanji mới từ chữ phụ trong từ ghép
  // (vd: 先頭/頭痛 → vocabulary; không thêm 先 thành kanji bài học).
  const characters = kanjiCharactersIn(parsed.word);

  const entry: DraftVocabulary = {
    writtenForm: parsed.word,
    hiragana: parsed.reading,
    katakana: parsed.katakana,
    readingOrigin: parsed.reading ? "source" : "none",
    meanings: parsed.meaning ? [parsed.meaning] : [],
    meaningOrigin: parsed.meaning ? "source" : "none",
    vocabularyType: classifyVocabulary(parsed.word),
    readingVariants: [],
    kanjiCharacters: characters,
    notes: "",
    verificationStatus: parsed.reading ? "source" : "unverified",
    sourcePages: [page],
    sourceExcerpt: excerpt,
    sortOrder: nextSort()
  };
  vocabulary.set(key, entry);
}

function findExistingVocabulary(
  vocabulary: Map<string, DraftVocabulary>,
  word: string,
  reading: string,
  key: string
): DraftVocabulary | undefined {
  const exact = vocabulary.get(key);
  if (exact) {
    return exact;
  }

  if (reading) {
    const emptyKey = `${word}\u0000`;
    const empty = vocabulary.get(emptyKey);
    if (empty) {
      vocabulary.delete(emptyKey);
      empty.hiragana = reading;
      empty.readingOrigin = "source";
      empty.verificationStatus = "source";
      vocabulary.set(key, empty);
      return empty;
    }

    return undefined;
  }

  return [...vocabulary.values()].find((entry) => entry.writtenForm === word);
}

function kanjiCharactersIn(word: string): string[] {
  const characters: string[] = [];

  for (const character of word) {
    if (isKanji(character) && !characters.includes(character)) {
      characters.push(character);
    }
  }

  return characters;
}

function refreshKanjiStatus(entry: DraftKanji): void {
  if (entry.verificationStatus === "verified") {
    return;
  }

  const origins = [entry.hanVietOrigin, entry.onOrigin, entry.kunOrigin, entry.meaningOrigin];
  if (origins.includes("source")) {
    entry.verificationStatus = "source";
    return;
  }

  if (origins.includes("suggested")) {
    entry.verificationStatus = "suggested";
    return;
  }

  entry.verificationStatus = "unverified";
}

function refreshVocabStatus(entry: DraftVocabulary): void {
  if (entry.verificationStatus === "verified") {
    return;
  }

  if (entry.readingOrigin === "source" || entry.meaningOrigin === "source") {
    entry.verificationStatus = "source";
    return;
  }

  if (entry.readingOrigin === "suggested" || entry.meaningOrigin === "suggested") {
    entry.verificationStatus = "suggested";
    return;
  }

  entry.verificationStatus = "unverified";
}

function pushUnique(values: string[], value: string): void {
  const trimmed = value.trim();
  if (trimmed && !values.includes(trimmed)) {
    values.push(trimmed);
  }
}

function pushUniqueNumber(values: number[], value: number): void {
  if (!values.includes(value)) {
    values.push(value);
  }
}

async function mapPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0;

  async function run(): Promise<void> {
    while (next < items.length) {
      const index = next;
      next += 1;
      await worker(items[index]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => run());
  await Promise.all(workers);
}
