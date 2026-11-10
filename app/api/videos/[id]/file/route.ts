import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { toErrorResponse } from "../../../../../lib/errors";
import { getCurrentUser } from "../../../../../lib/lessonService";
import { findOwnedVideo } from "../../../../../lib/videoService";
import { parseByteRange, videoFilePath } from "../../../../../lib/videoStorage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const user = await getCurrentUser();
    const { id } = await context.params;
    const video = await findOwnedVideo(user.id, id);
    if (!video) {
      return NextResponse.json({ error: "Không tìm thấy video." }, { status: 404 });
    }

    const filePath = videoFilePath(user.id, video.storedName);
    const info = await stat(filePath).catch(() => null);
    if (!info || !info.isFile()) {
      return NextResponse.json({ error: "File video không còn trên máy." }, { status: 404 });
    }

    const size = info.size;
    const rangeHeader = request.headers.get("range");
    const common = {
      "Content-Type": video.mimeType,
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-store"
    };

    if (!rangeHeader) {
      return streamFile(request, filePath, 200, {
        ...common,
        "Content-Length": String(size)
      });
    }

    const range = parseByteRange(rangeHeader, size);
    if (!range) {
      return new NextResponse(null, {
        status: 416,
        headers: {
          ...common,
          "Content-Range": `bytes */${size}`
        }
      });
    }

    return streamFile(
      request,
      filePath,
      206,
      {
        ...common,
        "Content-Length": String(range.end - range.start + 1),
        "Content-Range": `bytes ${range.start}-${range.end}/${size}`
      },
      range
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}

function streamFile(
  request: Request,
  filePath: string,
  status: number,
  headers: Record<string, string>,
  range?: { start: number; end: number }
) {
  const nodeStream = createReadStream(filePath, range ? { start: range.start, end: range.end } : undefined);
  const abort = () => nodeStream.destroy();
  request.signal.addEventListener("abort", abort, { once: true });
  nodeStream.on("close", () => request.signal.removeEventListener("abort", abort));
  return new Response(Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>, { status, headers });
}
