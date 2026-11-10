export type UploadKind = "pptx" | "pdf" | "ppt" | "jpeg" | "png" | "gif" | "webp" | "unknown";

export function detectUploadKind(bytes: Buffer): UploadKind {
  if (bytes.length >= 8 && bytes.subarray(0, 4).toString("hex") === "d0cf11e0") {
    return "ppt";
  }

  if (bytes.subarray(0, 5).toString("utf8") === "%PDF-") {
    return "pdf";
  }

  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "png";
  }

  if (bytes.length >= 6) {
    const header = bytes.subarray(0, 6).toString("ascii");
    if (header === "GIF87a" || header === "GIF89a") {
      return "gif";
    }
  }

  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }

  if (bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b) {
    return "pptx";
  }

  return "unknown";
}

export function isImageKind(kind: UploadKind): boolean {
  return kind === "jpeg" || kind === "png" || kind === "gif" || kind === "webp";
}

export function extensionForKind(kind: UploadKind): string | null {
  switch (kind) {
    case "pdf":
      return "pdf";
    case "pptx":
      return "pptx";
    case "jpeg":
      return "jpg";
    case "png":
      return "png";
    case "gif":
      return "gif";
    case "webp":
      return "webp";
    default:
      return null;
  }
}
