import { AuthForm } from "../../components/AuthForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const query = await searchParams;
  const nextPath = query.next?.startsWith("/") ? query.next : "/";

  return (
    <div className="mx-auto max-w-md space-y-4 py-8">
      <div className="text-center">
        <p className="font-jp text-3xl font-bold text-brand">SuperKanji</p>
        <h1 className="mt-3 text-2xl font-semibold">Đăng nhập</h1>
        <p className="mt-2 text-sm text-stone-600">Mỗi tài khoản có bài học và tiến độ riêng.</p>
      </div>
      <AuthForm mode="login" nextPath={nextPath} />
    </div>
  );
}
