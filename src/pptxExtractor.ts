import AdmZip from "adm-zip";
import { XMLParser } from "fast-xml-parser";
import { normalizePptText } from "./japanese.js";
import type { ExtractedSlideText, PptExtractionOptions, PptTextSource, SourceType } from "./types.js";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  preserveOrder: false,
  trimValues: false
});

export async function extractPptxText(
  pptxPath: string,
  options: PptExtractionOptions = {}
): Promise<ExtractedSlideText[]> {
  const zip = new AdmZip(pptxPath);
  const entries = zip.getEntries();
  const slideSources = extractSourcesFromEntries(entries, /^ppt\/slides\/slide(\d+)\.xml$/, "slide_text");

  if (options.includeNotes) {
    slideSources.push(
      ...extractSourcesFromEntries(entries, /^ppt\/notesSlides\/notesSlide(\d+)\.xml$/, "notes_text")
    );
  }

  return slideSources
    .map((source) => ({
      ...source,
      normalizedText: normalizePptText(source.rawText)
    }))
    .filter((source) => source.normalizedText.length > 0)
    .sort((left, right) => {
      if (left.slideNumber !== right.slideNumber) {
        return left.slideNumber - right.slideNumber;
      }

      return left.sourceType.localeCompare(right.sourceType);
    });
}

function extractSourcesFromEntries(
  entries: AdmZip.IZipEntry[],
  pathPattern: RegExp,
  sourceType: SourceType
): PptTextSource[] {
  return entries
    .map((entry) => {
      const match = entry.entryName.match(pathPattern);
      if (!match) {
        return undefined;
      }

      const xml = entry.getData().toString("utf8");
      const parsed = xmlParser.parse(xml);
      const rawText = collectTextLayerValues(parsed).join("\n");

      return {
        slideNumber: Number(match[1]),
        rawText,
        sourceType
      };
    })
    .filter((source): source is PptTextSource => Boolean(source));
}

function collectTextLayerValues(node: unknown): string[] {
  if (typeof node === "string") {
    return [];
  }

  if (Array.isArray(node)) {
    return node.flatMap(collectTextLayerValues);
  }

  if (!node || typeof node !== "object") {
    return [];
  }

  return Object.entries(node).flatMap(([key, value]) => {
    // PowerPoint text content is stored in DrawingML <a:t> nodes.
    if (key === "a:t" || key.endsWith(":t")) {
      return typeof value === "string" ? [value] : collectStringValues(value);
    }

    return collectTextLayerValues(value);
  });
}

function collectStringValues(node: unknown): string[] {
  if (typeof node === "string") {
    return [node];
  }

  if (Array.isArray(node)) {
    return node.flatMap(collectStringValues);
  }

  if (!node || typeof node !== "object") {
    return [];
  }

  return Object.values(node).flatMap(collectStringValues);
}
