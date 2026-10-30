import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { Kanji, Lesson, Prisma, ReviewProgress, Vocabulary } from "@prisma/client";
import { classifyVocabulary, eligibleHanVietQuestion, eligibleReadingQuestion, sortUnreviewedFirst } from "../src/eligibility.js";
import { detectUploadKind, extensionForKind, isImageKind } from "../src/fileKind.js";
import { gradeHanViet, gradeHiragana } from "../src/grading.js";
import { extractImageText, imageOcrLooksEmpty } from "../src/imageExtractor.js";
import { isKanji } from "../src/japanese.js";
import { applyDictionarySuggestions, parseLessonDocument, type LessonDraft } from "../src/lessonDraft.js";
import { createMaziiLookup } from "../src/maziiSuggest.js";
import { extractPdfText, pdfNeedsOcr } from "../src/pdfExtractor.js";
import { extractPptxText } from "../src/pptxExtractor.js";
import { prisma } from "./db.js";
import { LessonError } from "./errors.js";
import { asBlocks, asNumberArray, asStringArray } from "./json.js";
import { displayFilename, tryDeleteUpload, trySaveUpload, uploadExists, storedUploadPath } from "./paths.js";

interface ReviewQueueItem {
  id: string;
  lessonId: string;
  lessonTitle: string;
  itemType: "kanji" | "vocabulary";
  prompt: string;
  detail: string;
  incorrectCount: number;
}

const MAX_BYTES = 500 * 1024 * 1024;

export { requireUser as getCurrentUser } from "./authService.js";
export { requirePageUser } from "./authService.js";

export async function getDashboard(userId: string, query: { q?: string; jlpt?: string }) {
  const [lessons, progress, review] = await Promise.all([
    prisma.lesson.findMany({
      where: { userId },
      include: {
        _count: { select: { kanji: true, vocabulary: true } },
        progress: { where: { userId } }
      },
      orderBy: { updatedAt: "desc" }
    }),
    prisma.reviewProgress.findMany({ where: { userId } }),
    prisma.reviewProgress.count({ where: { userId, lastCorrect: false } })
  ]);

  const needle = query.q?.trim().toLocaleLowerCase("vi") ?? "";
  const filtered = lessons.filter((lesson) => {
    const matchesQuery =
      !needle ||
      lesson.title.toLocaleLowerCase("vi").includes(needle) ||
      lesson.originalFilename.toLocaleLowerCase("vi").includes(needle);
    const matchesLevel = !query.jlpt || lesson.jlptLevel === query.jlpt;
    return matchesQuery && matchesLevel;
  });

  const learnedKanji = new Set(
    progress.filter((item) => item.itemType === "kanji" && isKnown(item)).map((item) => item.itemId)
  );
  const learnedVocab = new Set(
    progress.filter((item) => item.itemType === "vocabulary" && isKnown(item)).map((item) => item.itemId)
  );

  return {
    lessons: filtered.map((lesson) => toLessonCard(lesson)),
    recent: [...lessons]
      .filter((lesson) => lesson.lastStudiedAt)
      .sort((left, right) => (right.lastStudiedAt?.getTime() ?? 0) - (left.lastStudiedAt?.getTime() ?? 0))
      .slice(0, 3)
      .map((lesson) => toLessonCard(lesson)),
    stats: {
      lessons: lessons.length,
      kanjiLearned: learnedKanji.size,
      vocabularyLearned: learnedVocab.size,
      review
    }
  };
}

