import { NextResponse } from "next/server";
import { toErrorResponse } from "../../../../lib/errors";
import { getCurrentUser } from "../../../../lib/lessonService";
import { createVideo } from "../../../../lib/videoService";
import { parseVideoUpload } from "../../../../lib/videoStorage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 3600;

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    const upload = await parseVideoUpload(request, user.id);
    const video = await createVideo(user.id, upload);
    return NextResponse.json({ id: video.id, title: video.title });
  } catch (error) {
    return toErrorResponse(error);
  }
}
