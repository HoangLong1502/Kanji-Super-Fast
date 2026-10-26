import { NextResponse } from "next/server";
import { logoutUser } from "../../../../lib/authService";
import { toErrorResponse } from "../../../../lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await logoutUser();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
