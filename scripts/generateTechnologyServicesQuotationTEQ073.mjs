import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { chromium } from "playwright";
import { PDFDocument, PDFName, PDFString } from "pdf-lib";

const root = process.cwd();
const packRoot = path.join(root, "output", "doc", "Technology Services Commercial Pack");
const htmlDir = path.join(packRoot, "HTML");
const jsonDir = path.join(packRoot, "JSON");
const pdfDir = path.join(packRoot, "PDF");
const docxDir = path.join(packRoot, "DOCX");

const brand = {
  company: "Torque Empire (Pty) Ltd",
  division: "Technology Services",
  preparedBy: "Torque Empire Technology Services",
  approvedBy: "Torque Empire Executive Office",
  email: "admin@torqueempire.net",
  navy: "#07111f",
  blue: "#0b2f57",
  red: "#c1121f",
  grey: "#64748b",
  line: "#d9e2ec",
  pale: "#f4f6f8",
  white: "#ffffff",
  text: "#1f2937",
};

const quotation = {
  quotationNumber: "TE-Q-2026-073",
  title: "Technology Recovery & Email Infrastructure Modernisation",
  fileBase: "TE-Q-2026-073 - Technology Recovery & Email Infrastructure Modernisation",
  clientName: "Roar Cars SA",
  attention: "Mr Lawrence Banks",
  classification: "Technology Services",
  issueDate: "6 July 2026",
  validUntil: "20 July 2026",
  investment: "R5,000.00",
  paymentTerms: [
    "Payment is due on acceptance unless otherwise agreed in writing.",
    "Work commences after written acceptance and payment confirmation.",
    "Proof of payment must reference the quotation number.",
  ],
  standardTerms: [
    "This quotation covers only the scope expressly listed in the document.",
    "Additional services, additional accounts, domain changes, hosting migrations or third-party platform charges will be quoted separately unless included in writing.",
    "Client access credentials must be supplied securely. Torque Empire will not request or store unnecessary passwords outside the delivery process.",
    "Delivery timelines depend on client access, provider availability and successful authentication checks.",
  ],
  serviceCategories: [
    "Website Development",
    "Email Infrastructure",
    "Hosting / VPS",
    "AI Solutions",
    "CRM Development",
    "Software Engineering",
    "Microsoft 365",
    "Google Workspace",
    "Network Services",
  ],
  bank: {
    accountName: "Torque Empire (Pty) Ltd",
    bankName: "Capitec Bank",
    accountNumber: "1052177301",
    branchCode: "470010",
  },
};

const phases = [
  {
    title: "Phase 1 - Technology Assessment",
    items: [
      "Complete email infrastructure audit",
      "DNS health assessment",
      "Domain configuration review",
      "Mail routing analysis",
      "Mail delivery diagnostics",
      "Existing mailbox review",
      "Security assessment",
    ],
  },
  {
    title: "Phase 2 - Infrastructure Recovery",
    items: [
      "Resolve existing email issues",
      "DNS corrections",
      "Mail flow optimisation",
      "Authentication verification",
      "Mailbox architecture improvements",
      "Email security hardening",
    ],
  },
  {
    title: "Phase 3 - Professional Configuration",
    items: [
      "Create professional email accounts",
      "Secure mailbox configuration",
      "Password configuration",
      "Desktop configuration",
      "Mobile configuration",
      "Webmail validation",
    ],
  },
  {
    title: "Phase 4 - Business Continuity",
    items: [
      "End-to-end testing",
      "Internal email validation",
      "External email validation",
      "Operational verification",
      "Production sign-off",
    ],
  },
  {
    title: "Phase 5 - Documentation",
    items: [
      "Technical audit report",
      "Configuration report",
      "Administrator guide",
      "User guide",
      "Credential handover",
      "Recommendations report",
    ],
  },
  {
    title: "Phase 6 - Support",
    items: [
      "30 days remote technical support",
      "Minor configuration adjustments",
      "Email assistance",
      "Performance monitoring",
    ],
  },
];

const deliverables = [
  "Email infrastructure audit",
  "Technical recovery report",
  "Professional email environment",
  "Fully configured mailboxes",
  "DNS validation",
  "Mail flow verification",
  "Security validation",
  "Technical documentation",
  "Operational handover",
  "30 days technical support",
];

const commercialNote = [
  "This package is recommended where an organisation has existing email issues or requires a complete technology recovery rather than basic mailbox creation.",
  "Torque Empire assumes responsibility for diagnosing, recovering, optimising and validating the entire email environment to minimise operational disruption.",
];

