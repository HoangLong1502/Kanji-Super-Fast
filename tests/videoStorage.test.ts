import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseByteRange, videoExtension, videoFilePath } from "../lib/videoStorage.js";

describe("video uploads", () => {
  it("reads a single byte range", () => {
    assert.deepEqual(parseByteRange("bytes=0-1", 10), { start: 0, end: 1 });
    assert.deepEqual(parseByteRange("bytes=0-", 10), { start: 0, end: 9 });
    assert.deepEqual(parseByteRange("bytes=-4", 10), { start: 6, end: 9 });
    assert.deepEqual(parseByteRange("bytes=2-100", 10), { start: 2, end: 9 });
    assert.equal(parseByteRange("bytes=20-30", 10), null);
    assert.equal(parseByteRange("bytes=0-1,2-3", 10), null);
  });

  it("accepts video extensions and rejects other names", () => {
    assert.equal(videoExtension("Bai 3.MP4"), "mp4");
    assert.equal(videoExtension("C:\\clips\\lesson.webm"), "webm");
    assert.equal(videoExtension("clip.exe"), null);
    assert.equal(videoExtension("video.mp4.exe"), null);
    assert.throws(() => videoFilePath("../user", "clip.mp4"));
    assert.throws(() => videoFilePath("user-1", "../clip.mp4"));
    assert.match(videoFilePath("user-1", "clip.mp4"), /user-1[\\/]clip\.mp4$/);
  });
});
