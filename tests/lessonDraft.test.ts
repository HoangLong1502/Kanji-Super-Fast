import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyDictionarySuggestions, parseLessonDocument } from "../src/lessonDraft.js";
import { eligibleReadingQuestion } from "../src/eligibility.js";

const textbook = `
Bài 11
JLPT N5
時 (THỜI)
音: ジ
訓: とき
1. 時間 (じかん): thời gian
2. 時間割 (じかんわり): thời khóa biểu
3. 何時 (なんじ): mấy giờ
4. 時々 (ときどき): thỉnh thoảng
勉強する (べんきょうする): học tập
`.trim();

describe("lesson draft parser", () => {
  it("detects the lesson, groups compounds under every included kanji, and keeps full readings", () => {
    const draft = parseLessonDocument([{ page: 3, text: textbook }], "lesson.pptx");
    const time = draft.kanji.find((entry) => entry.character === "時");
    const hour = draft.vocabulary.find((entry) => entry.writtenForm === "時間");
    const sometimes = draft.vocabulary.find((entry) => entry.writtenForm === "時々");
    const study = draft.vocabulary.find((entry) => entry.writtenForm === "勉強する");

    assert.equal(draft.lessonNumber, 11);
    assert.equal(draft.title, "Bài 11");
    assert.equal(draft.jlptLevel, "N5");
    assert.equal(time?.hanViet, "THỜI");
    assert.equal(time?.hanVietOrigin, "source");
    assert.deepEqual(time?.onReadings, ["じ"]);
    assert.deepEqual(time?.kunReadings, ["とき"]);
    assert.equal(hour?.hiragana, "じかん");
    assert.deepEqual(hour?.meanings, ["thời gian"]);
    assert.deepEqual(hour?.kanjiCharacters, ["時", "間"]);
    assert.equal(sometimes?.hiragana, "ときどき");
    assert.equal(sometimes?.vocabularyType, "adverb");
    assert.equal(study?.vocabularyType, "suru_verb");
    assert.equal(study?.hiragana, "べんきょうする");
    assert.equal(draft.vocabulary.some((entry) => entry.writtenForm === "時"), false);
    assert.equal(eligibleReadingQuestion("時", "とき"), false);
    assert.equal(eligibleReadingQuestion("勉強する", "べんきょうする"), true);
  });

  it("does not invent a reading for a sentence, and does not add words that are absent", () => {
    const draft = parseLessonDocument(
      [{ page: 1, text: "今日は学校へ行きます。" }],
      "notes.pptx"
    );
    const words = draft.vocabulary.map((entry) => entry.writtenForm);

    assert.deepEqual(words, ["今日", "学校", "行きます"]);
    assert.equal(draft.vocabulary.every((entry) => entry.hiragana === ""), true);
    assert.equal(draft.vocabulary.every((entry) => entry.verificationStatus === "unverified"), true);
    assert.equal(words.includes("大学"), false);
    assert.equal(draft.uncertain.some((entry) => entry.text.includes("学校")), true);
  });

  it("keeps okurigana on the word and does not treat it as a separate particle", () => {
    const draft = parseLessonDocument([{ page: 1, text: "明るい (あかるい): sáng\n時々" }], "a.pptx");
    assert.equal(draft.vocabulary.some((entry) => entry.writtenForm === "明るい" && entry.hiragana === "あかるい"), true);
    assert.equal(draft.vocabulary.some((entry) => entry.writtenForm === "時々"), true);
  });

  it("merges the same word instead of duplicating it", () => {
    const draft = parseLessonDocument(
      [
        { page: 1, text: "時間 (じかん): thời gian" },
        { page: 4, text: "時間 (じかん): tiếng đồng hồ" }
      ],
      "dup.pptx"
    );

    assert.equal(draft.vocabulary.length, 1);
    assert.deepEqual(draft.vocabulary[0]?.meanings, ["thời gian", "tiếng đồng hồ"]);
    assert.deepEqual(draft.vocabulary[0]?.sourcePages, [1, 4]);
  });

  it("lets a dictionary fill only empty fields and never adds extra compounds", async () => {
    const draft = parseLessonDocument([{ page: 1, text: "学 (HỌC)\n学生\n学校 (がっこう): trường học" }], "a.pptx");
    const enriched = await applyDictionarySuggestions(draft, {
      async lookupWord(word: string) {
        if (word === "学生") {
          return { reading: "がくせい", meaning: "học sinh" };
        }
        return { reading: "SHOULD_NOT_REPLACE", meaning: "SHOULD_NOT_REPLACE" };
      },
      async lookupKanji(character: string) {
        if (character === "学") {
          return { hanViet: "HỌC", on: ["がく"], kun: ["まな.ぶ"] };
        }
        return undefined;
      }
    });

    const student = enriched.vocabulary.find((entry) => entry.writtenForm === "学生");
    const school = enriched.vocabulary.find((entry) => entry.writtenForm === "学校");
    const study = enriched.kanji.find((entry) => entry.character === "学");

    assert.equal(student?.hiragana, "がくせい");
    assert.equal(student?.readingOrigin, "suggested");
    assert.equal(school?.hiragana, "がっこう");
    assert.equal(school?.readingOrigin, "source");
    assert.deepEqual(school?.meanings, ["trường học"]);
    assert.equal(study?.hanViet, "HỌC");
    assert.equal(study?.hanVietOrigin, "source");
    assert.equal(enriched.kanji.some((entry) => entry.character === "生"), false);
    assert.equal(enriched.kanji.some((entry) => entry.character === "校"), false);
    assert.equal(enriched.vocabulary.some((entry) => entry.writtenForm === "大学"), false);
  });

  it("treats compound rows as vocabulary and keeps only the lesson kanji card", () => {
    const draft = parseLessonDocument(
      [
        {
          page: 1,
          text: `1 頭
2 顔
3 首
4 走
5 声
6 重
7 太
8 計
9 不
10 痛
11 両
12 秒`
        },
        {
          page: 2,
          text: `頭 (ĐẦU)
トウ
あたま
～頭 とう
先頭 せんとう
頭痛 ずつう`
        }
      ],
      "bai.pptx"
    );

    assert.equal(draft.kanji.length, 12);
    assert.deepEqual(
      draft.kanji.map((entry) => entry.character),
      ["頭", "顔", "首", "走", "声", "重", "太", "計", "不", "痛", "両", "秒"]
    );
    assert.equal(draft.kanji.some((entry) => entry.character === "先"), false);
    assert.ok(draft.vocabulary.some((entry) => entry.writtenForm === "先頭"));
    assert.ok(draft.vocabulary.some((entry) => entry.writtenForm === "頭痛"));
    assert.ok(draft.vocabulary.some((entry) => entry.writtenForm === "～頭" || entry.writtenForm === "〜頭"));
  });

  it("detects a Japanese lesson heading", () => {
    const draft = parseLessonDocument([{ page: 2, text: "第11課\n時 (THỜI)" }], "a.pptx");
    assert.equal(draft.lessonNumber, 11);
    assert.equal(draft.title, "Bài 11");
  });
});
