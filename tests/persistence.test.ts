import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import AdmZip from "adm-zip";
import { hashPassword } from "../lib/session.js";

const databasePath = resolve("data/test-superkanji.db").replaceAll("\\", "/");
process.env.DATABASE_URL = `file:${databasePath}`;

describe("saved lessons and grading", () => {
  it("keeps lesson data per user, rejects a partial reading, and records a wrong answer", async () => {
    execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate", "--accept-data-loss"], {
      env: process.env,
      stdio: "inherit"
    });

    const { prisma } = await import("../lib/db.js");
    const service = await import("../lib/lessonService.js");
    const { LessonError } = await import("../lib/errors.js");
    const stamp = Date.now();
    const owner = await prisma.user.create({
      data: {
        email: `owner-${stamp}@superkanji.local`,
        name: "Chủ bài",
        passwordHash: hashPassword("password123")
      }
    });
    const other = await prisma.user.create({
      data: {
        email: `other-${stamp}@superkanji.local`,
        name: "Người khác",
        passwordHash: hashPassword("password123")
      }
    });
    const created = await service.createLessonFromFile(
      owner.id,
      { filename: "bai-11.pptx", bytes: lessonPptx() },
      { suggest: false }
    );

    assert.equal(created.duplicate, false);
    await service.confirmLesson(owner.id, created.lessonId);
    const lesson = await service.getLessonDetail(owner.id, created.lessonId);
    const study = lesson.vocabulary.find((item) => item.writtenForm === "勉強する");
    const time = lesson.kanji.find((item) => item.character === "時");
    assert.ok(study);
    assert.equal(study.hiragana, "べんきょうする");
    assert.ok(time);
    assert.equal(time.hanViet, "THỜI");
    assert.equal(lesson.vocabulary.some((item) => item.writtenForm === "時"), false);

    const reading = await service.createStudySession(owner.id, created.lessonId, { mode: "reading" });
    assert.equal(reading.questions.some((question) => "back" in question), false);
    const studyQuestion = reading.questions.find((question) => question.prompt === "勉強する");
    assert.ok(studyQuestion);
    const partial = await service.submitAnswer(owner.id, reading.id, { questionId: studyQuestion.id, answer: "べんきょう" });
    assert.equal(partial.correct, false);
    assert.equal(partial.expected, "べんきょうする");

    const hanviet = await service.createStudySession(owner.id, created.lessonId, { mode: "hanviet" });
    const timeQuestion = hanviet.questions.find((question) => question.prompt === "時");
    assert.ok(timeQuestion);
    const missingMark = await service.submitAnswer(owner.id, hanviet.id, { questionId: timeQuestion.id, answer: "thoi" });
    assert.equal(missingMark.correct, false);
    const withMark = await service.createStudySession(owner.id, created.lessonId, { mode: "hanviet" });
    const again = withMark.questions.find((question) => question.prompt === "時");
    assert.ok(again);
    const accepted = await service.submitAnswer(owner.id, withMark.id, { questionId: again.id, answer: "  thời " });
    assert.equal(accepted.correct, true);

    const queue = await service.getReviewQueue(owner.id);
    assert.equal(queue.some((item) => item.prompt === "勉強する" && item.lessonId === created.lessonId), true);

    await assert.rejects(() => service.getLessonDetail(other.id, created.lessonId), LessonError);
    await prisma.lesson.delete({ where: { id: created.lessonId } });
    await prisma.user.deleteMany({ where: { id: { in: [owner.id, other.id] } } });
  });
});

function lessonPptx(): Buffer {
  const zip = new AdmZip();
  zip.addFile(
    "ppt/slides/slide1.xml",
    Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:sp><p:txBody>
    <a:p><a:r><a:t>Bài 11</a:t></a:r></a:p>
    <a:p><a:r><a:t>時 (THỜI)</a:t></a:r></a:p>
    <a:p><a:r><a:t>音: ジ</a:t></a:r></a:p>
    <a:p><a:r><a:t>勉強する (べんきょうする): học tập</a:t></a:r></a:p>
  </p:txBody></p:sp></p:spTree></p:cSld>
</p:sld>`)
  );
  return zip.toBuffer();
}
