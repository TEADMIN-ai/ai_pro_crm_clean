import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { chromium } from "playwright";
import { PDFDocument, PDFName, PDFString } from "pdf-lib";

const root = process.cwd();
const outDir = path.join(root, "documents", "Commercial", "Roar Cars", "06 - Professional Technical Services Invoice");

const invoice = {
  fileBase: "06 - Professional Technical Services Invoice",
  title: "Professional Technical Services Invoice",
  code: "TE-RC-INV-001",
  invoiceNumber: "TE-INV-2026-001",
  invoiceDate: "8 July 2026",
  dueDate: "Payment Due Upon Receipt",
  currency: "South African Rand (ZAR)",
  client: "Roar Cars SA",
  attention: "Mr Banks",
  total: 1850,
  reference: "TE-INV-2026-001",
  supportingSchedule: "../04 - Invoice Supporting Schedule.pdf",
};

const company = {
  name: "Torque Empire (Pty) Ltd",
  division: "Professional Technical Services",
  email: "admin@torqueempire.net",
  website: "www.torqueempire.net",
  bank: {
    accountName: "Torque Empire (Pty) Ltd",
    bankName: "Capitec Bank",
    accountNumber: "1052177301",
    branchCode: "470010",
  },
};

const brand = {
  navy: "#07111f",
  blue: "#0b2f57",
  red: "#c1121f",
  grey: "#64748b",
  line: "#d9e2ec",
  pale: "#f4f6f8",
  white: "#ffffff",
  text: "#1f2937",
};

const lineItems = [
  ["Professional technical investigation and assessment of the existing Roar Cars website environment", 450],
  ["Hosting, VPS, domain and DNS technical assessment and recommendations", 350],
  ["Business email investigation and configuration guidance", 300],
  ["Technical consultation and liaison with third-party developers", 400],
  ["Infrastructure recovery planning and implementation recommendations", 350],
];

const exclusions = [
  "TEOS Platform Development",
  "AI Pro CRM Development",
  "Workspace Registry",
  "Capability Registry",
  "Internal Research & Development",
  "Future Software Development",
  "Website Development",
];

const prominentNote =
  "This invoice relates exclusively to professional technical consulting services provided in support of the Roar Cars website infrastructure, hosting environment, domain, DNS, business email and technical recovery planning.\n\nIt does not include the development of the TEOS platform, AI Pro CRM, or any proprietary software developed by Torque Empire (Pty) Ltd.";

function money(amount) {
  return `R${Number(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function table(headers, rows, className = "") {
  return `<table class="${className}"><thead><tr>${headers.map((header) => `<th>${esc(header)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

function mdTable(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell).replace(/\|/g, "/")).join(" | ")} |`),
  ].join("\n");
}

function bullets(items) {
  return `<ul>${items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`;
}

function mdBullets(items) {
  return items.map((item) => `- ${item}`).join("\n");
}

