export type ImageOcrPage = {
  page: number;
  text: string;
};

/** OCR ảnh bằng Tesseract (tiếng Nhật + Latin). Lần đầu sẽ tải model ngôn ngữ (~vài chục MB). */
export async function extractImageText(bytes: Buffer): Promise<ImageOcrPage[]> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(["jpn", "eng"]);

  try {
    const result = await worker.recognize(bytes);
    const text = String(result.data.text ?? "")
      .replace(/\u0000/g, "")
      .replace(/[ \t]+\n/gu, "\n")
      .replace(/\n{3,}/gu, "\n\n")
      .trim();

    if (!text) {
      return [];
    }

    return [{ page: 1, text }];
  } finally {
    await worker.terminate();
  }
}

export function imageOcrLooksEmpty(pages: ImageOcrPage[]): boolean {
  const combined = pages.map((page) => page.text).join("\n");
  const japanese = combined.match(/[\u3040-\u30ff\u3400-\u9fff]/gu) ?? [];
  return combined.trim().length < 8 || japanese.length < 1;
}
