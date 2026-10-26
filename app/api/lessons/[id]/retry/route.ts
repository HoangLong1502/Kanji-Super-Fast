import { NextResponse } from "next/server";
import { toErrorResponse } from "../../../../../lib/errors";
import { getCurrentUser, retryLesson } from "../../../../../lib/lessonService";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Context) {
  try {
    const user = await getCurrentUser();
    const { id } = await context.params;
    await retryLesson(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
