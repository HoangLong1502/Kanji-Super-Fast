import AdmZip from "adm-zip";
import { writeFileSync } from "node:fs";

const lines = [
  "Bài 11",
  "JLPT N5",
  "時 (THỜI)",
  "音: ジ",
  "訓: とき",
  "1. 時間 (じかん): thời gian",
  "2. 時々 (ときどき): thỉnh thoảng",
  "勉強する (べんきょうする): học tập"
];
const paragraphs = lines.map((line) => `<a:p><a:r><a:t>${line}</a:t></a:r></a:p>`).join("");
const xml = `<?xml version="1.0" encoding="UTF-8"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody>${paragraphs}</p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;
const zip = new AdmZip();
zip.addFile("ppt/slides/slide1.xml", Buffer.from(xml));
writeFileSync("data/bai-11.pptx", zip.toBuffer());
