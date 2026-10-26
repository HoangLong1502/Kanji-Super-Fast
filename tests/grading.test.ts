import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { gradeHanViet, gradeHiragana } from "../src/grading.js";

describe("Hán Việt grading", () => {
  it("accepts case, spaces, and Unicode differences while keeping diacritics", () => {
    const result = gradeHanViet("  thời  ", "THỜI");
    assert.equal(result.correct, true);
  });

  it("rejects a missing diacritic unless the setting allows it", () => {
    assert.equal(gradeHanViet("thoi", "THỜI").correct, false);
    assert.equal(gradeHanViet("thoi", "THỜI", { ignoreDiacritics: true }).correct, true);
  });

  it("rejects an empty answer", () => {
    assert.equal(gradeHanViet("   ", "THỜI").correct, false);
  });
});

describe("Hiragana grading", () => {
  it("accepts hiragana and katakana for the full word", () => {
    assert.equal(gradeHiragana("じかん", "じかん").correct, true);
    assert.equal(gradeHiragana("  ジカン ", "じかん").correct, true);
  });

  it("does not accept romaji or a partial reading", () => {
    assert.equal(gradeHiragana("jikan", "じかん").correct, false);
    assert.equal(gradeHiragana("べんきょう", "べんきょうする").correct, false);
  });

  it("keeps irregular readings and approved variants exact", () => {
    assert.equal(gradeHiragana("ときどき", "ときどき").correct, true);
    assert.equal(gradeHiragana("ときとき", "ときどき").correct, false);
    assert.equal(gradeHiragana("なんじ", "なんじ", ["なにじ"]).correct, true);
  });

  it("does not drop okurigana or する", () => {
    assert.equal(gradeHiragana("あかるい", "あかるい").correct, true);
    assert.equal(gradeHiragana("あか", "あかるい").correct, false);
    assert.equal(gradeHiragana("べんきょうする", "べんきょうする").correct, true);
  });
});
