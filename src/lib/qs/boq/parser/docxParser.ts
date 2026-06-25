import JSZip from "jszip";
import type { QsBoqParsedDocument, QsBoqParserInput } from "./types";

function xmlText(value: string): string {
  return value
    .replace(/<w:p[\s\S]*?>/g, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .replace(/\s+\n/g, "\n")
    .trim();
}

export async function parseDocxBoq(input: QsBoqParserInput): Promise<QsBoqParsedDocument> {
  const zip = await JSZip.loadAsync(input.buffer);
  const documentXml = await zip.file("word/document.xml")?.async("string");

  return {
    fileType: "docx",
    parserUsed: "docx-xml-parser",
    extractionSource: "docx",
    ocrUsed: false,
    text: documentXml ? xmlText(documentXml) : "",
  };
}
