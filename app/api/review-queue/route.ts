import { NextResponse } from "next/server";
import { toErrorResponse } from "../../../lib/errors";
import { getCurrentUser, getReviewQueue } from "../../../lib/lessonService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    return NextResponse.json(await getReviewQueue(user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
