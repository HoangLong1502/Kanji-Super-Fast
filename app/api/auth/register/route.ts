import { NextResponse } from "next/server";
import { registerUser } from "../../../../lib/authService";
import { toErrorResponse } from "../../../../lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; name?: string; password?: string };
    const user = await registerUser(body);
    return NextResponse.json({ user });
  } catch (error) {
    return toErrorResponse(error);
  }
}
