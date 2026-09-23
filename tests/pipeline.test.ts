import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createExactMatchDictionary, extractLessonFromSlides } from "../src/index.js";
import type { ExtractedSlideText, VocabularyAnalyzer } from "../src/index.js";

const slides: ExtractedSlideText[] = [
  {
    slideNumber: 2,
    rawText: "学生",
    normalizedText: "学生",
    sourceType: "slide_text"
  },
  {
    slideNumber: 5,
    rawText: "今日は学校へ行きます。",
    normalizedText: "今日は学校へ行きます。",
    sourceType: "slide_text"
  },
  {
    slideNumber: 8,
    rawText: "学生",
    normalizedText: "学生",
    sourceType: "slide_text"
  }
];

describe("strict PPT source-of-truth pipeline", () => {
  it("extracts kanji and vocabulary only from PPT text with traceable source locations", async () => {
    const result = await extractLessonFromSlides(slides);
    const student = result.vocabulary.find((entry) => entry.word === "学生");

    assert.deepEqual(student?.sourceLocations.map((location) => location.slideNumber), [2, 8]);
    const kanji = result.kanji.map((entry) => entry.kanji);
    assert.equal(kanji.includes("学"), true);
    assert.equal(kanji.includes("生"), true);
    assert.equal(kanji.includes("校"), true);
    assert.equal(result.kanji.find((entry) => entry.kanji === "大"), undefined);
  });

  it("uses dictionary only as exact metadata lookup for extracted words", async () => {
    const analyzer: VocabularyAnalyzer = {
      extractVocabulary: () => [
        {
          word: "学校",
          sourceLocations: [
            {
              slideNumber: 5,
              rawText: "今日は学校へ行きます。",
              sourceText: "学校",
              sourceType: "slide_text"
            }
          ]
        }
      ]
    };

    const dictionary = createExactMatchDictionary({
      学校: {
        reading: "がっこう",
        meaning: "school"
      },
      学校生活: {
        reading: "がっこうせいかつ",
        meaning: "school life"
      }
    });

    const result = await extractLessonFromSlides(slides, { vocabularyAnalyzer: analyzer, dictionary });

    assert.equal(result.vocabulary.length, 1);
    assert.deepEqual(
      {
        word: result.vocabulary[0].word,
        reading: result.vocabulary[0].reading,
        romaji: result.vocabulary[0].romaji,
        meaning: result.vocabulary[0].meaning
      },
      {
      word: "学校",
      reading: "がっこう",
      romaji: "gakkou",
      meaning: "school"
      }
    );
  });

  it("rejects AI or analyzer vocabulary that does not exist in extracted PPT text", async () => {
    const analyzer: VocabularyAnalyzer = {
      extractVocabulary: () => [
        {
          word: "大学",
          sourceLocations: [
            {
              slideNumber: 2,
              rawText: "学生",
              sourceText: "学生",
              sourceType: "slide_text"
            }
          ]
        }
      ]
    };

    await assert.rejects(
      extractLessonFromSlides(slides, { vocabularyAnalyzer: analyzer }),
      /vocabulary "大学" was not found in extracted PPT text/
    );
  });

  it("rejects fabricated source locations even when the word appears in the fabricated raw text", async () => {
    const analyzer: VocabularyAnalyzer = {
      extractVocabulary: () => [
        {
          word: "日本",
          sourceLocations: [
            {
              slideNumber: 99,
              rawText: "日本",
              sourceText: "日本",
              sourceType: "slide_text"
            }
          ]
        }
      ]
    };

    await assert.rejects(
      extractLessonFromSlides(slides, { vocabularyAnalyzer: analyzer }),
      /raw text was not extracted from the PPT/
    );
  });
});
