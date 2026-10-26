import { createServer } from "node:http";
import { createWriteStream } from "node:fs";
import { readFile, unlink } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";
import Busboy from "busboy";
import { extractLessonFromPptx } from "./pipeline.js";

const publicDir = resolve(process.cwd(), "public");
const port = Number(process.env.PORT ?? 3456);
const maxUploadBytes = 100 * 1024 * 1024;
const maxUploadLabel = "100MB";

const mimeTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon"
};

const server = createServer((req, res) => {
  void handleRequest(req, res);
});

async function handleRequest(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse
): Promise<void> {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    if (req.method === "POST" && url.pathname === "/api/extract") {
      await handleExtract(req, res);
      return;
    }

    if (req.method === "GET" && url.pathname === "/favicon.ico") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === "GET") {
      await serveStatic(url.pathname, res);
      return;
    }

    sendJson(res, 405, { error: "Method not allowed." });
  } catch (error) {
    console.error("[request]", error);
    if (!res.headersSent) {
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      sendJson(res, 500, { error: message });
    }
  }
}

async function handleExtract(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse
): Promise<void> {
  const contentType = req.headers["content-type"] ?? "";
  if (!contentType.includes("multipart/form-data")) {
    sendJson(res, 400, { error: "Upload must be multipart/form-data with a .pptx file." });
    return;
  }

  let upload: Awaited<ReturnType<typeof parseUpload>>;

  try {
    upload = await parseUpload(req);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    sendJson(res, 400, { error: message });
    return;
  }

  if (!upload) {
    sendJson(res, 400, { error: "No .pptx file found. Use field name \"pptx\"." });
    return;
  }

  if (!upload.filename.toLowerCase().endsWith(".pptx")) {
    await unlink(upload.tempPath).catch(() => undefined);
    sendJson(res, 400, { error: "Only .pptx files are accepted (not .ppt)." });
    return;
  }

  try {
    const result = await extractLessonFromPptx(upload.tempPath, {
      includeNotes: upload.includeNotes
    });

    sendJson(res, 200, {
      fileName: upload.filename,
      vocabularyCount: result.vocabulary.length,
      kanjiCount: result.kanji.length,
      slideCount: result.rawSlides.length,
      vocabulary: result.vocabulary,
      kanji: result.kanji,
      rawSlides: result.rawSlides.map((slide) => ({
        slideNumber: slide.slideNumber,
        sourceType: slide.sourceType,
        rawText: slide.rawText,
        normalizedText: slide.normalizedText
      }))
    });
  } catch (error) {
    console.error("[extract]", error);
    const message =
      error instanceof Error ? error.message : "Failed to extract text from PowerPoint.";
    sendJson(res, 400, {
      error: `Cannot read this PowerPoint: ${message}`
    });
  } finally {
    await unlink(upload.tempPath).catch(() => undefined);
  }
}

function parseUpload(req: import("node:http").IncomingMessage): Promise<
  | {
      filename: string;
      tempPath: string;
      includeNotes: boolean;
    }
  | undefined
> {
  return new Promise((resolvePromise, reject) => {
    let settled = false;
    let includeNotes = false;
    let filename = "";
    let tempPath = "";
    let tooLarge = false;
    let filePromise: Promise<void> | undefined;

    const busboy = Busboy({
      headers: req.headers as Record<string, string>,
      limits: {
        files: 1,
        fileSize: maxUploadBytes
      }
    });

    const settle = (error?: Error, value?: { filename: string; tempPath: string; includeNotes: boolean }) => {
      if (settled) {
        return;
      }
      settled = true;
      if (error) {
        reject(error);
      } else {
        resolvePromise(value);
      }
    };

    busboy.on("file", (fieldname, file, info) => {
      if (fieldname !== "pptx") {
        file.resume();
        return;
      }

      filename = info.filename || "upload.pptx";
      tempPath = join(tmpdir(), `superkanji-${randomUUID()}.pptx`);
      const output = createWriteStream(tempPath);

      file.on("limit", () => {
        tooLarge = true;
        file.unpipe(output);
        output.destroy();
        file.resume();
      });

      filePromise = pipeline(file, output).catch((error: Error) => {
        if (!tooLarge) {
          throw error;
        }
      });
    });

    busboy.on("field", (fieldname, value) => {
      if (fieldname === "includeNotes") {
        includeNotes = value === "true";
      }
    });

    busboy.on("error", (error: Error) => {
      settle(error);
    });

    busboy.on("finish", () => {
      void (async () => {
        try {
          if (filePromise) {
            await filePromise;
          }

          if (tooLarge) {
            if (tempPath) {
              await unlink(tempPath).catch(() => undefined);
            }
            settle(new Error(`File too large. Maximum size is ${maxUploadLabel}.`));
            return;
          }

          if (!filename || !tempPath) {
            settle(undefined, undefined);
            return;
          }

          settle(undefined, { filename, tempPath, includeNotes });
        } catch (error) {
          if (tempPath) {
            await unlink(tempPath).catch(() => undefined);
          }
          settle(error instanceof Error ? error : new Error("Upload failed."));
        }
      })();
    });

    req.on("aborted", () => {
      if (tempPath) {
        void unlink(tempPath).catch(() => undefined);
      }
      settle(new Error("Upload aborted."));
    });

    req.pipe(busboy);
  });
}

async function serveStatic(
  pathname: string,
  res: import("node:http").ServerResponse
): Promise<void> {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const normalized = safePath.replace(/^\/+/, "").replace(/\.\./g, "");
  const filePath = join(publicDir, normalized);

  try {
    const data = await readFile(filePath);
    const type = mimeTypes[extname(filePath)] ?? "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    res.end(data);
  } catch {
    sendJson(res, 404, { error: "Not found." });
  }
}

function sendJson(
  res: import("node:http").ServerResponse,
  status: number,
  payload: unknown
): void {
  if (res.headersSent) {
    return;
  }

  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

process.on("uncaughtException", (error) => {
  console.error("[uncaughtException]", error);
});

process.on("unhandledRejection", (error) => {
  console.error("[unhandledRejection]", error);
});

server.on("error", (error) => {
  console.error("[server]", error);
  process.exit(1);
});

server.listen(port, () => {
  console.log(`SuperKanji web running at http://localhost:${port}`);
});
