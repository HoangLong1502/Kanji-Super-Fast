import { NextResponse } from "next/server";
import { toErrorResponse } from "../../../../../lib/errors";
import { getCurrentUser, suggestMissing } from "../../../../../lib/lessonService";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Context) {
  try {
    const user = await getCurrentUser();
    const { id } = await context.params;
    return NextResponse.json(await suggestMissing(user.id, id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
