import Link from "next/link";
import { VideoActions } from "../../components/VideoActions";
import { VideoUploadForm } from "../../components/VideoUploadForm";
import { requirePageUser } from "../../lib/lessonService";
import { formatBytes } from "../../lib/videoLimits";
import { listVideos } from "../../lib/videoService";

export const dynamic = "force-dynamic";

export default async function VideosPage() {
  const user = await requirePageUser();
  const videos = await listVideos(user.id);

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-brand">Thư viện video</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Xem video dung lượng lớn</h1>
          <p className="mt-2 max-w-2xl text-stone-600">
            Ghi tiêu đề, tải video lên máy này, rồi xem lại ngay trong SuperKanji.
          </p>
        </div>
        <Link href="/" className="rounded-full border border-line bg-white px-4 py-2 text-sm font-medium">
          Về trang chính
        </Link>
      </section>

      <VideoUploadForm />

      <section>
        <h2 className="mb-3 text-lg font-semibold">Video của bạn</h2>
        {videos.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-line bg-paper px-6 py-12 text-center">
            <p className="text-lg font-medium">Chưa có video nào</p>
            <p className="mt-2 text-stone-600">Điền tiêu đề và chọn file để tải video đầu tiên.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {videos.map((video) => (
              <article key={video.id} className="rounded-3xl border border-line bg-paper p-5 shadow-card">
                <h3 className="text-xl font-semibold">{video.title}</h3>
                <p className="mt-1 text-sm text-stone-500">{video.originalFilename}</p>
                <p className="mt-3 text-sm text-stone-600">
                  {formatBytes(video.byteSize)} · {new Date(video.createdAt).toLocaleString("vi")}
                </p>
                <div className="mt-4">
                  <VideoActions id={video.id} title={video.title} />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
