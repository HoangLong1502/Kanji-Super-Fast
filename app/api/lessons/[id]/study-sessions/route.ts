import { NextResponse } from "next/server";
import { toErrorResponse } from "../../../../../lib/errors";
import { createStudySession, getCurrentUser } from "../../../../../lib/lessonService";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const user = await getCurrentUser();
    const { id } = await context.params;
    const body = (await request.json()) as { mode?: string; include?: string; retryIncorrect?: boolean };
    return NextResponse.json(await createStudySession(user.id, id, body));
  } catch (error) {
    return toErrorResponse(error);
  }
}
