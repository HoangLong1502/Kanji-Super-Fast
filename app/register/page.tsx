import { AuthForm } from "../../components/AuthForm";

export const dynamic = "force-dynamic";

export default function RegisterPage() {
  return (
    <div className="mx-auto max-w-md space-y-4 py-8">
      <div className="text-center">
        <p className="font-jp text-3xl font-bold text-brand">SuperKanji</p>
        <h1 className="mt-3 text-2xl font-semibold">Tạo tài khoản</h1>
        <p className="mt-2 text-sm text-stone-600">Dùng email và mật khẩu để tách dữ liệu học của từng người.</p>
      </div>
      <AuthForm mode="register" />
    </div>
  );
}