export async function createLessonFromFile(
  userId: string,
  file: { filename: string; bytes: Buffer },
  options: { suggest?: boolean } = {}
) {
  if (file.bytes.length > MAX_BYTES) {
    throw new LessonError("File lớn hơn 500MB.");
  }

  const kind = detectUploadKind(file.bytes);
  if (kind === "ppt") {
    throw new LessonError("File .ppt cũ không được mở, để tránh macro. Hãy lưu lại thành .pptx rồi tải lên.");
  }

  const extension = extensionForKind(kind);
  if (!extension) {
    throw new LessonError("Chỉ nhận .pptx, PDF có lớp chữ, hoặc ảnh JPG/PNG/WebP/GIF.");
  }

  if (isImageKind(kind) && file.bytes.length > 25 * 1024 * 1024) {
    throw new LessonError("Ảnh OCR nên dưới 25MB để nhận dạng ổn định. Hãy nén hoặc cắt ảnh rồi tải lại.");
  }

  const contentHash = createHash("sha256").update(file.bytes).digest("hex");
  const existing = await prisma.lesson.findFirst({
    where: { userId, contentHash, extractionStatus: { not: "failed" } }
  });

  if (existing) {
    return { lessonId: existing.id, duplicate: true };
  }

  const originalFilename = displayFilename(file.filename);
  const lesson = await prisma.lesson.create({
    data: {
      userId,
      title: originalFilename.replace(/\.[^.]+$/u, "") || "Bài học",
      originalFilename,
      contentHash,
      sourceFileName: "pending",
      extractionStatus: "processing",
      warnings: [],
      rawBlocks: []
    }
  });

  const preferredName = `${lesson.id}.${extension}`;

  try {
    const saved = await trySaveUpload(preferredName, file.bytes);
    const sourceFileName = saved ? preferredName : "db-only";
    const extracted = await readDocument(file.bytes, kind);
    let draft = parseLessonDocument(extracted.blocks, originalFilename);

    if (isImageKind(kind)) {
      draft = {
        ...draft,
        warnings: [
          "Chữ lấy từ OCR ảnh (tiếng Nhật). Hãy kiểm tra lại kanji và từ vựng vì OCR có thể lệch.",
          ...draft.warnings
        ]
      };
    }

    if (extracted.needsOcr && kind === "pdf") {
      draft = {
        ...draft,
        warnings: [
          "PDF gần như không có chữ để đọc. Hãy dùng PDF có lớp text, tải ảnh chụp để OCR, hoặc nhập tay ở mục chưa phân loại.",
          ...draft.warnings
        ]
      };
    }

    if (extracted.needsOcr && isImageKind(kind)) {
      draft = {
        ...draft,
        warnings: [
          "OCR gần như không đọc được chữ Nhật trong ảnh. Hãy chụp rõ hơn, cắt sát phần chữ, hoặc nhập tay.",
          ...draft.warnings
        ]
      };
    }

    if (options.suggest !== false) {
      draft = await applyDictionarySuggestions(draft, createMaziiLookup());
    }

    await prisma.$transaction(async (tx) => {
      await tx.lesson.update({
        where: { id: lesson.id },
        data: {
          title: draft.title,
          lessonNumber: draft.lessonNumber,
          jlptLevel: draft.jlptLevel,
          sourceFileName,
          extractionStatus: "review",
          extractionError: null,
          warnings: draft.warnings,
          rawBlocks: extracted.blocks,
          needsOcr: extracted.needsOcr
        }
      });
      await persistDraft(tx, lesson.id, draft);
    });

    return { lessonId: lesson.id, duplicate: false };
  } catch (error) {
    const message = error instanceof LessonError ? error.message : error instanceof Error ? error.message : "Không đọc được file.";
    await prisma.lesson.update({
      where: { id: lesson.id },
      data: {
        sourceFileName: "db-only",
        extractionStatus: "failed",
        extractionError: message
      }
    });
    throw new LessonError(`Không trích xuất được file: ${message}`);
  }
}

export async function retryLesson(userId: string, lessonId: string) {
  const lesson = await requireLesson(userId, lessonId);
  const blocksFromDb = asBlocks(lesson.rawBlocks);

  let extracted: { blocks: Array<{ page: number; text: string }>; needsOcr: boolean };

  if (lesson.sourceFileName && lesson.sourceFileName !== "pending" && lesson.sourceFileName !== "db-only") {
    const hasFile = await uploadExists(lesson.sourceFileName);
    if (hasFile) {
      const bytes = await readFile(storedUploadPath(lesson.sourceFileName));
      const kind = detectUploadKind(bytes);
      if (!extensionForKind(kind)) {
        throw new LessonError("File gốc không còn là PPTX, PDF hoặc ảnh hợp lệ.");
      }
      extracted = await readDocument(bytes, kind);
    } else if (blocksFromDb.length > 0) {
      extracted = { blocks: blocksFromDb, needsOcr: lesson.needsOcr };
    } else {
      throw new LessonError("Không còn file gốc cũng không còn chữ đã trích. Hãy tải lại file.");
    }
  } else if (blocksFromDb.length > 0) {
    extracted = { blocks: blocksFromDb, needsOcr: lesson.needsOcr };
  } else {
    throw new LessonError("Không còn dữ liệu để thử lại. Hãy tải lại file.");
  }

  let draft = parseLessonDocument(extracted.blocks, lesson.originalFilename);
  draft = await applyDictionarySuggestions(draft, createMaziiLookup());

  await prisma.$transaction(async (tx) => {
    await tx.vocabulary.deleteMany({ where: { lessonId } });
    await tx.kanji.deleteMany({ where: { lessonId } });
    await tx.uncertainText.deleteMany({ where: { lessonId } });
    await persistDraft(tx, lessonId, draft);
    await tx.lesson.update({
      where: { id: lessonId },
      data: {
        title: draft.title,
        lessonNumber: draft.lessonNumber,
        jlptLevel: draft.jlptLevel,
        extractionStatus: "review",
        extractionError: null,
        warnings: draft.warnings,
        rawBlocks: extracted.blocks,
        needsOcr: extracted.needsOcr
      }
    });
  });
}

export async function getLessonDetail(userId: string, lessonId: string) {
  const lesson = await requireLesson(userId, lessonId);
  const progress = await prisma.reviewProgress.findMany({ where: { userId, lessonId } });
  const itemIds = [...lesson.kanji.map((item) => item.id), ...lesson.vocabulary.map((item) => item.id)];

  return {
    ...serializeLesson(lesson),
    progressPercent: progressPercent(itemIds, progress),
    incorrectCount: progress.filter((item) => item.lastCorrect === false).length
  };
}

