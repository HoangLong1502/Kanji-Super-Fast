import { redirect } from "next/navigation";
import { prisma } from "./db.js";
import { LessonError } from "./errors.js";
import {
  clearSessionCookie,
  hashPassword,
  readSessionUserId,
  validateAuthInput,
  verifyPassword,
  writeSessionCookie
} from "./session.js";

export async function registerUser(input: { email?: string; name?: string; password?: string }) {
  const parsed = validateAuthInput(input, "register");
  if ("error" in parsed) {
    throw new LessonError(parsed.error);
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.email } });
  if (existing) {
    throw new LessonError("Email này đã có tài khoản.");
  }

  const user = await prisma.user.create({
    data: {
      email: parsed.email,
      name: parsed.name,
      passwordHash: hashPassword(parsed.password)
    }
  });

  await writeSessionCookie(user.id);
  return { id: user.id, email: user.email, name: user.name };
}

export async function loginUser(input: { email?: string; password?: string }) {
  const parsed = validateAuthInput(input, "login");
  if ("error" in parsed) {
    throw new LessonError(parsed.error);
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.email } });
  if (!user || !user.passwordHash || !verifyPassword(parsed.password, user.passwordHash)) {
    throw new LessonError("Email hoặc mật khẩu không đúng.", 401);
  }

  await writeSessionCookie(user.id);
  return { id: user.id, email: user.email, name: user.name };
}

export async function logoutUser() {
  await clearSessionCookie();
}

export async function getSessionUser() {
  const userId = await readSessionUserId();
  if (!userId) {
    return null;
  }

  return prisma.user.findUnique({ where: { id: userId } });
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) {
    throw new LessonError("Bạn cần đăng nhập.", 401);
  }

  return user;
}

export async function requirePageUser() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  return user;
}
