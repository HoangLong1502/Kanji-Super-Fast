import Link from "next/link";

export default function NotFound() {
  return (
    <div className="rounded-3xl border border-line bg-paper px-6 py-12 text-center">
      <h1 className="text-2xl font-semibold">Không tìm thấy trang</h1>
      <Link href="/" className="mt-4 inline-block text-brand">
        Về bảng điều khiển
      </Link>
    </div>
  );
}