export async function updateLessonContent(userId: string, lessonId: string, input: unknown) {
  const lesson = await requireLesson(userId, lessonId);
  const content = parseContentUpdate(input);
  const existingKanji = new Map(lesson.kanji.map((item) => [item.id, item]));
  const existingVocab = new Map(lesson.vocabulary.map((item) => [item.id, item]));

  await prisma.$transaction(async (tx) => {
    await tx.lesson.update({
      where: { id: lessonId },
      data: {
        title: content.title,
        jlptLevel: content.jlptLevel,
        lessonNumber: content.lessonNumber
      }
    });

    const keptKanji = new Set<string>();
    const idByCharacter = new Map<string, string>();

    for (const [index, row] of content.kanji.entries()) {
      const previous = row.id ? existingKanji.get(row.id) : undefined;
      const data = {
        character: row.character,
        hanViet: row.hanViet,
        hanVietOrigin: nextOrigin(previous?.hanVietOrigin, previous?.hanViet ?? "", row.hanViet, row.verified),
        meanings: row.meanings,
        meaningOrigin: nextOrigin(previous?.meaningOrigin, asStringArray(previous?.meanings).join("\n"), row.meanings.join("\n"), row.verified),
        onReadings: row.onReadings,
        onOrigin: nextOrigin(previous?.onOrigin, asStringArray(previous?.onReadings).join("、"), row.onReadings.join("、"), row.verified),
        kunReadings: row.kunReadings,
        kunOrigin: nextOrigin(previous?.kunOrigin, asStringArray(previous?.kunReadings).join("、"), row.kunReadings.join("、"), row.verified),
        notes: row.notes,
        verificationStatus: row.verified ? "verified" : previous?.verificationStatus ?? "unverified",
        sourcePages: previous ? asNumberArray(previous.sourcePages) : [],
        sourceExcerpt: previous?.sourceExcerpt ?? "",
        sortOrder: index
      };

      if (previous) {
        await tx.kanji.update({ where: { id: previous.id }, data });
        keptKanji.add(previous.id);
        idByCharacter.set(row.character, previous.id);
      } else {
        const created = await tx.kanji.create({ data: { lessonId, ...data } });
        keptKanji.add(created.id);
        idByCharacter.set(row.character, created.id);
      }
    }

    const removedKanji = lesson.kanji.filter((item) => !keptKanji.has(item.id)).map((item) => item.id);
    if (removedKanji.length > 0) {
      await tx.kanji.deleteMany({ where: { lessonId, id: { in: removedKanji } } });
      await tx.reviewProgress.deleteMany({ where: { userId, itemType: "kanji", itemId: { in: removedKanji } } });
    }

    const keptVocab = new Set<string>();
    const vocabIds: Array<{ id: string; characters: string[] }> = [];

    for (const [index, row] of content.vocabulary.entries()) {
      const previous = row.id ? existingVocab.get(row.id) : undefined;
      const data = {
        writtenForm: row.writtenForm,
        hiragana: row.hiragana,
        katakana: previous?.katakana ?? "",
        readingOrigin: nextOrigin(previous?.readingOrigin, previous?.hiragana ?? "", row.hiragana, row.verified),
        meanings: row.meanings,
        meaningOrigin: nextOrigin(previous?.meaningOrigin, asStringArray(previous?.meanings).join("\n"), row.meanings.join("\n"), row.verified),
        vocabularyType: row.vocabularyType,
        readingVariants: row.readingVariants,
        notes: row.notes,
        verificationStatus: row.verified ? "verified" : previous?.verificationStatus ?? "unverified",
        sourcePages: previous ? asNumberArray(previous.sourcePages) : [],
        sourceExcerpt: previous?.sourceExcerpt ?? "",
        sortOrder: index
      };

      const id = previous
        ? (await tx.vocabulary.update({ where: { id: previous.id }, data })).id
        : (await tx.vocabulary.create({ data: { lessonId, ...data } })).id;
      keptVocab.add(id);
      vocabIds.push({ id, characters: row.kanjiCharacters });
    }

    const removedVocab = lesson.vocabulary.filter((item) => !keptVocab.has(item.id)).map((item) => item.id);
    if (removedVocab.length > 0) {
      await tx.vocabulary.deleteMany({ where: { lessonId, id: { in: removedVocab } } });
      await tx.reviewProgress.deleteMany({ where: { userId, itemType: "vocabulary", itemId: { in: removedVocab } } });
    }

    await tx.vocabularyKanji.deleteMany({ where: { vocabulary: { lessonId } } });

    for (const vocab of vocabIds) {
      for (const [position, character] of vocab.characters.entries()) {
        let kanjiId = idByCharacter.get(character);
        if (!kanjiId) {
          const created = await tx.kanji.create({
            data: {
              lessonId,
              character,
              meanings: [],
              onReadings: [],
              kunReadings: [],
              sourcePages: [],
              sortOrder: 1000 + position
            }
          });
          kanjiId = created.id;
          idByCharacter.set(character, kanjiId);
        }

        await tx.vocabularyKanji.create({
          data: { vocabularyId: vocab.id, kanjiId, characterPosition: position }
        });
      }
    }

    if (content.resolvedUncertainIds.length > 0) {
      await tx.uncertainText.updateMany({
        where: { lessonId, id: { in: content.resolvedUncertainIds } },
        data: { resolved: true }
      });
    }
  });
}

export async function confirmLesson(userId: string, lessonId: string) {
  const lesson = await requireLesson(userId, lessonId);
  if (lesson.kanji.length + lesson.vocabulary.length === 0) {
    throw new LessonError("Hãy thêm ít nhất một kanji hoặc một từ trước khi tạo bài.");
  }

  await prisma.lesson.update({
    where: { id: lessonId },
    data: { extractionStatus: "ready" }
  });
}

