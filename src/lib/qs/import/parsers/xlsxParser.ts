import JSZip from "jszip";
import type { QsImportParser, QsParseResult } from "./types";

function stripXml(value: string) {
  return value.replace(/<[^>]+>/g, "").trim();
}

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'");
}

function columnIndex(cellRef: string): number {
  const letters = cellRef.replace(/[^A-Z]/gi, "").toUpperCase();
  return letters.split("").reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function parseSharedStrings(xml: string): string[] {
  return [...xml.matchAll(/<si[\s\S]*?<\/si>/g)].map((match) => decodeXml(stripXml(match[0])));
}

function parseCellValue(cellXml: string, sharedStrings: string[]): string {
  const typeMatch = cellXml.match(/\st="([^"]+)"/);
  const valueMatch = cellXml.match(/<v>([\s\S]*?)<\/v>/);
  const inlineMatch = cellXml.match(/<is>([\s\S]*?)<\/is>/);

  if (typeMatch?.[1] === "s" && valueMatch?.[1]) {
    return sharedStrings[Number(valueMatch[1])] ?? "";
  }

  if (inlineMatch?.[1]) {
    return decodeXml(stripXml(inlineMatch[1]));
  }

  return decodeXml(valueMatch?.[1] ?? "");
}

export const xlsxImportParser: QsImportParser = {
  async parse(buffer: Buffer): Promise<QsParseResult> {
    const zip = await JSZip.loadAsync(buffer);
    const sheetXml = await zip.file("xl/worksheets/sheet1.xml")?.async("string");
    if (!sheetXml) {
      throw new Error("XLSX import parser could not find xl/worksheets/sheet1.xml");
    }

    const sharedStringsXml = await zip.file("xl/sharedStrings.xml")?.async("string");
    const sharedStrings = sharedStringsXml ? parseSharedStrings(sharedStringsXml) : [];
    const rowMatches = [...sheetXml.matchAll(/<row[\s\S]*?<\/row>/g)];
    const matrix = rowMatches.map((rowMatch) => {
      const cells: string[] = [];
      for (const cellMatch of rowMatch[0].matchAll(/<c\s+([^>]*)>[\s\S]*?<\/c>/g)) {
        const ref = cellMatch[1].match(/\br="([^"]+)"/)?.[1] ?? "";
        cells[columnIndex(ref)] = parseCellValue(cellMatch[0], sharedStrings);
      }
      return cells.map((cell) => cell ?? "");
    });

    const columns = matrix[0] ?? [];
    const rows = matrix.slice(1).map((values, index) => ({
      rowNumber: index + 2,
      raw: Object.fromEntries(columns.map((column, columnIndexValue) => [column, values[columnIndexValue] ?? ""])),
    }));

    return {
      fileType: "xlsx",
      columns,
      rows,
    };
  },
};