function buildHtml() {
  const subtotal = lineItems.reduce((sum, [, amount]) => sum + amount, 0);
  const rows = lineItems.map(([description, amount]) => [description, "1", money(amount), money(amount)]);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(invoice.fileBase)}</title>
  <style>
    :root { --navy:${brand.navy}; --blue:${brand.blue}; --red:${brand.red}; --grey:${brand.grey}; --line:${brand.line}; --pale:${brand.pale}; --white:${brand.white}; --text:${brand.text}; }
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #dfe5ec; color: var(--text); font-family: Arial, Helvetica, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 14mm 14mm 17mm; background: var(--white); position: relative; overflow: hidden; page-break-after: always; }
    .page:last-child { page-break-after: auto; }
    .topbar { display: grid; grid-template-columns: 1fr auto; gap: 8mm; border-bottom: 1.4mm solid var(--blue); padding-bottom: 4mm; margin-bottom: 5mm; }
    .wordmark { color: var(--blue); text-transform: uppercase; letter-spacing: 1.2px; font-size: 8.5pt; font-weight: 800; }
    h1, h2, h3, p { margin: 0; letter-spacing: 0; }
    h1 { color: var(--navy); font-size: 28pt; line-height: 1.05; margin-top: 2mm; }
    h2 { color: var(--blue); font-size: 12.8pt; margin: 5mm 0 2.6mm; border-left: 1.3mm solid var(--blue); padding-left: 3mm; line-height: 1.16; }
    p, li { font-size: 9.2pt; line-height: 1.45; margin: 0 0 2.4mm; }
    ul { margin: 0 0 3mm; padding-left: 5mm; }
    .docbox { min-width: 58mm; border: 1px solid var(--line); background: var(--pale); border-radius: 2.5mm; padding: 3.4mm; font-size: 8pt; line-height: 1.42; color: #344253; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; margin-bottom: 5mm; }
    .metric { border: 1px solid var(--line); background: var(--pale); border-radius: 2.5mm; padding: 3.2mm; min-height: 21mm; }
    .metric strong { display: block; color: var(--grey); font-size: 7.2pt; text-transform: uppercase; letter-spacing: .8px; margin-bottom: 1.2mm; }
    .metric span { color: var(--navy); font-size: 10pt; font-weight: 800; line-height: 1.25; }
    table { width: 100%; border-collapse: collapse; font-size: 8pt; margin: 2mm 0 4mm; table-layout: fixed; }
    th { background: var(--navy); color: var(--white); text-align: left; padding: 2.3mm; border: 1px solid var(--navy); text-transform: uppercase; letter-spacing: .5px; font-size: 7.1pt; }
    td { border: 1px solid var(--line); padding: 2.2mm; vertical-align: top; line-height: 1.3; word-wrap: break-word; }
    .items th:nth-child(1), .items td:nth-child(1) { width: 58%; }
    .items th:nth-child(2), .items td:nth-child(2) { width: 10%; text-align: center; }
    .items th:nth-child(3), .items td:nth-child(3), .items th:nth-child(4), .items td:nth-child(4) { width: 16%; text-align: right; }
    tr:nth-child(even) td { background: #fafcff; }
    .total-grid { display: grid; grid-template-columns: 1fr 70mm; gap: 6mm; align-items: start; }
    .total-box { border: 1px solid var(--line); border-left: 1.7mm solid var(--red); background: #fffafa; border-radius: 2.5mm; padding: 4mm; }
    .total-row { display: grid; grid-template-columns: 1fr auto; gap: 4mm; font-size: 9pt; padding: 1.4mm 0; border-bottom: 1px solid var(--line); }
    .total-row:last-child { border-bottom: 0; font-size: 14pt; font-weight: 900; color: var(--navy); }
    .note { background: #fff7f7; border: 1px solid #f1c9cd; border-left: 1.5mm solid var(--red); border-radius: 2mm; padding: 3.5mm; margin: 4mm 0; white-space: pre-line; font-weight: 700; }
    .scope { border: 1px solid var(--line); background: var(--pale); border-radius: 2.5mm; padding: 3.5mm; }
    .footer { position: absolute; left: 14mm; right: 14mm; bottom: 8.5mm; border-top: 1px solid var(--line); padding-top: 2.4mm; display: flex; justify-content: space-between; color: #64748b; font-size: 7.5pt; }
  </style>
</head>
<body>
  <section class="page">
    <div class="topbar">
      <div>
        <div class="wordmark">${esc(company.name)} | ${esc(company.division)}</div>
        <h1>${esc(invoice.title)}</h1>
      </div>
      <div class="docbox"><strong>Document Control</strong><br>Invoice: ${esc(invoice.invoiceNumber)}<br>Code: ${esc(invoice.code)}<br>Date: ${esc(invoice.invoiceDate)}<br>Classification: Client Issue</div>
    </div>

    <div class="summary">
      <div class="metric"><strong>Client</strong><span>${esc(invoice.client)}</span></div>
      <div class="metric"><strong>Attention</strong><span>${esc(invoice.attention)}</span></div>
      <div class="metric"><strong>Due Date</strong><span>${esc(invoice.dueDate)}</span></div>
      <div class="metric"><strong>Total Due</strong><span>${money(invoice.total)}</span></div>
    </div>

    <h2>Invoice Details</h2>
    ${table(["Field", "Value"], [
      ["Invoice Number", invoice.invoiceNumber],
      ["Invoice Date", invoice.invoiceDate],
      ["Currency", invoice.currency],
      ["Payment Reference", invoice.reference],
      ["Supporting Schedule", "04 - Invoice Supporting Schedule"],
    ])}

    <h2>Description of Services</h2>
    ${table(["Description", "Qty", "Rate", "Amount"], rows, "items")}

    <div class="total-grid">
      <div>
        <h2>Important Note</h2>
        <div class="note">${esc(prominentNote)}</div>
        <div class="scope">
          <p><strong>Excluded from this invoice:</strong></p>
          ${bullets(exclusions)}
          <p>Those excluded items remain the intellectual property of ${esc(company.name)}.</p>
        </div>
      </div>
      <div>
        <h2>Invoice Summary</h2>
        <div class="total-box">
          <div class="total-row"><span>Subtotal</span><span>${money(subtotal)}</span></div>
          <div class="total-row"><span>VAT</span><span>Not Applicable</span></div>
          <div class="total-row"><span>Total Due</span><span>${money(invoice.total)}</span></div>
        </div>
        <p><strong>VAT:</strong> Not Applicable. ${esc(company.name)} is currently not VAT Registered.</p>
      </div>
    </div>

    <h2>Payment Details</h2>
    ${table(["Account Name", "Bank", "Account Number", "Branch Code"], [[company.bank.accountName, company.bank.bankName, company.bank.accountNumber, company.bank.branchCode]])}
    <p>Please use invoice number ${esc(invoice.invoiceNumber)} as the payment reference.</p>

    <div class="footer"><span>${esc(company.name)} | ${esc(invoice.invoiceNumber)}</span><span>${esc(company.email)} | ${esc(company.website)}</span></div>
  </section>
</body>
</html>`;
}

function buildMarkdown() {
  const subtotal = lineItems.reduce((sum, [, amount]) => sum + amount, 0);
  return `# ${invoice.title}

**Supplier:** ${company.name}
**Client:** ${invoice.client}
**Attention:** ${invoice.attention}
**Invoice Number:** ${invoice.invoiceNumber}
**Invoice Date:** ${invoice.invoiceDate}
**Due Date:** ${invoice.dueDate}
**Currency:** ${invoice.currency}
**Supporting Schedule:** 04 - Invoice Supporting Schedule

## Important Note

${prominentNote}

## Description of Services

${mdTable(["Description", "Qty", "Rate", "Amount"], lineItems.map(([description, amount]) => [description, "1", money(amount), money(amount)]))}

## Invoice Summary

${mdTable(["Subtotal", "VAT", "Total Due"], [[money(subtotal), "Not Applicable", money(invoice.total)]])}

**VAT:** Not Applicable. ${company.name} is currently not VAT Registered.

## Payment Details

${mdTable(["Account Name", "Bank", "Account Number", "Branch Code"], [[company.bank.accountName, company.bank.bankName, company.bank.accountNumber, company.bank.branchCode]])}

Payment reference: ${invoice.invoiceNumber}

## Excluded From This Invoice

${mdBullets(exclusions)}

Those excluded items remain the intellectual property of ${company.name}.
`;
}

function coreXml() {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(invoice.title)}</dc:title><dc:subject>${esc(invoice.invoiceNumber)}</dc:subject><dc:creator>${esc(company.name)}</dc:creator><cp:lastModifiedBy>${esc(company.name)}</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
}

function appXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Torque Empire Document Builder</Application><TitlesOfParts><vt:vector size="1" baseType="lpstr"><vt:lpstr>${esc(invoice.title)}</vt:lpstr></vt:vector></TitlesOfParts></Properties>`;
}

function contentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="html" ContentType="text/html"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
}

function relsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
}

function documentXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" mc:Ignorable=""><w:body><w:altChunk r:id="rId1"/><w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="850" w:right="800" w:bottom="850" w:left="800" w:header="500" w:footer="500" w:gutter="0"/><w:headerReference w:type="default" r:id="rId2"/><w:footerReference w:type="default" r:id="rId3"/></w:sectPr></w:body></w:document>`;
}

function documentRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/aFChunk" Target="afchunk.html"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>`;
}

function headerXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="0B2F57"/><w:sz w:val="18"/></w:rPr><w:t>${esc(company.name)} - ${esc(invoice.title)}</w:t></w:r></w:p></w:hdr>`;
}

function footerXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:sz w:val="14"/></w:rPr><w:t>${esc(invoice.invoiceNumber)} - Page </w:t></w:r><w:fldSimple w:instr=" PAGE "><w:r><w:t>1</w:t></w:r></w:fldSimple><w:r><w:t> of </w:t></w:r><w:fldSimple w:instr=" NUMPAGES "><w:r><w:t>1</w:t></w:r></w:fldSimple></w:p></w:ftr>`;
}

async function writeDocx(html, outputPath) {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", contentTypesXml());
  zip.folder("_rels").file(".rels", relsXml());
  zip.folder("docProps").file("core.xml", coreXml());
  zip.folder("docProps").file("app.xml", appXml());
  zip.folder("word").file("document.xml", documentXml());
  zip.folder("word").file("styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>`);
  zip.folder("word").file("afchunk.html", html);
  zip.folder("word").file("header1.xml", headerXml());
  zip.folder("word").file("footer1.xml", footerXml());
  zip.folder("word").folder("_rels").file("document.xml.rels", documentRelsXml());
  await fs.writeFile(outputPath, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
}

async function writePdf(html, outputPath) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1900 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "load" });
  await page.pdf({ path: outputPath, format: "A4", printBackground: true, preferCSSPageSize: true, margin: { top: "0", right: "0", bottom: "0", left: "0" } });
  await browser.close();

  const bytes = await fs.readFile(outputPath);
  const pdf = await PDFDocument.load(bytes);
  pdf.setTitle(`${invoice.fileBase} - ${invoice.client}`);
  pdf.setSubject(invoice.invoiceNumber);
  pdf.setAuthor(company.name);
  pdf.setCreator("Torque Empire Invoice Template Builder");
  pdf.setProducer("Torque Empire Invoice Template Builder");
  pdf.setKeywords([invoice.client, company.name, "Professional Technical Services", "Invoice", "Roar Cars"]);
  const info = pdf.getInfoDict();
  info.set(PDFName.of("Company"), PDFString.of(company.name));
  info.set(PDFName.of("InvoiceNumber"), PDFString.of(invoice.invoiceNumber));
  await fs.writeFile(outputPath, await pdf.save());
}