export async function renameLesson(userId: string, lessonId: string, title: string) {
  await requireLesson(userId, lessonId);
  const trimmed = title.trim();
  if (!trimmed || trimmed.length > 80) {
    throw new LessonError("Tên bài cần từ 1 đến 80 ký tự.");
  }

  await prisma.lesson.update({ where: { id: lessonId }, data: { title: trimmed } });
}

export async function deleteLesson(userId: string, lessonId: string) {
  const lesson = await requireLesson(userId, lessonId);
  await prisma.lesson.delete({ where: { id: lesson.id } });

  if (lesson.sourceFileName && lesson.sourceFileName !== "pending" && lesson.sourceFileName !== "db-only") {
    await tryDeleteUpload(lesson.sourceFileName);
  }
}

export async function suggestMissing(userId: string, lessonId: string) {
  const lesson = await requireLesson(userId, lessonId);
  const lookup = createMaziiLookup();
  let filled = 0;

  for (const vocab of lesson.vocabulary) {
    if (vocab.hiragana || vocab.readingOrigin === "source" || vocab.readingOrigin === "verified") {
      continue;
    }

    const suggestion = await lookup.lookupWord(vocab.writtenForm);
    if (!suggestion?.reading && !suggestion?.meaning) {
      continue;
    }

    await prisma.vocabulary.update({
      where: { id: vocab.id },
      data: {
        hiragana: suggestion.reading ?? vocab.hiragana,
        readingOrigin: suggestion.reading ? "suggested" : vocab.readingOrigin,
        meanings: asStringArray(vocab.meanings).length === 0 && suggestion.meaning ? [suggestion.meaning] : asStringArray(vocab.meanings),
        meaningOrigin: asStringArray(vocab.meanings).length === 0 && suggestion.meaning ? "suggested" : vocab.meaningOrigin,
        verificationStatus: "suggested"
      }
    });
    filled += 1;
  }

  for (const kanji of lesson.kanji) {
    const needsHan = !kanji.hanViet;
    const needsReading = asStringArray(kanji.onReadings).length === 0 && asStringArray(kanji.kunReadings).length === 0;
    if (!needsHan && !needsReading) {
      continue;
    }

    const suggestion = await lookup.lookupKanji(kanji.character);
    if (!suggestion) {
      continue;
    }

    await prisma.kanji.update({
      where: { id: kanji.id },
      data: {
        hanViet: needsHan && suggestion.hanViet ? suggestion.hanViet : kanji.hanViet,
        hanVietOrigin: needsHan && suggestion.hanViet ? "suggested" : kanji.hanVietOrigin,
        onReadings: needsReading && suggestion.on?.length ? suggestion.on : asStringArray(kanji.onReadings),
        onOrigin: needsReading && suggestion.on?.length ? "suggested" : kanji.onOrigin,
        kunReadings: needsReading && suggestion.kun?.length ? suggestion.kun : asStringArray(kanji.kunReadings),
        kunOrigin: needsReading && suggestion.kun?.length ? "suggested" : kanji.kunOrigin,
        verificationStatus: "suggested"
      }
    });
    filled += 1;
  }

  return { filled };
}

export async function exportLesson(userId: string, lessonId: string) {
  const lesson = await getLessonDetail(userId, lessonId);
  return {
    title: lesson.title,
    jlptLevel: lesson.jlptLevel,
    originalFilename: lesson.originalFilename,
    kanji: lesson.kanji,
    vocabulary: lesson.vocabulary
  };
}

export async function resetProgress(userId: string, lessonId: string) {
  await requireLesson(userId, lessonId);
  await prisma.reviewProgress.deleteMany({ where: { userId, lessonId } });
  await prisma.lesson.update({ where: { id: lessonId }, data: { lastStudiedAt: null } });
}

export async function createStudySession(
  userId: string,
  lessonId: string,
  input: { mode?: string; include?: string; retryIncorrect?: boolean }
) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const lesson = await requireLesson(userId, lessonId);
  if (lesson.extractionStatus !== "ready") {
    throw new LessonError("Hãy xác nhận bài học trước khi luyện.");
  }

  const mode = input.mode;
  if (mode !== "flashcards" && mode !== "hanviet" && mode !== "reading") {
    throw new LessonError("Chế độ học không hợp lệ.");
  }

  const incorrect = new Set(
    (await prisma.reviewProgress.findMany({ where: { userId, lessonId, lastCorrect: false } })).map((item) => item.itemId)
  );
  const include = input.include === "kanji" || input.include === "vocabulary" ? input.include : "both";
  let questions = buildQuestions(lesson, mode, include, user.revealMeaning);

  if (input.retryIncorrect) {
    questions = questions.filter((question) => incorrect.has(question.id));
  }

  questions = sortUnreviewedFirst(questions, incorrect);
  const session = await prisma.studySession.create({
    data: {
      userId,
      lessonId,
      mode,
      totalQuestions: questions.length,
      questionIds: questions.map((question) => question.id)
    }
  });

  return {
    id: session.id,
    mode,
    revealMeaning: user.revealMeaning,
    questions: questions.map((question) => {
      if (mode === "flashcards") {
        return question;
      }

      return {
        id: question.id,
        itemType: question.itemType,
        prompt: question.prompt
      };
    })
  };
}

