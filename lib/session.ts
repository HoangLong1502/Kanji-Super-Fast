import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "sk_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 30;

function authSecret(): string {
  return process.env.AUTH_SECRET?.trim() || "superkanji-dev-secret-doi-khi-len-server";
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) {
    return false;
  }

  const next = scryptSync(password, salt, 64).toString("hex");
  try {
    return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(next, "hex"));
  } catch {
    return false;
  }
}

export function signSession(userId: string): string {
  const exp = String(Date.now() + MAX_AGE_SEC * 1000);
  const payload = `${userId}.${exp}`;
  const sig = createHmac("sha256", authSecret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function parseSession(token: string | undefined | null): string | null {
  if (!token) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [userId, exp, sig] = parts;
  if (!userId || !exp || !sig) {
    return null;
  }

  const payload = `${userId}.${exp}`;
  const expected = createHmac("sha256", authSecret()).update(payload).digest("hex");
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return null;
    }
  } catch {
    return null;
  }

  if (Number(exp) < Date.now()) {
    return null;
  }

  return userId;
}

export async function readSessionUserId(): Promise<string | null> {
  const jar = await cookies();
  return parseSession(jar.get(SESSION_COOKIE)?.value);
}

function cookieSecure(): boolean {
  // Tailscale/HTTP trên máy nhà: để tắt. Chỉ bật khi có HTTPS thật.
  return process.env.AUTH_SECURE_COOKIE === "1";
}

export async function writeSessionCookie(userId: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, signSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: MAX_AGE_SEC
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: 0
  });
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateAuthInput(
  input: { email?: string; name?: string; password?: string },
  mode: "login" | "register"
): { error: string } | { email: string; name: string; password: string } {
  const email = normalizeEmail(input.email ?? "");
  const name = (input.name ?? "").trim();
  const password = input.password ?? "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email) || email.length > 120) {
    return { error: "Email không hợp lệ." };
  }

  if (password.length < 6 || password.length > 100) {
    return { error: "Mật khẩu cần từ 6 đến 100 ký tự." };
  }

  if (mode === "register" && (!name || name.length > 60)) {
    return { error: "Tên hiển thị cần từ 1 đến 60 ký tự." };
  }

  return { email, name, password };
}
