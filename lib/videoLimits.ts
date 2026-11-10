export const MAX_VIDEO_BYTES = 8 * 1024 * 1024 * 1024;
export const MAX_VIDEO_LABEL = "8GB";
export const MAX_VIDEO_TITLE = 120;

const UNITS = ["KB", "MB", "GB", "TB"];

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "0 B";
  }
  if (bytes < 1024) {
    return `${Math.round(bytes)} B`;
  }

  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }

  const digits = value >= 10 || Number.isInteger(value) ? 0 : 1;
  return `${value.toFixed(digits)} ${UNITS[unit]}`;
}
