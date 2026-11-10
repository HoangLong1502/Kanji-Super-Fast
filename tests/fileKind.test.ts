import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectUploadKind, extensionForKind, isImageKind } from "../src/fileKind.js";

describe("upload kind detection", () => {
  it("detects common image magic bytes", () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const gif = Buffer.from("GIF89a....", "ascii");
    const webp = Buffer.concat([
      Buffer.from("RIFF", "ascii"),
      Buffer.from([0x10, 0x00, 0x00, 0x00]),
      Buffer.from("WEBP", "ascii")
    ]);

    assert.equal(detectUploadKind(jpeg), "jpeg");
    assert.equal(detectUploadKind(png), "png");
    assert.equal(detectUploadKind(gif), "gif");
    assert.equal(detectUploadKind(webp), "webp");
    assert.equal(isImageKind("png"), true);
    assert.equal(extensionForKind("jpeg"), "jpg");
  });
});
