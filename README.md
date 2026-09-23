# SuperKanji

SuperKanji extracts Japanese lesson data from uploaded PowerPoint files.

## Core Rule

PowerPoint is the only source of truth.

The system must only save Kanji and vocabulary that can be traced back to text actually extracted from the uploaded `.pptx` file. External dictionaries and APIs may enrich metadata for an already extracted word, but they must not add related words, example words, synonyms, or extra Kanji.

## Pipeline

```text
PPTX
-> Extract raw slide text
-> Normalize text
-> Identify Japanese text
-> Identify Kanji present in raw text
-> Identify vocabulary present in raw text
-> Dictionary lookup for metadata only
-> Final validation
-> Save
```

## Extraction Defaults

Included by default:

- Text boxes
- Shape text
- Paragraph text
- Table cell text
- Grouped shape text when present in slide text XML
- Slide title text

Excluded by default:

- File name
- PowerPoint metadata
- Author
- Theme
- Font name
- Alt text
- Comments
- Speaker notes
- Image OCR
- Internet content
- AI-generated vocabulary

Speaker notes can only be included by explicitly passing `includeNotes: true`.

Image OCR is not implemented and must remain opt-in if added later.

## Traceability

Each vocabulary entry stores all source locations:

```json
{
  "word": "学生",
  "reading": "がくせい",
  "romaji": "gakusei",
  "meaning": "student",
  "sourceLocations": [
    {
      "slideNumber": 4,
      "rawText": "学生",
      "sourceText": "学生",
      "sourceType": "slide_text"
    }
  ]
}
```

If validation cannot prove that every vocabulary word and Kanji came from extracted PPT text, the lesson is not saved.

## Usage

Install dependencies:

```bash
npm install
```

Extract a lesson JSON file:

```bash
npm run dev -- ./lesson.pptx ./lesson.json
```

Run tests:

```bash
npm test
```