export async function submitAnswer(userId: string, sessionId: string, input: { questionId?: string; answer?: string }) {
  const session = await prisma.studySession.findFirst({
    where: { id: sessionId, userId },
    include: { lesson: { include: lessonInclude.include } }
  });

  if (!session) {
    throw new LessonError("Không tìm thấy phiên học.", 404);
  }

  const questionId = input.questionId ?? "";
  const questionIds = asStringArray(session.questionIds);
  if (!questionIds.includes(questionId)) {
    throw new LessonError("Câu hỏi không thuộc phiên học này.");
  }

  const existing = await prisma.studyAnswer.findFirst({
    where: { sessionId, questionReference: questionId }
  });
  if (existing) {
    return {
      correct: existing.isCorrect,
      expected: existing.expectedAnswer,
      alreadyAnswered: true,
      meanings: [] as string[]
    };
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const graded = gradeQuestion(session.lesson, session.mode, questionId, input.answer ?? "", user.ignoreDiacritics);

  await prisma.$transaction([
    prisma.studyAnswer.create({
      data: {
        sessionId,
        questionType: graded.itemType,
        questionReference: questionId,
        userAnswer: (input.answer ?? "").slice(0, 200),
        expectedAnswer: graded.expected,
        isCorrect: graded.correct
      }
    }),
    prisma.reviewProgress.upsert({
      where: { userId_itemType_itemId: { userId, itemType: graded.itemType, itemId: questionId } },
      create: {
        userId,
        lessonId: session.lessonId,
        itemType: graded.itemType,
        itemId: questionId,
        correctCount: graded.correct ? 1 : 0,
        incorrectCount: graded.correct ? 0 : 1,
        lastCorrect: graded.correct,
        lastReviewedAt: new Date(),
        nextReviewAt: graded.correct ? null : new Date()
      },
      update: {
        correctCount: { increment: graded.correct ? 1 : 0 },
        incorrectCount: { increment: graded.correct ? 0 : 1 },
        lastCorrect: graded.correct,
        lastReviewedAt: new Date(),
        nextReviewAt: graded.correct ? null : new Date()
      }
    }),
    prisma.lesson.update({
      where: { id: session.lessonId },
      data: { lastStudiedAt: new Date() }
    })
  ]);

  return {
    correct: graded.correct,
    expected: graded.expected,
    alreadyAnswered: false,
    meanings: user.revealMeaning ? graded.meanings : []
  };
}

export async function completeSession(userId: string, sessionId: string) {
  const session = await prisma.studySession.findFirst({ where: { id: sessionId, userId } });
  if (!session) {
    throw new LessonError("Không tìm thấy phiên học.", 404);
  }

  const answers = await prisma.studyAnswer.findMany({ where: { sessionId } });
  const correctIds = new Set(answers.filter((answer) => answer.isCorrect).map((answer) => answer.questionReference));
  const score = correctIds.size;

  await prisma.studySession.update({
    where: { id: sessionId },
    data: { completedAt: new Date(), score }
  });

  const wrong = answers
    .filter((answer) => !answer.isCorrect)
    .map((answer) => ({
      questionId: answer.questionReference,
      userAnswer: answer.userAnswer,
      expected: answer.expectedAnswer
    }));

  return { score, total: session.totalQuestions, wrong };
}

export async function getReviewQueue(userId: string): Promise<ReviewQueueItem[]> {
  const rows = await prisma.reviewProgress.findMany({
    where: { userId, lastCorrect: false },
    include: { lesson: { select: { id: true, title: true } } },
    orderBy: { lastReviewedAt: "desc" }
  });

  const kanjiIds = rows.filter((row) => row.itemType === "kanji").map((row) => row.itemId);
  const vocabIds = rows.filter((row) => row.itemType === "vocabulary").map((row) => row.itemId);
  const [kanji, vocabulary] = await Promise.all([
    prisma.kanji.findMany({ where: { id: { in: kanjiIds } } }),
    prisma.vocabulary.findMany({ where: { id: { in: vocabIds } } })
  ]);
  const kanjiById = new Map(kanji.map((item) => [item.id, item]));
  const vocabById = new Map(vocabulary.map((item) => [item.id, item]));

  return rows.flatMap((row): ReviewQueueItem[] => {
    if (row.itemType === "kanji") {
      const item = kanjiById.get(row.itemId);
      if (!item) {
        return [];
      }
      return [{
        id: row.id,
        lessonId: row.lessonId,
        lessonTitle: row.lesson.title,
        itemType: "kanji" as const,
        prompt: item.character,
        detail: item.hanViet,
        incorrectCount: row.incorrectCount
      }];
    }

    const item = vocabById.get(row.itemId);
    if (!item) {
      return [];
    }

    return [{
      id: row.id,
      lessonId: row.lessonId,
      lessonTitle: row.lesson.title,
      itemType: "vocabulary" as const,
      prompt: item.writtenForm,
      detail: item.hiragana,
      incorrectCount: row.incorrectCount
    }];
  });
}

export async function updateSettings(userId: string, input: { ignoreDiacritics?: boolean; revealMeaning?: boolean }) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      ignoreDiacritics: Boolean(input.ignoreDiacritics),
      revealMeaning: input.revealMeaning !== false
    }
  });
}

