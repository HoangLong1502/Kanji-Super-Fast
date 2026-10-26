import { NextResponse } from "next/server";
import { toErrorResponse } from "../../../../lib/errors";
import { deleteLesson, getCurrentUser, getLessonDetail, renameLesson, updateLessonContent } from "../../../../lib/lessonService";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const user = await getCurrentUser();
    const { id } = await context.params;
    return NextResponse.json(await getLessonDetail(user.id, id));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await getCurrentUser();
    const { id } = await context.params;
    const body = (await request.json()) as { title?: string; kanji?: unknown };
    if (Array.isArray(body.kanji)) {
      await updateLessonContent(user.id, id, body);
    } else if (typeof body.title === "string") {
      await renameLesson(user.id, id, body.title);
    } else {
      return NextResponse.json({ error: "Không có gì để cập nhật." }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const user = await getCurrentUser();
    const { id } = await context.params;
    await deleteLesson(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
