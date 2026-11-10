import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import Busboy from "busboy";
import { LessonError } from "./errors.js";
import { displayFilename } from "./paths.js";
import { MAX_VIDEO_BYTES, MAX_VIDEO_LABEL, MAX_VIDEO_TITLE } from "./videoLimits.js";

const VIDEO_ROOT = resolve(process.cwd(), "data", "videos");
const EXTENSIONS = new Set(["mp4", "webm", "mov", "m4v", "mkv", "ogg"]);

const MIME_BY_EXT: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mkv: "video/x-matroska",
  ogg: "video/ogg"
};

export type ParsedVideoUpload = {
  title: string;
  originalFilename: string;
  mimeType: string;
  byteSize: bigint;
  storedName: string;
  absolutePath: string;
};

export type ByteRange = { start: number; end: number };

export function videoExtension(filename: string): string | null {
  const base = filename.replace(/\\/g, "/").split("/").pop() ?? "";
  const match = /\.([a-z0-9]+)$/i.exec(base);
  const ext = match?.[1]?.toLowerCase() ?? "";
  return EXTENSIONS.has(ext) ? ext : null;
}

export function normalizeVideoTitle(value: string): string {
  const title = value.trim().replace(/\s+/g, " ");
  if (!title) {
    throw new LessonError("Hãy ghi tiêu đề cho video.");
  }
  if (title.length > MAX_VIDEO_TITLE) {
    throw new LessonError(`Tiêu đề tối đa ${MAX_VIDEO_TITLE} ký tự.`);
  }
  return title;
}

/** Single byte range. Returns null when the range cannot be satisfied. */
export function parseByteRange(header: string, size: number): ByteRange | null {
  if (!Number.isFinite(size) || size <= 0) {
    return null;
  }

  const match = /^bytes=(\d*)-(\d*)$/i.exec(header.trim());
  if (!match || (match[1] === "" && match[2] === "")) {
    return null;
  }

  let start: number;
  let end: number;
  if (match[1] === "") {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) {
      return null;
    }
    start = Math.max(size - suffix, 0);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === "" ? size - 1 : Number(match[2]);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
      return null;
    }
    end = Math.min(end, size - 1);
  }

  if (start < 0 || start >= size || start > end) {
    return null;
  }

  return { start, end };
}

export function videoFilePath(userId: string, storedName: string): string {
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(userId)) {
    throw new LessonError("Người dùng không hợp lệ.");
  }
  if (!/^[a-zA-Z0-9_-]{1,80}\.(mp4|webm|mov|m4v|mkv|ogg)$/.test(storedName)) {
    throw new LessonError("Tên file video không hợp lệ.");
  }

  const path = resolve(VIDEO_ROOT, userId, storedName);
  const rel = relative(VIDEO_ROOT, path);
  if (rel.startsWith(`..${sep}`) || rel === ".." || rel.startsWith("..")) {
    throw new LessonError("Đường dẫn video không hợp lệ.");
  }
  return path;
}

export async function removeVideoFile(userId: string, storedName: string): Promise<void> {
  await rm(videoFilePath(userId, storedName), { force: true });
}

export async function parseVideoUpload(request: Request, userId: string): Promise<ParsedVideoUpload> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data") || !request.body) {
    throw new LessonError("Hãy gửi tiêu đề và file video.");
  }

  const dir = resolve(VIDEO_ROOT, userId);
  videoFilePath(userId, "check.mp4");
  await mkdir(dir, { recursive: true });

  return new Promise((resolveUpload, reject) => {
    let title = "";
    let storedName = "";
    let absolutePath = "";
    let originalFilename = "";
    let mimeType = "";
    let tooLarge = false;
    let settled = false;
    let failure: Error | undefined;
    let fileDone: Promise<void> = Promise.resolve();

    const fail = (error: Error) => {
      failure = failure ?? error;
    };

    const finish = (error?: Error, value?: ParsedVideoUpload) => {
      if (settled) {
        return;
      }
      settled = true;
      if (error) {
        reject(error);
      } else if (value) {
        resolveUpload(value);
      } else {
        reject(new LessonError("Tải video thất bại."));
      }
    };

    let busboy: ReturnType<typeof Busboy>;
    try {
      busboy = Busboy({
        headers: { "content-type": contentType },
        limits: {
          files: 1,
          fileSize: MAX_VIDEO_BYTES,
          fields: 4,
          fieldSize: MAX_VIDEO_TITLE + 40
        }
      });
    } catch {
      finish(new LessonError("Không đọc được dữ liệu tải lên."));
      return;
    }

    busboy.on("field", (name, value) => {
      if (name === "title") {
        title = value;
      }
    });

    busboy.on("file", (name, file, info) => {
      if (name !== "file") {
        file.resume();
        return;
      }

      const ext = videoExtension(info.filename || "");
      if (!ext) {
        file.resume();
        fail(new LessonError("Chỉ nhận video MP4, WebM, MOV, M4V, MKV hoặc OGG."));
        return;
      }

      originalFilename = displayFilename(info.filename || `video.${ext}`);
      mimeType = MIME_BY_EXT[ext] ?? "application/octet-stream";
      storedName = `${randomUUID()}.${ext}`;
      absolutePath = videoFilePath(userId, storedName);
      const output = createWriteStream(absolutePath);
      file.on("limit", () => {
        tooLarge = true;
      });
      fileDone = pipeline(file, output).catch((error: unknown) => {
        if (!tooLarge) {
          throw error;
        }
      });
    });

    busboy.on("error", (error: Error) => {
      if (absolutePath) {
        void rm(absolutePath, { force: true }).catch(() => undefined);
      }
      finish(error);
    });

    busboy.on("finish", () => {
      void (async () => {
        try {
          await fileDone;
          if (failure || tooLarge || !absolutePath) {
            if (absolutePath) {
              await rm(absolutePath, { force: true });
            }
            if (tooLarge) {
              finish(new LessonError(`Video lớn hơn ${MAX_VIDEO_LABEL}.`));
              return;
            }
            finish(failure ?? new LessonError("Hãy chọn một file video."));
            return;
          }

          let cleanTitle = "";
          try {
            cleanTitle = normalizeVideoTitle(title);
          } catch (error) {
            await rm(absolutePath, { force: true });
            finish(error instanceof Error ? error : new LessonError("Tiêu đề không hợp lệ."));
            return;
          }

          const info = await stat(absolutePath);
          if (info.size <= 0) {
            await rm(absolutePath, { force: true });
            finish(new LessonError("File video trống."));
            return;
          }

          finish(undefined, {
            title: cleanTitle,
            originalFilename,
            mimeType,
            byteSize: BigInt(info.size),
            storedName,
            absolutePath
          });
        } catch (error) {
          if (absolutePath) {
            await rm(absolutePath, { force: true }).catch(() => undefined);
          }
          finish(error instanceof Error ? error : new LessonError("Tải video thất bại."));
        }
      })();
    });

    const nodeStream = Readable.fromWeb(request.body as import("node:stream/web").ReadableStream);
    const abort = () => {
      nodeStream.destroy();
      if (absolutePath) {
        void rm(absolutePath, { force: true }).catch(() => undefined);
      }
      finish(new LessonError("Đã hủy tải video."));
    };
    request.signal.addEventListener("abort", abort, { once: true });
    nodeStream.on("error", (error) => {
      if (absolutePath) {
        void rm(absolutePath, { force: true }).catch(() => undefined);
      }
      finish(error);
    });
    nodeStream.pipe(busboy);
  });
}
