import assert from "node:assert/strict";
import AdmZip from "adm-zip";
import { describe, it } from "node:test";
import { detectUploadKind } from "../src/fileKind.js";
import { parseLessonDocument } from "../src/lessonDraft.js";
import { extractPptxText } from "../src/pptxExtractor.js";

describe("uploaded file kinds", () => {
  it("rejects legacy OLE PowerPoint and accepts pptx and pdf by signature", () => {
    assert.equal(detectUploadKind(Buffer.from("d0cf11e0a1b11ae1", "hex")), "ppt");
    assert.equal(detectUploadKind(Buffer.from("%PDF-1.7")), "pdf");
    assert.equal(detectUploadKind(Buffer.from([0x50, 0x4b, 0x03, 0x04])), "pptx");
  });
});

describe("pptx lesson extraction", () => {
  it("reads slide text in order and keeps compound readings from the slide", async () => {
    const zip = new AdmZip();
    zip.addFile("ppt/slides/slide2.xml", Buffer.from(slideXml(["Bài 11", "時間 (じかん): thời gian", "勉強する (べんきょうする): học"])));
    zip.addFile("ppt/slides/slide1.xml", Buffer.from(slideXml(["第11課", "時 (THỜI)", "音: ジ", "訓: とき"])));

    const slides = await extractPptxText(zip.toBuffer());
    const draft = parseLessonDocument(
      slides.map((slide) => ({ page: slide.slideNumber, text: slide.rawText })),
      "bai.pptx"
    );
    const time = draft.kanji.find((entry) => entry.character === "時");
    const study = draft.vocabulary.find((entry) => entry.writtenForm === "勉強する");

    assert.deepEqual(slides.map((slide) => slide.slideNumber), [1, 2]);
    assert.equal(draft.lessonNumber, 11);
    assert.equal(time?.hanViet, "THỜI");
    assert.deepEqual(time?.onReadings, ["じ"]);
    assert.equal(study?.hiragana, "べんきょうする");
    assert.equal(draft.vocabulary.some((entry) => entry.writtenForm === "時"), false);
  });
});

function slideXml(lines: string[]): string {
  const paragraphs = lines
    .map((line) => `<a:p><a:r><a:t>${line.replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</a:t></a:r></a:p>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:sp><p:txBody>${paragraphs}</p:txBody></p:sp></p:spTree></p:cSld>
</p:sld>`;
}