const lessonInclude = {
  include: {
    kanji: { orderBy: { sortOrder: "asc" as const } },
    vocabulary: {
      orderBy: { sortOrder: "asc" as const },
      include: { kanjiLinks: { include: { kanji: true }, orderBy: { characterPosition: "asc" as const } } }
    },
    uncertain: { where: { resolved: false }, orderBy: { sourcePage: "asc" as const } }
  }
} satisfies { include: object };

async function requireLesson(userId: string, lessonId: string) {
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, userId },
    ...lessonInclude
  });

  if (!lesson) {
    throw new LessonError("Không tìm thấy bài học.", 404);
  }

  return lesson;
}

async function readDocument(bytes: Buffer, kind: ReturnType<typeof detectUploadKind>) {
  if (kind === "pdf") {
    const pages = await extractPdfText(bytes);
    return {
      blocks: pages.map((page) => ({ page: page.page, text: page.text })),
      needsOcr: pdfNeedsOcr(pages)
    };
  }

  if (isImageKind(kind)) {
    const pages = await extractImageText(bytes);
    return {
      blocks: pages.map((page) => ({ page: page.page, text: page.text })),
      needsOcr: imageOcrLooksEmpty(pages)
    };
  }

  if (kind !== "pptx") {
    throw new LessonError("Định dạng file không được hỗ trợ.");
  }

  const slides = await extractPptxText(bytes);
  return {
    blocks: slides.map((slide) => ({ page: slide.slideNumber, text: slide.rawText })),
    needsOcr: false
  };
}

async function persistDraft(tx: Prisma.TransactionClient, lessonId: string, draft: LessonDraft) {
  const idByCharacter = new Map<string, string>();

  for (const kanji of draft.kanji) {
    const created = await tx.kanji.create({
      data: {
        lessonId,
        character: kanji.character,
        hanViet: kanji.hanViet,
        hanVietOrigin: kanji.hanVietOrigin,
        meanings: kanji.meanings,
        meaningOrigin: kanji.meaningOrigin,
        onReadings: kanji.onReadings,
        onOrigin: kanji.onOrigin,
        kunReadings: kanji.kunReadings,
        kunOrigin: kanji.kunOrigin,
        notes: kanji.notes,
        verificationStatus: kanji.verificationStatus,
        sourcePages: kanji.sourcePages,
        sourceExcerpt: kanji.sourceExcerpt,
        sortOrder: kanji.sortOrder
      }
    });
    idByCharacter.set(kanji.character, created.id);
  }

  for (const vocab of draft.vocabulary) {
    const created = await tx.vocabulary.create({
      data: {
        lessonId,
        writtenForm: vocab.writtenForm,
        hiragana: vocab.hiragana,
        katakana: vocab.katakana,
        readingOrigin: vocab.readingOrigin,
        meanings: vocab.meanings,
        meaningOrigin: vocab.meaningOrigin,
        vocabularyType: vocab.vocabularyType,
        readingVariants: vocab.readingVariants,
        notes: vocab.notes,
        verificationStatus: vocab.verificationStatus,
        sourcePages: vocab.sourcePages,
        sourceExcerpt: vocab.sourceExcerpt,
        sortOrder: vocab.sortOrder
      }
    });

    for (const [position, character] of vocab.kanjiCharacters.entries()) {
      const kanjiId = idByCharacter.get(character);
      if (!kanjiId) {
        continue;
      }

      await tx.vocabularyKanji.create({
        data: { vocabularyId: created.id, kanjiId, characterPosition: position }
      });
    }
  }

  for (const item of draft.uncertain) {
    await tx.uncertainText.create({
      data: { lessonId, text: item.text, sourcePage: item.sourcePage }
    });
  }
}

function serializeLesson(lesson: Lesson & { kanji: Kanji[]; vocabulary: Array<Vocabulary & { kanjiLinks: Array<{ characterPosition: number; kanji: Kanji }> }>; uncertain: Array<{ id: string; text: string; sourcePage: number | null }> }) {
  return {
    id: lesson.id,
    title: lesson.title,
    lessonNumber: lesson.lessonNumber,
    jlptLevel: lesson.jlptLevel,
    originalFilename: lesson.originalFilename,
    extractionStatus: lesson.extractionStatus,
    extractionError: lesson.extractionError,
    warnings: asStringArray(lesson.warnings),
    needsOcr: lesson.needsOcr,
    rawBlocks: lesson.rawBlocks,
    createdAt: lesson.createdAt.toISOString(),
    updatedAt: lesson.updatedAt.toISOString(),
    lastStudiedAt: lesson.lastStudiedAt?.toISOString() ?? null,
    kanji: lesson.kanji.map((item) => ({
      id: item.id,
      character: item.character,
      hanViet: item.hanViet,
      hanVietOrigin: item.hanVietOrigin,
      meanings: asStringArray(item.meanings),
      meaningOrigin: item.meaningOrigin,
      onReadings: asStringArray(item.onReadings),
      onOrigin: item.onOrigin,
      kunReadings: asStringArray(item.kunReadings),
      kunOrigin: item.kunOrigin,
      notes: item.notes,
      verificationStatus: item.verificationStatus,
      sourcePages: asNumberArray(item.sourcePages),
      sourceExcerpt: item.sourceExcerpt
    })),
    vocabulary: lesson.vocabulary.map((item) => ({
      id: item.id,
      writtenForm: item.writtenForm,
      hiragana: item.hiragana,
      katakana: item.katakana,
      readingOrigin: item.readingOrigin,
      meanings: asStringArray(item.meanings),
      meaningOrigin: item.meaningOrigin,
      vocabularyType: item.vocabularyType,
      readingVariants: asStringArray(item.readingVariants),
      notes: item.notes,
      verificationStatus: item.verificationStatus,
      sourcePages: asNumberArray(item.sourcePages),
      sourceExcerpt: item.sourceExcerpt,
      kanjiCharacters: item.kanjiLinks.map((link) => link.kanji.character)
    })),
    uncertain: lesson.uncertain
  };
}

