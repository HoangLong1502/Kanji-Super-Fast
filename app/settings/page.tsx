import { SettingsForm } from "../../components/SettingsForm";
import { requirePageUser } from "../../lib/lessonService";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requirePageUser();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <p className="text-sm font-medium text-brand">Cài đặt · {user.email}</p>
        <h1 className="text-3xl font-semibold">Cách chấm bài</h1>
        <p className="mt-2 text-sm text-stone-600">
          Cài đặt này chỉ áp dụng cho tài khoản của bạn. Đăng xuất rồi đăng nhập tài khoản khác để học riêng.
        </p>
      </div>
      <SettingsForm ignoreDiacritics={user.ignoreDiacritics} revealMeaning={user.revealMeaning} />
    </div>
  );
}
