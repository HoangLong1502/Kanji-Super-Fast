import { prisma } from "./db.js";
import { LessonError } from "./errors.js";
import { normalizeVideoTitle, removeVideoFile, type ParsedVideoUpload } from "./videoStorage.js";

export async function listVideos(userId: string) {
  const videos = await prisma.video.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" }
  });

  return videos.map(toVideoView);
}

export async function findOwnedVideo(userId: string, id: string) {
  const video = await prisma.video.findFirst({ where: { id, userId } });
  return video ? toVideoView(video) : null;
}

export async function createVideo(userId: string, upload: ParsedVideoUpload) {
  try {
    const video = await prisma.video.create({
      data: {
        userId,
        title: upload.title,
        originalFilename: upload.originalFilename,
        mimeType: upload.mimeType,
        byteSize: upload.byteSize,
        storedName: upload.storedName
      }
    });
    return toVideoView(video);
  } catch (error) {
    await removeVideoFile(userId, upload.storedName).catch(() => undefined);
    throw error;
  }
}

export async function renameVideo(userId: string, id: string, title: string) {
  const video = await prisma.video.findFirst({ where: { id, userId } });
  if (!video) {
    throw new LessonError("Không tìm thấy video.", 404);
  }

  await prisma.video.update({
    where: { id: video.id },
    data: { title: normalizeVideoTitle(title) }
  });
}

export async function deleteVideo(userId: string, id: string) {
  const video = await prisma.video.findFirst({ where: { id, userId } });
  if (!video) {
    throw new LessonError("Không tìm thấy video.", 404);
  }

  await prisma.video.delete({ where: { id: video.id } });
  await removeVideoFile(userId, video.storedName);
}

function toVideoView(video: {
  id: string;
  title: string;
  originalFilename: string;
  mimeType: string;
  byteSize: bigint;
  storedName: string;
  createdAt: Date;
}) {
  return {
    id: video.id,
    title: video.title,
    originalFilename: video.originalFilename,
    mimeType: video.mimeType,
    byteSize: Number(video.byteSize),
    storedName: video.storedName,
    createdAt: video.createdAt.toISOString()
  };
}