const htmlEscape = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const bullets = (items) => `<ul>${items.map((item) => `<li>${htmlEscape(item)}</li>`).join("")}</ul>`;

const table = (headers, rows) => `<table><tr>${headers.map((header) => `<th>${htmlEscape(header)}</th>`).join("")}</tr>${rows
  .map((row) => `<tr>${row.map((cell) => `<td>${htmlEscape(cell)}</td>`).join("")}</tr>`)
  .join("")}</table>`;

function coverPage() {
  return `<section class="page cover">
    <div>
      <div class="brandline"><span>${htmlEscape(brand.company)}</span><span>${htmlEscape(brand.division)}</span></div>
      <h1>${htmlEscape(quotation.title)}</h1>
      <div class="subtitle">Reusable Technology Services quotation prepared for ${htmlEscape(quotation.clientName)}.</div>
      <div class="cover-grid">
        <div class="cover-card"><strong>Quotation Number</strong><span>${htmlEscape(quotation.quotationNumber)}</span></div>
        <div class="cover-card"><strong>Prepared For</strong><span>${htmlEscape(quotation.clientName)}</span></div>
        <div class="cover-card"><strong>Attention</strong><span>${htmlEscape(quotation.attention)}</span></div>
        <div class="cover-card"><strong>Investment</strong><span>${htmlEscape(quotation.investment)}</span></div>
      </div>
    </div>
    <div class="footer"><span>${htmlEscape(brand.company)} | ${htmlEscape(quotation.quotationNumber)}</span><span>Page 1</span></div>
  </section>`;
}

function pageShell({ title, subtitle, body, footerLeft, footerRight, docboxTitle, docboxLines }) {
  return `<section class="page">
    <div class="top">
      <div>
        <div class="wordmark">${htmlEscape(brand.company)} | ${htmlEscape(brand.division)}</div>
        <h1>${htmlEscape(title)}</h1>
        <div class="subtitle">${htmlEscape(subtitle)}</div>
      </div>
      <div class="docbox">
        <strong>${htmlEscape(docboxTitle)}</strong><br>
        ${docboxLines.map((line) => htmlEscape(line)).join("<br>")}
      </div>
    </div>
    <div class="content">${body}</div>
    <div class="footer"><span>${htmlEscape(footerLeft || `${brand.company} | ${quotation.quotationNumber}`)}</span><span>${htmlEscape(footerRight || "")}</span></div>
  </section>`;
}

function phaseGridPage(pageNumber, phaseList, heading, subtitle) {
  const cards = phaseList
    .map(
      (phase) => `<div class="stage-card">
        <h3>${htmlEscape(phase.title)}</h3>
        ${bullets(phase.items)}
      </div>`,
    )
    .join("");

  return pageShell({
    title: heading,
    subtitle,
    docboxTitle: "Document Control",
    docboxLines: [
      `Quotation: ${quotation.quotationNumber}`,
      `Date: ${quotation.issueDate}`,
      `Valid Until: ${quotation.validUntil}`,
      `Classification: ${quotation.classification}`,
    ],
    body: `<div class="grid cols-3">${cards}</div>`,
    footerLeft: `${brand.company} | ${quotation.quotationNumber}`,
    footerRight: `Page ${pageNumber}`,
  });
}

function buildHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${htmlEscape(quotation.quotationNumber)} - ${htmlEscape(quotation.title)}</title>
  <style>
    :root {
      --navy: ${brand.navy};
      --blue: ${brand.blue};
      --red: ${brand.red};
      --grey: ${brand.grey};
      --line: ${brand.line};
      --pale: ${brand.pale};
      --white: ${brand.white};
      --text: ${brand.text};
    }
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #e5eaf0; color: var(--text); font-family: Arial, Helvetica, sans-serif; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { width: 210mm; min-height: 297mm; margin: 0 auto; background: #fff; padding: 16mm 15mm 19mm; position: relative; page-break-after: always; overflow: hidden; }
    .page:last-child { page-break-after: auto; }
    .cover { background: var(--navy); color: #fff; display: flex; flex-direction: column; justify-content: space-between; }
    .cover::before { content: ""; position: absolute; left: 0; top: 0; width: 9mm; height: 100%; background: var(--red); }
    .brandline { display: flex; justify-content: space-between; gap: 16px; align-items: start; color: #93a3b7; text-transform: uppercase; letter-spacing: 1.4px; font-size: 9px; font-weight: 800; }
    .cover h1 { color: #fff; font-size: 36px; line-height: 1.06; margin: 38mm 0 0; max-width: 150mm; }
    .cover .subtitle { color: #dbe4ef; font-size: 17px; line-height: 1.35; margin-top: 8px; max-width: 155mm; }
    .cover-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 20mm; max-width: 160mm; }
    .cover-card { border: 1px solid #ffffff24; background: #ffffff0d; border-radius: 7px; padding: 10px; }
    .cover-card strong { display: block; color: #fff; font-size: 10px; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 1px; }
    .cover-card span { color: #dbe4ef; font-size: 12px; }
    .top { display: grid; grid-template-columns: 1fr auto; gap: 18px; align-items: start; border-bottom: 3px solid var(--blue); padding-bottom: 11px; }
    .wordmark { color: var(--blue); text-transform: uppercase; letter-spacing: 1.4px; font-size: 11px; font-weight: 800; }
    h1 { margin: 8px 0 0; color: var(--navy); font-size: 28px; line-height: 1.08; }
    .subtitle { margin-top: 5px; color: var(--grey); font-size: 12px; }
    .docbox { min-width: 215px; border: 1px solid var(--line); background: var(--pale); border-radius: 7px; padding: 9px 10px; font-size: 9.5px; line-height: 1.45; }
    .content { margin-top: 14px; }
    h2 { color: var(--blue); margin: 15px 0 8px; font-size: 14px; border-left: 4px solid var(--blue); padding-left: 8px; }
    h3 { color: var(--navy); margin: 0 0 8px; font-size: 12px; }
    p, li { font-size: 10.8px; line-height: 1.55; margin: 0 0 8px; }
    ul { margin: 0 0 10px; padding-left: 17px; }
    table { width: 100%; border-collapse: collapse; margin: 7px 0 12px; font-size: 10px; }
    th { background: var(--navy); color: #fff; text-align: left; padding: 7px; border: 1px solid var(--navy); }
    td { padding: 7px; border: 1px solid var(--line); vertical-align: top; min-height: 22px; }
    tr:nth-child(even) td { background: #fafcff; }
    .investment { display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: center; margin: 12px 0; padding: 12px; background: var(--pale); border: 1px solid var(--line); border-left: 4px solid var(--red); }
    .investment strong { color: var(--navy); font-size: 12px; }
    .investment span { color: var(--navy); font-size: 21px; font-weight: 800; }
    .signature { margin-top: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .sig-line { border-top: 1px solid #94a3b8; padding-top: 6px; color: var(--grey); font-size: 10px; }
    .footer { position: absolute; left: 15mm; right: 15mm; bottom: 9mm; border-top: 1px solid var(--line); padding-top: 6px; display: flex; justify-content: space-between; color: var(--grey); font-size: 9px; }
    .cover .footer { color: #aebbd0; border-color: #ffffff24; }
    .grid { display: grid; gap: 10px; }
    .cols-3 { grid-template-columns: repeat(3, 1fr); }
    .cols-2 { grid-template-columns: repeat(2, 1fr); }
    .stage-card { border: 1px solid var(--line); border-radius: 7px; padding: 10px; background: #fff; min-height: 56mm; }
    .stage-card ul { margin-bottom: 0; }
    .note { border-left: 4px solid var(--blue); padding: 10px 12px; background: var(--pale); border-radius: 6px; }
    .section-block { margin-bottom: 8px; }
  </style>
</head>
<body>
  ${coverPage()}
  ${pageShell({
    title: "Quotation",
    subtitle: quotation.title,
    docboxTitle: "Document Control",
    docboxLines: [
      `Quotation: ${quotation.quotationNumber}`,
      `Date: ${quotation.issueDate}`,
      `Valid Until: ${quotation.validUntil}`,
      `Prepared By: ${brand.preparedBy}`,
      `Classification: ${quotation.classification}`,
    ],
    body: `
      ${table(["Prepared For", "Attention", "Quotation Number", "Date"], [[quotation.clientName, quotation.attention, quotation.quotationNumber, quotation.issueDate]])}
      <h2>Executive Overview</h2>
      <p>Unlike a standard mailbox setup, this service includes a full technical investigation, remediation, infrastructure optimisation, deployment, testing, documentation and post-implementation support to ensure a secure and reliable business email environment.</p>
      <p>This engagement provides a complete recovery, stabilisation and optimisation of the Roar Cars email infrastructure.</p>
      <div class="investment"><strong>Total Investment</strong><span>${quotation.investment}</span></div>
      <h2>Business Context</h2>
      ${bullets([
        "The service is intended to restore dependable email delivery and operational confidence.",
        "The quotation is structured as a full technology recovery engagement rather than a mailbox-only request.",
        "The agreed service scope covers diagnosis, remediation, professional configuration and validation.",
      ])}
      <h2>Banking Details</h2>
      ${table(["Account Name", "Bank", "Account Number", "Branch Code"], [[quotation.bank.accountName, quotation.bank.bankName, quotation.bank.accountNumber, quotation.bank.branchCode]])}
    `,
    footerLeft: `${brand.company} | ${quotation.quotationNumber}`,
    footerRight: "Page 2",
  })}
  ${phaseGridPage(3, phases.slice(0, 3), "Scope of Work - Phases 1 to 3", "Technology assessment, infrastructure recovery and professional configuration.")}
  ${pageShell({
    title: "Scope of Work - Phases 4 to 6",
    subtitle: "Business continuity, documentation and support.",
    docboxTitle: "Commercial Control",
    docboxLines: [
      `Quotation: ${quotation.quotationNumber}`,
      `Client: ${quotation.clientName}`,
      `Attention: ${quotation.attention}`,
      `Classification: ${quotation.classification}`,
    ],
    body: `
      <div class="grid cols-3">
        ${phases.slice(3).map((phase) => `<div class="stage-card"><h3>${htmlEscape(phase.title)}</h3>${bullets(phase.items)}</div>`).join("")}
      </div>
      <h2>Deliverables</h2>
      ${bullets(deliverables)}
      <h2>Commercial Note</h2>
      <div class="note">${commercialNote.map((item) => `<p>${htmlEscape(item)}</p>`).join("")}</div>
    `,
    footerLeft: `${brand.company} | ${quotation.quotationNumber}`,
    footerRight: "Page 4",
  })}
  ${pageShell({
    title: "Quotation Terms",
    subtitle: `${quotation.quotationNumber} | Reusable Technology Services Terms`,
    docboxTitle: "Commercial Control",
    docboxLines: [
      `Quotation: ${quotation.quotationNumber}`,
      `Client: ${quotation.clientName}`,
      `Classification: ${quotation.classification}`,
    ],
    body: `
      <h2>Payment Terms</h2>
      ${bullets(quotation.paymentTerms)}
      <h2>Standard Terms</h2>
      ${bullets(quotation.standardTerms)}
      <h2>Reusable Service Categories</h2>
      ${table(["Service Category", "Template Readiness"], quotation.serviceCategories.map((category) => [category, "Supported"]))}
    `,
    footerLeft: `${brand.company} | ${quotation.quotationNumber}`,
    footerRight: "Page 5",
  })}
  ${pageShell({
    title: "Acceptance",
    subtitle: quotation.title,
    docboxTitle: "Acceptance Control",
    docboxLines: [
      `Quotation: ${quotation.quotationNumber}`,
      `Investment: ${quotation.investment}`,
      `Valid Until: ${quotation.validUntil}`,
    ],
    body: `
      <h2>Client Acceptance</h2>
      <p>By signing below, the client accepts the quotation scope, investment, payment terms and delivery conditions.</p>
      ${table(["Client", "Authorised Representative", "Accepted Amount"], [[quotation.clientName, quotation.attention, quotation.investment]])}
      <div class="signature">
        <div><div class="sig-line">Client Signature</div></div>
        <div><div class="sig-line">Date</div></div>
      </div>
      <h2>Torque Empire Signature Block</h2>
      <div class="signature">
        <div><div class="sig-line">For ${brand.company}</div></div>
        <div><div class="sig-line">Date</div></div>
      </div>
      <h2>Implementation Start</h2>
      <p>Implementation will be scheduled after acceptance, payment confirmation and secure access handover.</p>
    `,
    footerLeft: `${brand.company} | ${quotation.quotationNumber}`,
    footerRight: "Page 6",
  })}
</body>
</html>`;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function coreXml() {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${htmlEscape(quotation.title)}</dc:title><dc:subject>${htmlEscape(quotation.title)}</dc:subject><dc:creator>${htmlEscape(brand.preparedBy)}</dc:creator><cp:lastModifiedBy>${htmlEscape(brand.preparedBy)}</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
}

function appXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Torque Empire Document Builder</Application><TitlesOfParts><vt:vector size="1" baseType="lpstr"><vt:lpstr>${htmlEscape(quotation.title)}</vt:lpstr></vt:vector></TitlesOfParts></Properties>`;
}

function contentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="html" ContentType="text/html"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
}

function relsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
}

function headerXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="0B2F57"/><w:sz w:val="18"/></w:rPr><w:t>${htmlEscape(brand.company)}</w:t></w:r></w:p><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:color w:val="6B7280"/><w:sz w:val="14"/></w:rPr><w:t>${htmlEscape(brand.division)} - ${htmlEscape(quotation.title)}</w:t></w:r></w:p></w:hdr>`;
}

function footerXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:sz w:val="14"/></w:rPr><w:t>Confidential - Torque Empire internal and controlled distribution only. </w:t></w:r><w:r><w:t>Page </w:t></w:r><w:fldSimple w:instr=" PAGE "><w:r><w:t>1</w:t></w:r></w:fldSimple><w:r><w:t> of </w:t></w:r><w:fldSimple w:instr=" NUMPAGES "><w:r><w:t>1</w:t></w:r></w:fldSimple></w:p></w:ftr>`;
}

function documentXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" mc:Ignorable="w14 wp14"><w:body><w:altChunk r:id="rId1"/><w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="900" w:right="850" w:bottom="900" w:left="850" w:header="500" w:footer="500" w:gutter="0"/><w:headerReference w:type="default" r:id="rId2"/><w:footerReference w:type="default" r:id="rId3"/></w:sectPr></w:body></w:document>`;
}

function documentRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/aFChunk" Target="afchunk.html"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>`;
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
  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  await fs.writeFile(outputPath, buffer);
}

async function writePdf(html, outputPath) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1900 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "load" });
  await page.pdf({
    path: outputPath,
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
  });
  await browser.close();

  const pdfBytes = await fs.readFile(outputPath);
  const doc = await PDFDocument.load(pdfBytes);
  doc.setTitle(`${quotation.quotationNumber} - ${quotation.title}`);
  doc.setSubject(quotation.title);
  doc.setAuthor(brand.preparedBy);
  doc.setKeywords(["Torque Empire", "Roar Cars SA", "Technology Services", "Quotation"]);
  doc.setCreator(brand.preparedBy);
  doc.setProducer(brand.preparedBy);
  const info = doc.getInfoDict();
  info.set(PDFName.of("Company"), PDFString.of(brand.company));
  const finalBytes = await doc.save();
  await fs.writeFile(outputPath, finalBytes);
}

async function writeJson(outputPath) {
  const payload = {
    brand,
    variables: {
      issueDate: quotation.issueDate,
      validUntil: quotation.validUntil,
      clientName: quotation.clientName,
      attention: quotation.attention,
      preparedBy: brand.preparedBy,
      bank: quotation.bank,
      paymentTerms: quotation.paymentTerms,
      standardTerms: quotation.standardTerms,
    },
    quotation: {
      id: "technology-recovery-email-infrastructure-modernisation",
      quotationNumber: quotation.quotationNumber,
      fileBase: quotation.fileBase,
      title: "Quotation",
      subtitle: quotation.title,
      investment: quotation.investment,
      overview:
        "A complete recovery, stabilisation and optimisation of the Roar Cars email infrastructure with investigation, remediation, deployment, testing, documentation and support.",
      groupedScope: phases.map((phase) => ({
        title: phase.title,
        items: phase.items,
      })),
      deliverables,
      commercialNote,
      serviceCategories: quotation.serviceCategories,
    },
  };
  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function main() {
  await Promise.all([ensureDir(htmlDir), ensureDir(jsonDir), ensureDir(pdfDir), ensureDir(docxDir)]);
  const html = buildHtml();
  const htmlPath = path.join(htmlDir, `${quotation.fileBase}.html`);
  const jsonPath = path.join(jsonDir, `${quotation.fileBase}.json`);
  const pdfPath = path.join(pdfDir, `${quotation.fileBase}.pdf`);
  const docxPath = path.join(docxDir, `${quotation.fileBase}.docx`);

  await fs.writeFile(htmlPath, html, "utf8");
  await writeJson(jsonPath);
  await writeDocx(html, docxPath);
  await writePdf(html, pdfPath);

  const readme = `# Technology Services Commercial Pack

Generated ${new Date().toISOString()}.

Documents:
- TE-Q-2026-071: Professional Email Account Creation & Configuration
- TE-Q-2026-072: Roar Cars Email Infrastructure Audit & Configuration
- TE-Q-2026-073: Technology Recovery & Email Infrastructure Modernisation
`;
  await fs.writeFile(path.join(packRoot, "README.md"), readme, "utf8");

  console.log(`Generated quotation outputs for ${quotation.quotationNumber}`);
  console.log(`HTML: ${htmlPath}`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`DOCX: ${docxPath}`);
  console.log(`PDF: ${pdfPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
