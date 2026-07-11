import fs from "node:fs";

const filePath = "tmp/generate-hygiene-agreement-v3.mjs";
let content = fs.readFileSync(filePath, "utf8");

const tableFn = `function htmlTable(rows, widths, opts = {}) {
  const header = opts.header ?? false;
  const tableWidth = widths.reduce((sum, value) => sum + value, 0);
  return \`<table class="mini" style="table-layout:fixed;width:100%;max-width:\${tableWidth / 56.7}mm;">
    <colgroup>\${widths.map((width) => \`<col style="width:\${width / 56.7}mm;">\`).join("")}</colgroup>
    <tbody>
      \${rows.map((row, index) => {
        const isHeader = header && index === 0;
        return \`<tr>\${row.map((cell) => {
          const text = typeof cell === "string" ? cell : cell.text;
          const fill = typeof cell === "object" && cell.fill ? cell.fill : isHeader ? "${color.navy}" : "transparent";
          const cellColor = typeof cell === "object" && cell.color ? cell.color : isHeader ? "${color.white}" : "${color.text}";
          const align = typeof cell === "object" && cell.align ? cell.align : "left";
          const weight = isHeader ? 700 : (typeof cell === "object" && cell.bold === false ? 400 : 700);
          return \`<td style="background:\${fill};color:\${cellColor};text-align:\${align};font-weight:\${weight};">\${esc(text)}</td>\`;
        }).join("")}</tr>\`;
      }).join("")}
    </tbody>
  </table>\`;
}
`;

if (!content.includes("function htmlTable")) {
  content = content.replace("function tocField() {", `${tableFn}\nfunction tocField() {`);
}

content = content.replace("function buildPdfHtml(logoDataUrl) {", "function buildPdfHtml(logoDataUrl, diagramDataUrl) {");
content = content.replace(/\$\{table\(/g, "${htmlTable(");

fs.writeFileSync(filePath, content, "utf8");
