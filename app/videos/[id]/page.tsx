import Link from "next/link";
import { notFound } from "next/navigation";
import { VideoActions } from "../../../components/VideoActions";
import { requirePageUser } from "../../../lib/lessonService";
import { formatBytes } from "../../../lib/videoLimits";
import { findOwnedVideo } from "../../../lib/videoService";

export const dynamic = "force-dynamic";

export default async function VideoWatchPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  const video = await findOwnedVideo(user.id, id);
  if (!video) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <Link href="/videos" className="text-sm font-medium text-brand">
        ← Thư viện video
      </Link>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{video.title}</h1>
        <p className="mt-2 text-sm text-stone-500">
          {video.originalFilename} · {formatBytes(video.byteSize)} · {new Date(video.createdAt).toLocaleString("vi")}
        </p>
      </div>
      <video
        key={video.id}
        controls
        playsInline
        preload="metadata"
        className="aspect-video w-full rounded-3xl bg-black"
        src={`/api/videos/${video.id}/file`}
      >
        Trình duyệt không phát được video này.
      </video>
      <p className="text-sm text-stone-500">Nếu không phát được, hãy tải lại bản MP4 (H.264). MKV thường không xem được trên trình duyệt.</p>
      <VideoActions id={video.id} title={video.title} redirectTo="/videos" />
    </div>
  );
}
