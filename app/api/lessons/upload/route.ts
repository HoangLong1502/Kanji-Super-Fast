import { NextResponse } from "next/server";
import { toErrorResponse } from "../../../../lib/errors";
import { createLessonFromFile, getCurrentUser } from "../../../../lib/lessonService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Hãy chọn một file." }, { status: 400 });
    }

    const result = await createLessonFromFile(user.id, {
      filename: file.name,
      bytes: Buffer.from(await file.arrayBuffer())
    });
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
