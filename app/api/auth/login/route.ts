import { NextResponse } from "next/server";
import { loginUser } from "../../../../lib/authService";
import { toErrorResponse } from "../../../../lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const user = await loginUser(body);
    return NextResponse.json({ user });
  } catch (error) {
    return toErrorResponse(error);
  }
}
