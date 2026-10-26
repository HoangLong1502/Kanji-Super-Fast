import { NextResponse } from "next/server";
import { toErrorResponse } from "../../../../../lib/errors";
import { exportLesson, getCurrentUser } from "../../../../../lib/lessonService";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const user = await getCurrentUser();
    const { id } = await context.params;
    const payload = await exportLesson(user.id, id);
    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="lesson-${id}.json"`
      }
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
