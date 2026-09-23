import { resolve } from "node:path";
import { extractLessonFromPptx } from "./pipeline.js";
import { saveLessonJson } from "./saveLesson.js";

const [, , inputPptx, outputJson] = process.argv;

if (!inputPptx || !outputJson) {
  console.error("Usage: npm run dev -- <input.pptx> <output.json>");
  process.exit(1);
}

const result = await extractLessonFromPptx(resolve(inputPptx));
await saveLessonJson(result, resolve(outputJson));

console.log(`Saved ${result.vocabulary.length} vocabulary entries and ${result.kanji.length} kanji entries.`);
