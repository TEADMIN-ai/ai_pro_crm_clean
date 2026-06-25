import type { QsImportParser, QsParseResult } from "./types";

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === "\"" && next === "\"") {
      current += "\"";
      index += 1;
      continue;
    }

    if (char === "\"") {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

export const csvImportParser: QsImportParser = {
  async parse(buffer: Buffer): Promise<QsParseResult> {
    const lines = buffer
      .toString("utf8")
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0);

    const columns = lines[0] ? parseCsvLine(lines[0]) : [];
    const rows = lines.slice(1).map((line, index) => {
      const values = parseCsvLine(line);
      const raw = Object.fromEntries(columns.map((column, columnIndex) => [column, values[columnIndex] ?? ""]));
      return {
        rowNumber: index + 2,
        raw,
      };
    });

    return {
      fileType: "csv",
      columns,
      rows,
    };
  },
};