async function main() {
  const subtotal = lineItems.reduce((sum, [, amount]) => sum + amount, 0);
  if (subtotal !== invoice.total) throw new Error(`Invoice total mismatch: ${subtotal} !== ${invoice.total}`);

  await fs.mkdir(outDir, { recursive: true });
  const html = buildHtml();
  const markdown = buildMarkdown();
  const htmlPath = path.join(outDir, `${invoice.fileBase}.html`);
  const mdPath = path.join(outDir, `${invoice.fileBase}.md`);
  const docxPath = path.join(outDir, `${invoice.fileBase}.docx`);
  const pdfPath = path.join(outDir, `${invoice.fileBase}.pdf`);
  await fs.writeFile(htmlPath, html, "utf8");
  await fs.writeFile(mdPath, markdown, "utf8");
  await writeDocx(html, docxPath);
  await writePdf(html, pdfPath);

  const manifest = {
    document: invoice.title,
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    currency: invoice.currency,
    client: invoice.client,
    attention: invoice.attention,
    total: money(invoice.total),
    vatStatus: `VAT: Not Applicable. ${company.name} is currently not VAT Registered.`,
    supportingSchedule: "documents/Commercial/Roar Cars/04 - Invoice Supporting Schedule.pdf",
    bankingDetailsSource: "Existing Torque Empire corporate document templates",
    bank: company.bank,
    exclusions,
    outputs: [
      `${invoice.fileBase}.docx`,
      `${invoice.fileBase}.pdf`,
      `${invoice.fileBase}.md`,
      `${invoice.fileBase}.html`,
      "manifest.json",
      "README.md",
      "CHANGELOG.md",
    ],
  };
  await fs.writeFile(path.join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await fs.writeFile(
    path.join(outDir, "README.md"),
    `# ${invoice.title}

Official Torque Empire invoice for Roar Cars SA professional technical consulting services.

- Invoice number: ${invoice.invoiceNumber}
- Invoice date: ${invoice.invoiceDate}
- Due date: ${invoice.dueDate}
- Total due: ${money(invoice.total)}
- Supporting schedule: documents/Commercial/Roar Cars/04 - Invoice Supporting Schedule.pdf

This template is structured as the standard Torque Empire invoice format for future clients.
`,
    "utf8",
  );
  await fs.writeFile(
    path.join(outDir, "CHANGELOG.md"),
    `# Changelog

## 1.0.0 - ${invoice.invoiceDate}

- Created Professional Technical Services Invoice for Roar Cars SA.
- Generated DOCX, PDF, Markdown and HTML versions.
- Added official Torque Empire banking details from existing corporate templates.
- Added VAT wording consistent with current Torque Empire tax status.
- Added explicit exclusions for TEOS, AI Pro CRM, registries, internal R&D, future software development and website development.
`,
    "utf8",
  );

  console.log(`Generated invoice pack at ${outDir}`);
  for (const file of manifest.outputs) console.log(file);
}

await main();
