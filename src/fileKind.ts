export type UploadKind = "pptx" | "pdf" | "ppt" | "unknown";

export function detectUploadKind(bytes: Buffer): UploadKind {
  if (bytes.length >= 8 && bytes.subarray(0, 4).toString("hex") === "d0cf11e0") {
    return "ppt";
  }

  if (bytes.subarray(0, 5).toString("utf8") === "%PDF-") {
    return "pdf";
  }

  if (bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b) {
    return "pptx";
  }

  return "unknown";
}