function toLessonCard(lesson: Lesson & { _count: { kanji: number; vocabulary: number }; progress: ReviewProgress[] }) {
  const total = lesson._count.kanji + lesson._count.vocabulary;
  return {
    id: lesson.id,
    title: lesson.title,
    originalFilename: lesson.originalFilename,
    jlptLevel: lesson.jlptLevel,
    extractionStatus: lesson.extractionStatus,
    kanjiCount: lesson._count.kanji,
    vocabularyCount: lesson._count.vocabulary,
    progressPercent: total === 0 ? 0 : Math.min(100, Math.round((lesson.progress.filter((item) => isKnown(item)).length / total) * 100)),
    lastStudiedAt: lesson.lastStudiedAt?.toISOString() ?? null
  };
}

function progressPercent(itemIds: string[], rows: Array<{ itemId: string; lastCorrect: boolean | null; correctCount: number; incorrectCount: number }>): number {
  const unique = [...new Set(itemIds)];
  if (unique.length === 0) {
    return 0;
  }

  const known = new Set(rows.filter((row) => isKnown(row)).map((row) => row.itemId));
  return Math.round((unique.filter((id) => known.has(id)).length / unique.length) * 100);
}

function isKnown(row: { lastCorrect: boolean | null; correctCount: number; incorrectCount: number }): boolean {
  return row.lastCorrect === true && row.correctCount > row.incorrectCount;
}

interface ContentUpdate {
  title: string;
  jlptLevel: string | null;
  lessonNumber: number | null;
  kanji: Array<{
    id?: string;
    character: string;
    hanViet: string;
    meanings: string[];
    onReadings: string[];
    kunReadings: string[];
    notes: string;
    verified: boolean;
  }>;
  vocabulary: Array<{
    id?: string;
    writtenForm: string;
    hiragana: string;
    meanings: string[];
    vocabularyType: string;
    readingVariants: string[];
    kanjiCharacters: string[];
    notes: string;
    verified: boolean;
  }>;
  resolvedUncertainIds: string[];
}

function parseContentUpdate(input: unknown): ContentUpdate {
  if (!input || typeof input !== "object") {
    throw new LessonError("Dữ liệu bài học không hợp lệ.");
  }

  const body = input as Record<string, unknown>;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title || title.length > 80) {
    throw new LessonError("Tên bài cần từ 1 đến 80 ký tự.");
  }

  const jlptLevel = typeof body.jlptLevel === "string" && body.jlptLevel ? body.jlptLevel : null;
  if (jlptLevel && !/^N[1-5]$/u.test(jlptLevel)) {
    throw new LessonError("JLPT chỉ nhận N5 đến N1.");
  }

  const lessonNumber = typeof body.lessonNumber === "number" && Number.isInteger(body.lessonNumber) ? body.lessonNumber : null;
  if (!Array.isArray(body.kanji) || !Array.isArray(body.vocabulary)) {
    throw new LessonError("Thiếu danh sách kanji hoặc từ vựng.");
  }

  const seenKanji = new Set<string>();
  const kanji = body.kanji.map((item) => {
    const row = asRecord(item);
    const character = typeof row.character === "string" ? [...row.character.trim()] : [];
    if (character.length !== 1 || !isKanji(character[0])) {
      throw new LessonError("Mỗi dòng kanji phải là đúng một chữ kanji.");
    }
    if (seenKanji.has(character[0])) {
      throw new LessonError(`Kanji ${character[0]} bị lặp.`);
    }
    seenKanji.add(character[0]);
    return {
      id: typeof row.id === "string" ? row.id : undefined,
      character: character[0],
      hanViet: cleanText(row.hanViet),
      meanings: splitList(row.meanings),
      onReadings: splitList(row.onReadings),
      kunReadings: splitList(row.kunReadings),
      notes: cleanText(row.notes).slice(0, 500),
      verified: row.verified === true
    };
  });

  const vocabulary = body.vocabulary.map((item) => {
    const row = asRecord(item);
    const writtenForm = cleanText(row.writtenForm);
    if (!writtenForm || [...writtenForm].length > 24) {
      throw new LessonError("Mỗi từ cần có chữ viết, không quá 24 ký tự.");
    }

    const requestedType = cleanText(row.vocabularyType);
    const vocabularyType = ["compound_noun", "verb", "suru_verb", "adjective", "adverb", "other"].includes(requestedType)
      ? requestedType
      : classifyVocabulary(writtenForm);
    const kanjiCharacters = Array.isArray(row.kanjiCharacters)
      ? row.kanjiCharacters.filter((character): character is string => typeof character === "string" && isKanji(character))
      : [];

    return {
      id: typeof row.id === "string" ? row.id : undefined,
      writtenForm,
      hiragana: cleanText(row.hiragana),
      meanings: splitList(row.meanings),
      vocabularyType,
      readingVariants: splitList(row.readingVariants),
      kanjiCharacters: [...new Set(kanjiCharacters)],
      notes: cleanText(row.notes).slice(0, 500),
      verified: row.verified === true
    };
  });

  return {
    title,
    jlptLevel,
    lessonNumber,
    kanji,
    vocabulary,
    resolvedUncertainIds: Array.isArray(body.resolvedUncertainIds)
      ? body.resolvedUncertainIds.filter((id): id is string => typeof id === "string")
      : []
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    throw new LessonError("Một dòng dữ liệu không hợp lệ.");
  }
  return value as Record<string, unknown>;
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function splitList(value: unknown): string[] {
  const source = Array.isArray(value) ? value.join("\n") : cleanText(value);
  return [...new Set(source.split(/[、,，/／;\n]+/u).map((item) => item.trim()).filter(Boolean))];
}

