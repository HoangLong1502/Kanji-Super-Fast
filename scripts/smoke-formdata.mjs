import { readFileSync } from "node:fs";

const file = new Blob([readFileSync("sample.pptx")], {
  type: "application/vnd.openxmlformats-officedocument.presentationml.presentation"
});

const body = new FormData();
body.append("pptx", file, "sample.pptx");
body.append("includeNotes", "false");

const res = await fetch("http://localhost:3456/api/extract", {
  method: "POST",
  body
});

console.log("status", res.status);
console.log(await res.text());
