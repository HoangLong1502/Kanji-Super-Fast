import { mkdir, writeFile, unlink, access } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

const dataDir = resolve(process.cwd(), "data");
const uploadDir = join(dataDir, "uploads");

export async function ensureUploadDir(): Promise<string> {
  await mkdir(uploadDir, { recursive: true });
  return uploadDir;
}

export function storedUploadPath(fileName: string): string {
  const safe = basename(fileName);
  if (!/^[\w-]+\.(pptx|pdf)$/u.test(safe)) {
    throw new Error("Tên file lưu trữ không hợp lệ.");
  }

  const path = resolve(uploadDir, safe);
  if (!path.startsWith(uploadDir)) {
    throw new Error("Đường dẫn file không hợp lệ.");
  }

  return path;
}

export function displayFilename(filename: string): string {
  return basename(filename.replace(/\\/g, "/")).slice(0, 180) || "upload";
}

/** Best-effort local save. On Vercel/Render the disk is ephemeral or read-only, so failure is normal. */
export async function trySaveUpload(fileName: string, bytes: Buffer): Promise<boolean> {
  try {
    await ensureUploadDir();
    await writeFile(storedUploadPath(fileName), bytes);
    return true;
  } catch {
    return false;
  }
}

export async function tryDeleteUpload(fileName: string): Promise<void> {
  try {
    await unlink(storedUploadPath(fileName));
  } catch {
    // ignore missing or read-only storage
  }
}

export async function uploadExists(fileName: string): Promise<boolean> {
  try {
    await access(storedUploadPath(fileName));
    return true;
  } catch {
    return false;
  }
}