function nextOrigin(previousOrigin: string | undefined, previousValue: string, nextValue: string, verified: boolean): string {
  if (!nextValue.trim()) {
    return "none";
  }

  if (verified || previousValue.trim() !== nextValue.trim()) {
    return "verified";
  }

  if (previousOrigin === "source" || previousOrigin === "suggested" || previousOrigin === "verified") {
    return previousOrigin;
  }

  return "verified";
}

type LessonWithItems = Awaited<ReturnType<typeof requireLesson>>;

interface StudyQuestion {
  id: string;
  itemType: "kanji" | "vocabulary";
  prompt: string;
  back?: Record<string, unknown>;
}

function buildQuestions(lesson: LessonWithItems, mode: string, include: string, revealMeaning: boolean): StudyQuestion[] {
  const kanjiQuestions: StudyQuestion[] = lesson.kanji
    .filter((item) => mode !== "hanviet" || eligibleHanVietQuestion(item.hanViet))
    .filter(() => mode !== "reading")
    .filter(() => include !== "vocabulary")
    .map((item) => ({
      id: item.id,
      itemType: "kanji" as const,
      prompt: item.character,
      back: {
        hanViet: item.hanViet,
        onReadings: asStringArray(item.onReadings),
        kunReadings: asStringArray(item.kunReadings),
        meanings: asStringArray(item.meanings),
        notes: item.notes,
        examples: lesson.vocabulary
          .filter((vocab) => vocab.kanjiLinks.some((link) => link.kanjiId === item.id))
          .slice(0, 6)
          .map((vocab) => ({
            writtenForm: vocab.writtenForm,
            hiragana: vocab.hiragana,
            meanings: asStringArray(vocab.meanings)
          }))
      }
    }));

  const vocabQuestions: StudyQuestion[] = lesson.vocabulary
    .filter((item) => mode !== "reading" || eligibleReadingQuestion(item.writtenForm, item.hiragana))
    .filter(() => mode !== "hanviet")
    .filter(() => include !== "kanji")
    .map((item) => ({
      id: item.id,
      itemType: "vocabulary" as const,
      prompt: item.writtenForm,
      back: {
        hiragana: item.hiragana,
        meanings: revealMeaning ? asStringArray(item.meanings) : [],
        kanji: item.kanjiLinks.map((link) => ({ character: link.kanji.character, hanViet: link.kanji.hanViet })),
        notes: item.notes,
        vocabularyType: item.vocabularyType
      }
    }));

  if (mode === "hanviet") {
    return kanjiQuestions;
  }

  if (mode === "reading") {
    return vocabQuestions;
  }

  return [...kanjiQuestions, ...vocabQuestions];
}

function gradeQuestion(lesson: LessonWithItems, mode: string, questionId: string, answer: string, ignoreDiacritics: boolean) {
  if (mode === "flashcards") {
    const kanji = lesson.kanji.find((item) => item.id === questionId);
    const vocab = lesson.vocabulary.find((item) => item.id === questionId);
    const known = answer === "known";
    return {
      itemType: kanji ? "kanji" as const : "vocabulary" as const,
      correct: known,
      expected: known ? "known" : "again",
      meanings: vocab ? asStringArray(vocab.meanings) : kanji ? asStringArray(kanji.meanings) : []
    };
  }

  if (mode === "hanviet") {
    const kanji = lesson.kanji.find((item) => item.id === questionId);
    if (!kanji) {
      throw new LessonError("Không tìm thấy kanji của câu hỏi.");
    }
    const result = gradeHanViet(answer, kanji.hanViet, { ignoreDiacritics });
    return { itemType: "kanji" as const, correct: result.correct, expected: kanji.hanViet, meanings: asStringArray(kanji.meanings) };
  }

  const vocab = lesson.vocabulary.find((item) => item.id === questionId);
  if (!vocab) {
    throw new LessonError("Không tìm thấy từ của câu hỏi.");
  }

  const result = gradeHiragana(answer, vocab.hiragana, asStringArray(vocab.readingVariants));
  return {
    itemType: "vocabulary" as const,
    correct: result.correct,
    expected: vocab.hiragana,
    meanings: asStringArray(vocab.meanings)
  };
}
