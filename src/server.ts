import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { extractLessonFromPptx } from "./pipeline.js";

const publicDir = resolve(process.cwd(), "public");
const port = Number(process.env.PORT ?? 3456);
const maxUploadBytes = 20 * 1024 * 1024;

const mimeTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8"
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    if (req.method === "POST" && url.pathname === "/api/extract") {
      await handleExtract(req, res);
      return;
    }

    if (req.method === "GET") {
      await serveStatic(url.pathname, res);
      return;
    }

    sendJson(res, 405, { error: "Method not allowed." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    sendJson(res, 500, { error: message });
  }
});

async function handleExtract(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse
): Promise<void> {
  const contentType = req.headers["content-type"] ?? "";
  if (!contentType.includes("multipart/form-data")) {
    sendJson(res, 400, { error: "Upload must be multipart/form-data with a .pptx file." });
    return;
  }

  const body = await readRequestBody(req, maxUploadBytes);
  const file = parseMultipartPptx(body, contentType);

  if (!file) {
    sendJson(res, 400, { error: "No .pptx file found. Use field name \"pptx\"." });
    return;
  }

  if (!file.filename.toLowerCase().endsWith(".pptx")) {
    sendJson(res, 400, { error: "Only .pptx files are accepted." });
    return;
  }

  const includeNotes = file.includeNotes;
  const result = await extractLessonFromPptx(file.buffer, { includeNotes });

  sendJson(res, 200, {
    fileName: file.filename,
    vocabularyCount: result.vocabulary.length,
    kanjiCount: result.kanji.length,
    slideCount: result.rawSlides.length,
    ...result
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

function readRequestBody(
  req: import("node:http").IncomingMessage,
  limit: number
): Promise<Buffer> {
  return new Promise((resolvePromise, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;

    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("File too large. Maximum size is 20MB."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => resolvePromise(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function parseMultipartPptx(
  body: Buffer,
  contentType: string
): { filename: string; buffer: Buffer; includeNotes: boolean } | undefined {
  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  if (!boundaryMatch) {
    return undefined;
  }

  const boundary = boundaryMatch[1] ?? boundaryMatch[2];
  const parts = splitMultipart(body, boundary);
  let includeNotes = false;
  let file: { filename: string; buffer: Buffer } | undefined;

  for (const part of parts) {
    const headerEnd = indexOfBuffer(part, Buffer.from("\r\n\r\n"));
    if (headerEnd < 0) {
      continue;
    }

    const headerText = part.subarray(0, headerEnd).toString("utf8");
    let content = part.subarray(headerEnd + 4);
    if (content.subarray(-2).equals(Buffer.from("\r\n"))) {
      content = content.subarray(0, -2);
    }

    const nameMatch = /name="([^"]+)"/i.exec(headerText);
    const filenameMatch = /filename="([^"]*)"/i.exec(headerText);
    const name = nameMatch?.[1];

    if (name === "includeNotes") {
      includeNotes = content.toString("utf8").trim() === "true";
      continue;
    }

    if (name === "pptx" && filenameMatch?.[1]) {
      file = {
        filename: filenameMatch[1],
        buffer: content
      };
    }
  }

  return file ? { ...file, includeNotes } : undefined;
}

function splitMultipart(body: Buffer, boundary: string): Buffer[] {
  const delimiter = Buffer.from(`--${boundary}`);
  const parts: Buffer[] = [];
  let start = indexOfBuffer(body, delimiter);

  while (start >= 0) {
    start += delimiter.length;
    if (body.subarray(start, start + 2).equals(Buffer.from("--"))) {
      break;
    }
    if (body.subarray(start, start + 2).equals(Buffer.from("\r\n"))) {
      start += 2;
    }

    const end = indexOfBuffer(body, delimiter, start);
    if (end < 0) {
      break;
    }

    parts.push(body.subarray(start, end));
    start = end;
  }

  return parts;
}

function indexOfBuffer(haystack: Buffer, needle: Buffer, from = 0): number {
  return haystack.indexOf(needle, from);
}

function sendJson(
  res: import("node:http").ServerResponse,
  status: number,
  payload: unknown
): void {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

server.listen(port, () => {
  console.log(`SuperKanji web running at http://localhost:${port}`);
});
