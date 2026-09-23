import { kanaToRomaji } from "./japanese.js";
import type { DictionaryMetadata, DictionaryProvider } from "./types.js";

export class ExactMatchDictionary implements DictionaryProvider {
  constructor(private readonly entries: ReadonlyMap<string, DictionaryMetadata>) {}

  lookup(word: string): DictionaryMetadata | undefined {
    const metadata = this.entries.get(word);

    if (!metadata) {
      return undefined;
    }

    return {
      ...metadata,
      romaji: metadata.romaji ?? kanaToRomaji(metadata.reading)
    };
  }
}

export function createExactMatchDictionary(entries: Record<string, DictionaryMetadata>): ExactMatchDictionary {
  return new ExactMatchDictionary(new Map(Object.entries(entries)));
}
