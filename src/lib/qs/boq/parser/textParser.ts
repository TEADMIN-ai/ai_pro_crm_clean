import type { QsBoqParsedDocument, QsBoqParserInput } from "./types";

export function parseTextBoq(input: QsBoqParserInput, fileType: "csv" | "txt"): QsBoqParsedDocument {
  return {
    fileType,
    parserUsed: fileType === "csv" ? "csv-text-parser" : "plain-text-parser",
    extractionSource: "text",
    ocrUsed: false,
    text: input.buffer.toString("utf8").replace(/\r/g, "").trim(),
  };
}
