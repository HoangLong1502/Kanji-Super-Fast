import { containsJapanese, extractJapaneseRuns, normalizePptText } from "./japanese.js";
import type { ExtractedSlideText, SourceLocation, VocabularyAnalyzer, VocabularyCandidate } from "./types.js";

export class JapaneseRunVocabularyAnalyzer implements VocabularyAnalyzer {
  extractVocabulary(slides: ExtractedSlideText[]): VocabularyCandidate[] {
    const byWord = new Map<string, VocabularyCandidate>();

    for (const slide of slides) {
      for (const sourceText of extractJapaneseRuns(slide.rawText)) {
        const word = normalizePptText(sourceText);

        if (!word || !containsJapanese(word)) {
          continue;
        }

        const sourceLocation: SourceLocation = {
          slideNumber: slide.slideNumber,
          rawText: slide.rawText,
          sourceText,
          sourceType: slide.sourceType
        };

        const existing = byWord.get(word);
        if (existing) {
          existing.sourceLocations.push(sourceLocation);
        } else {
          byWord.set(word, { word, sourceLocations: [sourceLocation] });
        }
      }
    }

    return [...byWord.values()];
  }
}
