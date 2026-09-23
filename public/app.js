const form = document.querySelector("#upload-form");
const input = document.querySelector("#pptx-input");
const dropzone = document.querySelector("#dropzone");
const fileNameEl = document.querySelector("#file-name");
const includeNotesEl = document.querySelector("#include-notes");
const submitBtn = document.querySelector("#submit-btn");
const statusEl = document.querySelector("#status");
const resultsEl = document.querySelector("#results");
const summaryEl = document.querySelector("#summary");
const vocabListEl = document.querySelector("#vocab-list");
const kanjiListEl = document.querySelector("#kanji-list");
const detailEl = document.querySelector("#detail");
const detailTitleEl = document.querySelector("#detail-title");
const detailMetaEl = document.querySelector("#detail-meta");
const detailSourcesEl = document.querySelector("#detail-sources");

let currentResult = null;

input.addEventListener("change", () => {
  fileNameEl.textContent = input.files?.[0]?.name ?? "Chưa chọn file";
});

["dragenter", "dragover"].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.add("is-dragging");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.remove("is-dragging");
  });
});

dropzone.addEventListener("drop", (event) => {
  const file = event.dataTransfer?.files?.[0];
  if (!file) {
    return;
  }

  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
  fileNameEl.textContent = file.name;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const file = input.files?.[0];
  if (!file) {
    setStatus("Hãy chọn một file .pptx.", true);
    return;
  }

  const body = new FormData();
  body.append("pptx", file);
  body.append("includeNotes", includeNotesEl.checked ? "true" : "false");

  submitBtn.disabled = true;
  setStatus("Đang extract text từ PPT…");
  resultsEl.classList.add("hidden");
  detailEl.classList.add("hidden");

  try {
    const response = await fetch("/api/extract", {
      method: "POST",
      body
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error ?? "Extract thất bại.");
    }

    currentResult = payload;
    renderResults(payload);
    setStatus(
      `Xong: ${payload.vocabularyCount} vocabulary · ${payload.kanjiCount} kanji · ${payload.slideCount} slide text blocks.`
    );
  } catch (error) {
    currentResult = null;
    setStatus(error instanceof Error ? error.message : "Extract thất bại.", true);
  } finally {
    submitBtn.disabled = false;
  }
});

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("is-error", isError);
}

function renderResults(result) {
  summaryEl.innerHTML = `
    <span><strong>${escapeHtml(result.fileName)}</strong></span>
    <span>${result.vocabularyCount} vocabulary</span>
    <span>${result.kanjiCount} kanji</span>
    <span>${result.slideCount} text blocks</span>
  `;

  vocabListEl.innerHTML = "";
  kanjiListEl.innerHTML = "";

  for (const entry of result.vocabulary) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.innerHTML = `
      <span class="word">${escapeHtml(entry.word)}</span>
      <span class="meta">${escapeHtml(formatVocabMeta(entry))}</span>
    `;
    button.addEventListener("click", () => showDetail("vocabulary", entry));
    item.append(button);
    vocabListEl.append(item);
  }

  for (const entry of result.kanji) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.innerHTML = `
      <span class="word">${escapeHtml(entry.kanji)}</span>
      <span class="meta">${entry.sourceLocations.length} location(s)</span>
    `;
    button.addEventListener("click", () => showDetail("kanji", entry));
    item.append(button);
    kanjiListEl.append(item);
  }

  resultsEl.classList.remove("hidden");
}

function showDetail(kind, entry) {
  const label = kind === "vocabulary" ? entry.word : entry.kanji;
  detailTitleEl.textContent = label;
  detailMetaEl.textContent =
    kind === "vocabulary"
      ? formatVocabMeta(entry)
      : `${entry.sourceLocations.length} source location(s)`;

  detailSourcesEl.innerHTML = "";
  for (const source of entry.sourceLocations) {
    const item = document.createElement("li");
    item.innerHTML = `
      <strong>Slide ${source.slideNumber}</strong>
      (${escapeHtml(source.sourceType)})
      <br />
      <code>${escapeHtml(source.rawText)}</code>
    `;
    detailSourcesEl.append(item);
  }

  for (const button of document.querySelectorAll(".list button")) {
    button.classList.toggle("is-active", button.querySelector(".word")?.textContent === label);
  }

  detailEl.classList.remove("hidden");
  detailEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function formatVocabMeta(entry) {
  return [entry.reading, entry.romaji, entry.meaning].filter(Boolean).join(" · ") || "Không có metadata dictionary";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
