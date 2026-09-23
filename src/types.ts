export type SourceType = "slide_text" | "notes_text";

export interface PptTextSource {
  slideNumber: number;
  rawText: string;
  sourceType: SourceType;
}

export interface ExtractedSlideText {
  slideNumber: number;
  rawText: string;
  normalizedText: string;
  sourceType: SourceType;
}

export interface SourceLocation {
  slideNumber: number;
  rawText: string;
  sourceText: string;
  sourceType: SourceType;
}

export interface DictionaryMetadata {
  reading?: string;
  romaji?: string;
  meaning?: string;
}

export interface VocabularyEntry extends DictionaryMetadata {
  word: string;
  sourceLocations: SourceLocation[];
}

export interface KanjiEntry {
  kanji: string;
  sourceLocations: SourceLocation[];
}

export interface LessonExtractionResult {
  vocabulary: VocabularyEntry[];
  kanji: KanjiEntry[];
  rawSlides: ExtractedSlideText[];
}

export interface VocabularyCandidate {
  word: string;
  sourceLocations: SourceLocation[];
}

export interface VocabularyAnalyzer {
  extractVocabulary(slides: ExtractedSlideText[]): Promise<VocabularyCandidate[]> | VocabularyCandidate[];
}

export interface DictionaryProvider {
  lookup(word: string): Promise<DictionaryMetadata | undefined> | DictionaryMetadata | undefined;
}

export interface PptExtractionOptions {
  includeNotes?: boolean;
}
