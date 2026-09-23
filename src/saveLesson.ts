import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { validateLessonResult } from "./pipeline.js";
import type { LessonExtractionResult } from "./types.js";

export async function saveLessonJson(result: LessonExtractionResult, outputPath: string): Promise<void> {
  validateLessonResult(result);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
}
