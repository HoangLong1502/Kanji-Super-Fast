export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

export function asNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is number => typeof item === "number");
}

export function asBlocks(value: unknown): Array<{ page: number; text: string }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const page = "page" in item && typeof item.page === "number" ? item.page : 0;
    const text = "text" in item && typeof item.text === "string" ? item.text : "";
    return text ? [{ page, text }] : [];
  });
}
