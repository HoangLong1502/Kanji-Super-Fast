import { NextResponse } from "next/server";
import { toErrorResponse } from "../../../lib/errors";
import { getCurrentUser, updateSettings } from "../../../lib/lessonService";

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();
    const body = (await request.json()) as { ignoreDiacritics?: boolean; revealMeaning?: boolean };
    const updated = await updateSettings(user.id, body);
    return NextResponse.json({ ignoreDiacritics: updated.ignoreDiacritics, revealMeaning: updated.revealMeaning });
  } catch (error) {
    return toErrorResponse(error);
  }
}
