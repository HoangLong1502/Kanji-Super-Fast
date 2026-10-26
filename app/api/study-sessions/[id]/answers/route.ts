import { NextResponse } from "next/server";
import { toErrorResponse } from "../../../../../lib/errors";
import { getCurrentUser, submitAnswer } from "../../../../../lib/lessonService";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const user = await getCurrentUser();
    const { id } = await context.params;
    const body = (await request.json()) as { questionId?: string; answer?: string };
    return NextResponse.json(await submitAnswer(user.id, id, body));
  } catch (error) {
    return toErrorResponse(error);
  }
}
