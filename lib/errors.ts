import { NextResponse } from "next/server";

export class LessonError extends Error {
  constructor(
    message: string,
    readonly status = 400
  ) {
    super(message);
  }
}

export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof LessonError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error(error);
  return NextResponse.json({ error: "Có lỗi khi xử lý yêu cầu." }, { status: 500 });
}
