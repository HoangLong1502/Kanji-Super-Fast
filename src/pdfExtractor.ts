export interface PdfPageText {
  page: number;
  text: string;
}

export async function extractPdfText(data: Buffer): Promise<PdfPageText[]> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(data));
  const extracted = await extractText(pdf, { mergePages: false });
  const pages = Array.isArray(extracted.text) ? extracted.text : [extracted.text];

  return pages
    .map((text, index) => ({
      page: index + 1,
      text: String(text ?? "").replace(/\u0000/g, "").trim()
    }))
    .filter((page) => page.text.length > 0);
}

export function pdfNeedsOcr(pages: PdfPageText[]): boolean {
  const combined = pages.map((page) => page.text).join("\n");
  const japanese = combined.match(/[\u3040-\u30ff\u3400-\u9fff]/gu) ?? [];
  return combined.trim().length < 20 || japanese.length < 2;
}
