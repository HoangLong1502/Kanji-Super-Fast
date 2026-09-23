import { extractKanjiCharacters, normalizePptText } from "./japanese.js";
import { extractPptxText } from "./pptxExtractor.js";
import { JapaneseRunVocabularyAnalyzer } from "./vocabularyAnalyzer.js";
import type {
  DictionaryProvider,
  ExtractedSlideText,
  KanjiEntry,
  LessonExtractionResult,
  PptExtractionOptions,
  SourceLocation,
  VocabularyAnalyzer,
  VocabularyCandidate,
  VocabularyEntry
} from "./types.js";

export interface LessonPipelineOptions extends PptExtractionOptions {
  vocabularyAnalyzer?: VocabularyAnalyzer;
  dictionary?: DictionaryProvider;
}

export async function extractLessonFromPptx(
  pptxPath: string,
  options: LessonPipelineOptions = {}
): Promise<LessonExtractionResult> {
  const slides = await extractPptxText(pptxPath, options);
  return extractLessonFromSlides(slides, options);
}

export async function extractLessonFromSlides(
  slides: ExtractedSlideText[],
  options: LessonPipelineOptions = {}
): Promise<LessonExtractionResult> {
  const analyzer = options.vocabularyAnalyzer ?? new JapaneseRunVocabularyAnalyzer();
  const candidates = await analyzer.extractVocabulary(slides);
  const vocabulary = await enrichValidatedVocabulary(candidates, slides, options.dictionary);
  const kanji = extractKanjiFromSlides(slides);
  const result: LessonExtractionResult = {
    vocabulary,
    kanji,
    rawSlides: slides
  };

  validateLessonResult(result);
  return result;
}

async function enrichValidatedVocabulary(
  candidates: VocabularyCandidate[],
  slides: ExtractedSlideText[],
  dictionary: DictionaryProvider | undefined
): Promise<VocabularyEntry[]> {
  const byWord = new Map<string, VocabularyCandidate>();

  for (const candidate of candidates) {
    validateVocabularyCandidate(candidate, slides);

    const existing = byWord.get(candidate.word);
    if (existing) {
      existing.sourceLocations.push(...candidate.sourceLocations);
    } else {
      byWord.set(candidate.word, {
        word: candidate.word,
        sourceLocations: [...candidate.sourceLocations]
      });
    }
  }

  const vocabulary: VocabularyEntry[] = [];

  for (const candidate of byWord.values()) {
    const metadata = await dictionary?.lookup(candidate.word);
    vocabulary.push({
      word: candidate.word,
      ...metadata,
      sourceLocations: dedupeSourceLocations(candidate.sourceLocations)
    });
  }

  return vocabulary.sort((left, right) => left.word.localeCompare(right.word, "ja"));
}

function extractKanjiFromSlides(slides: ExtractedSlideText[]): KanjiEntry[] {
  const byKanji = new Map<string, KanjiEntry>();

  for (const slide of slides) {
    for (const kanji of extractKanjiCharacters(slide.rawText)) {
      const entry = byKanji.get(kanji);
      const sourceLocation: SourceLocation = {
        slideNumber: slide.slideNumber,
        rawText: slide.rawText,
        sourceText: kanji,
        sourceType: slide.sourceType
      };

      if (entry) {
        entry.sourceLocations.push(sourceLocation);
      } else {
        byKanji.set(kanji, {
          kanji,
          sourceLocations: [sourceLocation]
        });
      }
    }
  }

  return [...byKanji.values()]
    .map((entry) => ({
      ...entry,
      sourceLocations: dedupeSourceLocations(entry.sourceLocations)
    }))
    .sort((left, right) => left.kanji.localeCompare(right.kanji, "ja"));
}

export function validateLessonResult(result: LessonExtractionResult): void {
  for (const vocabulary of result.vocabulary) {
    validateVocabularyCandidate({
      word: vocabulary.word,
      sourceLocations: vocabulary.sourceLocations
    }, result.rawSlides);
  }

  for (const kanji of result.kanji) {
    for (const location of kanji.sourceLocations) {
      validateSourceLocation(location, kanji.kanji, "kanji", result.rawSlides);
    }
  }
}

function validateVocabularyCandidate(candidate: VocabularyCandidate, slides: ExtractedSlideText[]): void {
  if (candidate.sourceLocations.length === 0) {
    throw new Error(`Vocabulary "${candidate.word}" has no PPT source location.`);
  }

  for (const location of candidate.sourceLocations) {
    validateSourceLocation(location, candidate.word, "vocabulary", slides);
  }
}

function validateSourceLocation(
  location: SourceLocation,
  extractedValue: string,
  valueType: "kanji" | "vocabulary",
  slides: ExtractedSlideText[]
): void {
  const matchingSlide = slides.find(
    (slide) =>
      slide.slideNumber === location.slideNumber &&
      slide.sourceType === location.sourceType &&
      slide.rawText === location.rawText
  );

  if (!matchingSlide) {
    throw new Error(
      `${valueType} "${extractedValue}" references slide ${location.slideNumber}, but that raw text was not extracted from the PPT.`
    );
  }

  if (!location.rawText.includes(location.sourceText)) {
    throw new Error(
      `${valueType} sourceText "${location.sourceText}" was not found in raw PPT text for slide ${location.slideNumber}.`
    );
  }

  if (!normalizePptText(location.rawText).includes(normalizePptText(extractedValue))) {
    throw new Error(
      `${valueType} "${extractedValue}" was not found in extracted PPT text for slide ${location.slideNumber}.`
    );
  }
}

function dedupeSourceLocations(locations: SourceLocation[]): SourceLocation[] {
  const seen = new Set<string>();

  return locations.filter((location) => {
    const key = [
      location.slideNumber,
      location.sourceType,
      location.rawText,
      location.sourceText
    ].join("\u0000");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
