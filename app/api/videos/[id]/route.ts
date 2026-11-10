import { NextResponse } from "next/server";
import { toErrorResponse } from "../../../../lib/errors";
import { getCurrentUser } from "../../../../lib/lessonService";
import { deleteVideo, renameVideo } from "../../../../lib/videoService";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await getCurrentUser();
    const { id } = await context.params;
    const body = (await request.json()) as { title?: string };
    if (typeof body.title !== "string") {
      return NextResponse.json({ error: "Hãy ghi tiêu đề cho video." }, { status: 400 });
    }
    await renameVideo(user.id, id, body.title);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const user = await getCurrentUser();
    const { id } = await context.params;
    await deleteVideo(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
