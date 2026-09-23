import AdmZip from "adm-zip";
import { writeFileSync, readFileSync } from "node:fs";

const slideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:sp>
        <p:txBody>
          <a:bodyPr/>
          <a:p><a:r><a:t>学生</a:t></a:r></a:p>
          <a:p><a:r><a:t>学校</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`;

const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
</Types>`;

const zip = new AdmZip();
zip.addFile("[Content_Types].xml", Buffer.from(contentTypes, "utf8"));
zip.addFile("ppt/slides/slide1.xml", Buffer.from(slideXml, "utf8"));
writeFileSync("sample.pptx", zip.toBuffer());

const file = readFileSync("sample.pptx");
const boundary = "----SuperKanjiBoundary";
const body = Buffer.concat([
  Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="pptx"; filename="sample.pptx"\r\nContent-Type: application/vnd.openxmlformats-officedocument.presentationml.presentation\r\n\r\n`
  ),
  file,
  Buffer.from(
    `\r\n--${boundary}\r\nContent-Disposition: form-data; name="includeNotes"\r\n\r\nfalse\r\n--${boundary}--\r\n`
  )
]);

const res = await fetch("http://localhost:3456/api/extract", {
  method: "POST",
  headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
  body
});

const json = await res.json();
console.log(
  res.status,
  JSON.stringify(
    {
      vocabularyCount: json.vocabularyCount,
      kanjiCount: json.kanjiCount,
      words: json.vocabulary?.map((v) => v.word),
      kanji: json.kanji?.map((k) => k.kanji),
      error: json.error
    },
    null,
    2
  )
);
