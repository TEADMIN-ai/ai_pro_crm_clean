import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { PDFDocument, PDFName, PDFString } from "pdf-lib";

const root = process.cwd();
const distDir = path.join(root, "dist");
const releaseDir = path.join(distDir, "Roar Cars SA - Board Submission");
const archiveDir = path.join(releaseDir, "Archive");

const currentStrategyPdf = path.join(distDir, "Torque Empire - Roar Cars SA Technology Transformation Strategy.pdf");
const currentStrategyHtml = path.join(distDir, "Torque Empire - Roar Cars SA Technology Transformation Strategy.html");
const currentPresentationPptx = path.join(distDir, "Torque Empire - Roar Cars SA Executive Board Presentation.pptx");
const signatureAssetPath = path.join(root, "assets", "corporate", "signatures", "Chadwin Karanie - Executive Signature.png");
const signatureAssetDataUrl = `data:image/png;base64,${(await fs.readFile(signatureAssetPath)).toString("base64")}`;

const releaseStrategyPdf = path.join(releaseDir, "01 - Roar Cars SA Technology Transformation Strategy.pdf");
const releasePresentationPptx = path.join(releaseDir, "02 - Roar Cars SA Executive Board Presentation.pptx");
const releaseBriefPdf = path.join(releaseDir, "03 - Executive Brief.pdf");
const releaseCoverLetterPdf = path.join(releaseDir, "04 - Cover Letter.pdf");
const releaseCommercialPdf = path.join(releaseDir, "05 - Commercial Proposal.pdf");
const releaseInvoicePdf = path.join(releaseDir, "Invoice - Roar Cars SA - Technology Transformation.pdf");
const releaseInvoiceAliasPdf = path.join(releaseDir, "06 - Invoice.pdf");

const issueDate = "2 July 2026";
const clientName = "Roar Cars SA";
const attention = "Mr Lawrence Banks";
const boardRef = "TE-RC-BS-001";
const invoiceNumber = "TE-2026-001";

const navy = "#07111f";
const charcoal = "#2b2f33";
const steel = "#40515e";
const white = "#ffffff";
const pale = "#f4f6f8";
const red = "#c1121f";
const blue = "#1f6feb";
const line = "#d9dee5";

const releaseFiles = [
  releaseStrategyPdf,
  releasePresentationPptx,
  releaseBriefPdf,
  releaseCoverLetterPdf,
  releaseCommercialPdf,
  releaseInvoicePdf,
  releaseInvoiceAliasPdf,
];

const archiveRootFiles = [
  "Roar-Cars-Board-Presentation-v2.1.pptx",
  "Roar-Cars-Board-Presentation-v3.0.pptx",
  "Roar-Cars-Board-Presentation.pptx",
  "roar-cars-board-proposal.html",
  "roar-cars-board-proposal.pdf",
  "Roar-Cars-Executive-Proposal-v2.1.html",
  "Roar-Cars-Executive-Proposal-v2.1.pdf",
  "Roar-Cars-Executive-Proposal-v2.html",
  "Roar-Cars-Executive-Proposal-v2.pdf",
  "Roar-Cars-Executive-Proposal-v3.0.html",
  "Roar-Cars-Executive-Proposal-v3.0.pdf",
  "Torque Empire - Roar Cars SA Technology Transformation Strategy.html",
];

const blockedTerms = [
  "Version 2.1",
  "Version 3.0",
  "Executive Review",
  "Board Review",
  "Draft",
  "Internal Release",
  "v2.1",
  "v3.0",
  "TE-RC-EXEC-3.0",
];

const css = `
:root {
  --navy: ${navy};
  --charcoal: ${charcoal};
  --steel: ${steel};
  --white: ${white};
  --pale: ${pale};
  --red: ${red};
  --blue: ${blue};
  --line: ${line};
}
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
html, body {
  margin: 0;
  background: #d8dde3;
  color: #16212b;
  font-family: Arial, Helvetica, sans-serif;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
body { counter-reset: page; }
.page {
  position: relative;
  width: 210mm;
  min-height: 297mm;
  margin: 0 auto;
  padding: 18mm;
  background: var(--white);
  overflow: hidden;
  page-break-after: always;
}
.page:last-child { page-break-after: auto; }
.hero {
  padding: 0;
  background: var(--navy);
  color: var(--white);
}
.hero .plate {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(135deg, rgba(7,17,31,.96), rgba(7,17,31,.84)),
    radial-gradient(circle at top right, rgba(31,111,235,.12), transparent 42%),
    linear-gradient(90deg, rgba(193,18,31,.08), transparent 28%);
}
.hero-inner {
  position: relative;
  min-height: 297mm;
  padding: 24mm 20mm;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.eyebrow, .kicker {
  color: var(--red);
  text-transform: uppercase;
  letter-spacing: 2.2px;
  font-size: 9pt;
  font-weight: 800;
}
.rule, .red-rule {
  width: 24mm;
  height: 1.5mm;
  background: var(--red);
  margin: 7mm 0 8mm;
}
h1, h2, h3, p { margin: 0; }
h1, h2, h3 { line-height: 1.06; letter-spacing: 0; }
h1 { font-size: 38pt; max-width: 156mm; }
h2 { font-size: 24pt; color: var(--navy); max-width: 166mm; }
h3 { font-size: 13.5pt; color: var(--navy); }
.dark h2, .dark h3 { color: var(--white); }
p {
  font-size: 10.6pt;
  line-height: 1.54;
  color: #27313b;
}
.dark p, .hero p { color: rgba(255,255,255,.84); }
.lead {
  font-size: 14.5pt;
  line-height: 1.45;
  max-width: 160mm;
}
.hero .lead { color: rgba(255,255,255,.92); }
.meta, .fields, .signature-grid, .summary-grid, .totals-grid { display: grid; gap: 4mm; }
.grid { display: grid; gap: 6mm; }
.two { grid-template-columns: 1fr 1fr; }
.three { grid-template-columns: repeat(3, 1fr); }
.four { grid-template-columns: repeat(4, 1fr); }
.card, .panel, .table-card {
  border: 1px solid var(--line);
  background: var(--white);
  border-radius: 5mm;
  padding: 6.5mm;
}
.dark .card, .dark .panel, .dark .table-card {
  background: rgba(255,255,255,.07);
  border-color: rgba(255,255,255,.16);
}
.card p, .panel p { margin-top: 3.5mm; }
.section { margin-bottom: 8mm; }
.mt { margin-top: 9mm; }
.xl { margin-top: 15mm; }
.footer {
  position: absolute;
  left: 18mm;
  right: 18mm;
  bottom: 10mm;
  border-top: 1px solid var(--line);
  padding-top: 3.5mm;
  display: flex;
  justify-content: space-between;
  color: #738193;
  font-size: 8pt;
}
.dark .footer {
  border-color: rgba(255,255,255,.18);
  color: rgba(255,255,255,.56);
}
.note {
  border-left: 1.8mm solid var(--blue);
  padding: 4mm 5mm;
  background: var(--pale);
  border-radius: 3mm;
}
.dark .note { background: rgba(255,255,255,.08); }
.summary-grid { grid-template-columns: repeat(3, 1fr); gap: 5mm; }
.metric {
  padding: 5.5mm;
  border-radius: 5mm;
  border: 1px solid var(--line);
  background: #ffffff;
}
.metric .label {
  text-transform: uppercase;
  letter-spacing: 1px;
  font-size: 7.7pt;
  color: #6f7d8a;
  font-weight: 800;
}
.metric .value {
  margin-top: 2.4mm;
  font-size: 15pt;
  font-weight: 800;
  color: var(--navy);
}
.metric .desc { margin-top: 1.8mm; font-size: 9.8pt; color: #41505e; line-height: 1.42; }
.table-card { padding: 0; overflow: hidden; }
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 8.8pt;
}
th {
  background: var(--navy);
  color: var(--white);
  text-align: left;
  padding: 3mm;
  text-transform: uppercase;
  letter-spacing: .8px;
  font-size: 8pt;
}
td {
  border: 1px solid var(--line);
  padding: 3mm;
  vertical-align: top;
  line-height: 1.35;
  color: #23313b;
}
.dark th { background: rgba(255,255,255,.12); }
.dark td { border-color: rgba(255,255,255,.16); color: rgba(255,255,255,.86); }
.small { font-size: 8.8pt; line-height: 1.38; }
.field-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4mm 8mm;
}
.field {
  border-top: 1px solid rgba(255,255,255,.26);
  padding-top: 2.4mm;
}
.field strong, .stamp strong {
  display: block;
  text-transform: uppercase;
  letter-spacing: 1px;
  font-size: 7.7pt;
  color: var(--white);
  margin-bottom: 1mm;
}
.field span, .stamp span { font-size: 9.8pt; color: rgba(255,255,255,.84); }
.stamp strong { color: var(--navy); }
.stamp span { color: #23313b; }
.letterhead {
  display: grid;
  grid-template-columns: 1.2fr .8fr;
  gap: 10mm;
  align-items: start;
}
.address {
  display: grid;
  gap: 2.4mm;
  font-size: 11pt;
  line-height: 1.45;
}
.signature-grid {
  grid-template-columns: repeat(2, 1fr);
  gap: 8mm;
}
.signature-mark {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  min-height: 18mm;
}
.signature-mark img {
  display: block;
  width: auto;
  max-width: 56mm;
  max-height: 16mm;
  object-fit: contain;
}
.signature-name {
  margin-top: 2.5mm;
  font-size: 9pt;
  font-weight: 700;
  color: var(--navy);
}
.signature {
  border-top: 1px solid #9aa6b2;
  height: 12mm;
}
.signature-label {
  margin-top: 3mm;
  text-transform: uppercase;
  letter-spacing: 1px;
  font-size: 7.8pt;
  color: #6f7d8a;
  font-weight: 800;
}
.checklist {
  display: grid;
  gap: 3mm;
}
.item {
  display: grid;
  grid-template-columns: 5mm 1fr;
  gap: 3mm;
  align-items: start;
  font-size: 10pt;
  line-height: 1.42;
}
.box {
  width: 5mm;
  height: 5mm;
  border: 1px solid #40515e;
  margin-top: 1mm;
}
.pricing {
  display: grid;
  grid-template-columns: 1.2fr .8fr;
  gap: 7mm;
}
.pricing .panel { min-height: 34mm; }
.price {
  font-size: 20pt;
  font-weight: 800;
  color: var(--navy);
  margin-top: 2mm;
}
.dark .price { color: var(--white); }
.timeline {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4mm;
}
.phase {
  border: 1px solid var(--line);
  border-radius: 5mm;
  padding: 5.5mm;
  min-height: 44mm;
  background: var(--white);
}
.dark .phase {
  background: rgba(255,255,255,.07);
  border-color: rgba(255,255,255,.16);
}
.phase-num {
  width: 12mm;
  height: 12mm;
  border-radius: 50%;
  background: var(--navy);
  color: var(--white);
  display: grid;
  place-items: center;
  font-weight: 800;
  margin-bottom: 4mm;
}
.dark .phase-num { background: rgba(255,255,255,.12); }
.control-table td:nth-child(3),
.control-table td:nth-child(4) { white-space: nowrap; }
.bank-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4mm 8mm;
}
.bank-grid .field {
  border-top: 1px solid #b9c3cc;
}
.totals-grid {
  grid-template-columns: 1fr;
}
.totals {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 3mm 8mm;
  align-items: center;
  font-size: 10pt;
}
.totals strong { text-transform: uppercase; letter-spacing: 1px; font-size: 7.8pt; color: #6f7d8a; }
.totals .amount { text-align: right; font-weight: 800; color: var(--navy); }
.hero-compact .hero-inner { justify-content: center; gap: 18mm; }
.footer-note { font-size: 7.8pt; color: #6f7d8a; line-height: 1.35; }
`;

function page(content, classes = "") {
  return `<section class="page ${classes}">${content}</section>`;
}

function heroPage(eyebrow, title, lead, metaHtml) {
  return page(`
    <div class="plate"></div>
    <div class="hero-inner">
      <div>
        <div class="eyebrow">${eyebrow}</div>
        <div class="rule"></div>
        <h1>${title}</h1>
        <p class="lead mt">${lead}</p>
      </div>
      <div class="meta">${metaHtml}</div>
    </div>
  `, "hero");
}

function card(title, text) {
  return `<div class="card"><h3>${title}</h3><p>${text}</p></div>`;
}

function metric(label, value, desc) {
  return `<div class="metric"><div class="label">${label}</div><div class="value">${value}</div><div class="desc">${desc}</div></div>`;
}

function table(headers, rows, className = "") {
  return `<div class="table-card ${className}"><table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function bulletList(items) {
  return `<div class="checklist">${items.map((item) => `<div class="item"><div class="box"></div><div>${item}</div></div>`).join("")}</div>`;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function replaceFile(dest, bytes) {
  await fs.rm(dest, { force: true });
  await fs.writeFile(dest, bytes);
}

async function moveFile(src, dest) {
  await fs.rm(dest, { force: true });
  await fs.rename(src, dest);
}

async function readPdfBytes(filePath) {
  return await fs.readFile(filePath);
}

async function setPdfMetadata(filePath, {
  title,
  subject,
  author,
  keywords,
  creator,
  company = "Torque Empire (Pty) Ltd",
}) {
  const bytes = await fs.readFile(filePath);
  const doc = await PDFDocument.load(bytes);
  doc.setTitle(title);
  doc.setSubject(subject);
  doc.setAuthor(author);
  doc.setKeywords(keywords);
  doc.setCreator(creator);
  doc.setProducer(creator);
  const info = doc.context.lookup(doc.context.trailerInfo.Info);
  info.set(PDFName.of("Company"), PDFString.of(company));
  await fs.writeFile(filePath, await doc.save());
}

async function renderPdfFromHtml(html, outPath) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1240, height: 1754 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "load" });
  await page.pdf({
    path: outPath,
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
  });
  await browser.close();
}

async function buildBoardDocs() {
  await ensureDir(releaseDir);
  await ensureDir(archiveDir);

  await replaceFile(releaseStrategyPdf, await fs.readFile(currentStrategyPdf));
  await replaceFile(releasePresentationPptx, await fs.readFile(currentPresentationPptx));

  const rootFiles = await fs.readdir(distDir, { withFileTypes: true });
  for (const entry of rootFiles) {
    if (!entry.isFile()) continue;
    const src = path.join(distDir, entry.name);
    const dest = path.join(archiveDir, entry.name);
    await moveFile(src, dest);
  }

  const briefHtml = `
  <!doctype html>
  <html lang="en">
    <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Executive Brief - Roar Cars SA</title><style>${css}</style></head>
    <body>
      ${heroPage(
        "Executive Issue | Confidential",
        "Executive Brief",
        "A concise release brief for the official client submission package to the Board of Roar Cars SA.",
        `
          <div class="field"><strong>Prepared for</strong><span>${clientName}</span></div>
          <div class="field"><strong>Prepared by</strong><span>Torque Empire (Pty) Ltd</span></div>
          <div class="field"><strong>Issue Date</strong><span>${issueDate}</span></div>
          <div class="field"><strong>Reference</strong><span>${boardRef}</span></div>
        `
      )}
      ${page(`
        <div class="kicker">Briefing</div>
        <h2>The release baseline is now fixed for client submission.</h2>
        <p class="lead mt">The Executive Technology Transformation Strategy has completed internal review and is now packaged as the board submission baseline. The release focuses on controlled delivery, clear governance and a reusable commercial pack that can be adapted for future clients by changing only the client name, reference, invoice number, dates and pricing.</p>
        <div class="summary-grid mt">
          ${metric("Release Status", "Official", "The client submission set is ready for distribution and board review.")}
          ${metric("Commercial Pack", "Reusable", "Pricing, references and dates are templated for future use.")}
          ${metric("Archive", "Preserved", "Previous versions are retained intact in the Archive folder.")}
        </div>
        <div class="grid two mt">
          <div class="card"><h3>Release Contents</h3><p>Strategy, board presentation, executive brief, cover letter, commercial proposal and invoice.</p></div>
          <div class="card"><h3>Board Objective</h3><p>Present one clean client release with no draft language, visible version numbers or placeholder graphics.</p></div>
        </div>
        <div class="footer-note mt">This brief is intentionally compact and reuses the same corporate language as the main proposal so the release set reads as one controlled package.</div>
      `)}
      ${page(`
        <div class="kicker">Document Map</div>
        <h2>The submission set is indexed for board navigation.</h2>
        ${table(["File", "Purpose", "Status"], [
          ["01 - Roar Cars SA Technology Transformation Strategy.pdf", "Executive strategy baseline", "Official release"],
          ["02 - Roar Cars SA Executive Board Presentation.pptx", "Board presentation deck", "Official release"],
          ["03 - Executive Brief.pdf", "Concise release overview", "New template"],
          ["04 - Cover Letter.pdf", "Board cover letter", "New template"],
          ["05 - Commercial Proposal.pdf", "Pricing and scope proposal", "New template"],
          ["Invoice - Roar Cars SA - Technology Transformation.pdf", "Commercial invoice", "New template"],
        ])}
        <div class="footer-note mt">The Archive folder contains the prior executive draft and proposal versions. The release folder contains only the board-submission materials and their reusable commercial counterparts.</div>
      `)}
      <div class="footer"><span>${clientName} - Executive Brief</span><span>3</span></div>
    </body>
  </html>`;

  const coverHtml = `
  <!doctype html>
  <html lang="en">
    <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Cover Letter - Roar Cars SA</title><style>${css}</style></head>
    <body>
      ${page(`
        <div class="kicker">Board Submission</div>
        <div class="letterhead">
          <div>
            <h2>Cover Letter</h2>
            <div class="red-rule"></div>
            <p class="lead">Prepared by Torque Empire (Pty) Ltd for the Board of Directors, Roar Cars SA.</p>
            <div class="address mt">
              <div><strong>${issueDate}</strong></div>
              <div>The Board of Directors</div>
              <div>${clientName}</div>
            </div>
          </div>
          <div class="panel">
            <div class="stamp"><strong>Prepared By</strong><span>Torque Empire (Pty) Ltd</span></div>
            <div class="stamp mt"><strong>Reference</strong><span>${boardRef}</span></div>
            <div class="stamp mt"><strong>Classification</strong><span>Confidential</span></div>
          </div>
        </div>
        <div class="section mt">
          <p>Subject: Official Board Submission - Executive Technology Transformation Strategy</p>
          <p class="mt">Directors,</p>
          <p class="mt">Please find enclosed the official client release package for Roar Cars SA. The package includes the Technology Transformation Strategy, Executive Board Presentation, Executive Brief, Cover Letter, Commercial Proposal and Invoice.</p>
          <p class="mt">This submission reflects the approved executive issue baseline. The content remains aligned to the reviewed strategy, with packaging updated for client issue and commercial distribution.</p>
          <p class="mt">Torque Empire (Pty) Ltd remains available to support clarification, commercial finalisation and implementation planning following board consideration.</p>
          <p class="mt">Yours faithfully,</p>
        </div>
        <div class="grid two mt">
          <div>
            <div class="signature-mark"><img src="${signatureAssetDataUrl}" alt="Chadwin Karanie executive signature"></div>
            <div class="signature-name">Torque Empire (Pty) Ltd</div>
            <div class="signature-label">For Torque Empire (Pty) Ltd</div>
          </div>
          <div><div class="signature"></div><div class="signature-label">Date</div></div>
        </div>
      `)}
      <div class="footer"><span>Cover Letter</span><span>1</span></div>
    </body>
  </html>`;

  const commercialPages = [
    page(`
      <div class="kicker">Commercial Proposal</div>
      <h2>Executive Summary</h2>
      <p class="lead mt">Torque Empire proposes a controlled commercial engagement to stabilise the Roar Cars SA platform, maintain continuity through managed services and prepare the operating environment for future intelligence work once the foundation is secure.</p>
      <div class="summary-grid mt">
        ${metric("Phase 1", "Stabilise", "Production controls, deployment discipline, security hardening and operational readiness.")}
        ${metric("Support", "Managed", "Monitoring, support, reporting and continuity after go-live.")}
        ${metric("Phase 2", "Separate", "AI capability is scoped separately after Phase 1 completion.")}
      </div>
      <div class="grid two mt">
        <div class="card"><h3>Prepared For</h3><p>${clientName}</p><p class="mt">Attention: ${attention}</p></div>
        <div class="card"><h3>Prepared By</h3><div class="signature-mark mt"><img src="${signatureAssetDataUrl}" alt="Chadwin Karanie executive signature"></div><div class="signature-name">Torque Empire (Pty) Ltd</div><p class="mt">Reference: ${boardRef}</p></div>
      </div>
    `),
    page(`
      <div class="kicker">Scope</div>
      <h2>Scope and Deliverables</h2>
      ${table(["Scope Area", "Deliverables", "Outcome"], [
        ["Platform stabilisation", "VPS readiness, deployment discipline, secret handling, rollback planning", "Controlled production foundation"],
        ["Security hardening", "Admin access, SSL, uploads, audit logging and monitoring", "Reduced operational risk"],
        ["Operational testing", "Finance, insurance, email and data-flow validation", "Verified customer journey"],
        ["Managed services", "Monitoring, patching, incident response and reporting", "Continuity after launch"],
        ["Future AI", "Separate proposal for intelligence and verification capability", "Sequenced innovation"],
      ], "control-table")}
      <div class="grid three mt">
        ${card("Executive Value", "Stronger control, clearer visibility and better supportability across the live platform.")}
        ${card("Technical Value", "Architecture, deployment and security aligned to operational continuity.")}
        ${card("Commercial Value", "A reusable engagement model that can be adapted for future clients.")}
      </div>
    `),
    page(`
      <div class="kicker">Implementation</div>
      <h2>Implementation Phases and Support</h2>
      <div class="timeline mt">
        <div class="phase"><div class="phase-num">1</div><h3>Assess</h3><p>Confirm access, scope and baseline controls.</p></div>
        <div class="phase"><div class="phase-num">2</div><h3>Stabilise</h3><p>Secure deployment, data and operational readiness.</p></div>
        <div class="phase"><div class="phase-num">3</div><h3>Launch</h3><p>UAT, cutover and go-live authority.</p></div>
        <div class="phase"><div class="phase-num">4</div><h3>Support</h3><p>Managed services, reporting and improvement cycle.</p></div>
      </div>
      <div class="grid two mt">
        <div class="card"><h3>Support</h3><p>Monthly reporting, incident response, patch coordination and support escalation.</p></div>
        <div class="card"><h3>Commercial Terms</h3><p>Net 7 days, or as otherwise agreed, with pricing presented as editable commercial options.</p></div>
      </div>
    `),
    page(`
      <div class="kicker">Commercial Options</div>
      <h2>Commercial Options</h2>
      ${table(["Option", "Description", "Fee", "Notes"], [
        ["Phase 1 Stabilisation", "Production hardening and launch readiness", "R30,000", "One-time"],
        ["Managed Services", "Monitoring, support and monthly reporting", "R4,500 / month", "Recurring"],
        ["Phase 2 Discovery", "Separate scoping for AI capability", "TBC", "Only after Phase 1"],
      ])}
      <div class="grid two mt">
        <div class="panel">
          <h3>Payment Terms</h3>
          <p class="mt">Payment due within Net 7 Days unless otherwise agreed in writing.</p>
          <p class="mt">VAT to be applied if applicable.</p>
          <p class="mt">Commercial values remain editable for future client reuse.</p>
        </div>
        <div class="panel">
          <h3>Acceptance</h3>
          <p class="mt">Proceed only after board approval and written acceptance of scope, commercial terms and authority to commence.</p>
          <p class="mt">The pricing tables are intentionally editable templates for future engagements.</p>
        </div>
      </div>
    `),
    page(`
      <div class="kicker">Signature Blocks</div>
      <h2>Acceptance and Signature Blocks</h2>
      <div class="signature-grid mt">
        <div class="card"><h3>Torque Empire (Pty) Ltd</h3><div class="signature mt"></div><div class="signature-label">Authorised Signatory</div></div>
        <div class="card"><h3>${clientName}</h3><div class="signature mt"></div><div class="signature-label">${attention}</div></div>
      </div>
      <div class="footer-note mt">This proposal uses the same corporate identity, tone and layout discipline as the executive strategy documents so the commercial pack reads as one controlled submission set.</div>
    `),
  ];
  const commercialHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Commercial Proposal - Roar Cars SA</title><style>${css}</style></head><body>${commercialPages.join("")}</body></html>`;

  const invoiceHtml = `
  <!doctype html>
  <html lang="en">
    <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Invoice - Roar Cars SA - Technology Transformation</title><style>${css}
      body.invoice .page { padding-top: 4mm; padding-bottom: 4mm; }
      body.invoice h2 { font-size: 15pt; }
      body.invoice h3 { font-size: 9.2pt; }
      body.invoice p { font-size: 7pt; line-height: 1.1; }
      body.invoice .grid { gap: 2mm; }
      body.invoice .mt { margin-top: 2.5mm; }
      body.invoice .card,
      body.invoice .panel,
      body.invoice .table-card { padding: 2mm; }
      body.invoice .pricing { gap: 2mm; }
      body.invoice .signature-grid { gap: 2mm; }
      body.invoice .bank-grid { gap: 1.5mm; }
      body.invoice .field strong,
      body.invoice .stamp strong { font-size: 7pt; }
      body.invoice .field span,
      body.invoice .stamp span { font-size: 7.6pt; }
      body.invoice table th,
      body.invoice table td { padding: 1.2mm 1.8mm; font-size: 6.8pt; }
      body.invoice .totals-grid { gap: 1.5mm; }
      body.invoice .totals .amount { font-size: 10.5pt; }
    </style></head>
    <body class="invoice">
      ${page(`
        <div class="kicker">Tax Invoice</div>
        <h2>Invoice - Roar Cars SA - Technology Transformation</h2>
        <div class="pricing mt">
          <div class="panel">
            <div class="stamp"><strong>Supplier</strong><span>Torque Empire (Pty) Ltd</span></div>
            <div class="stamp mt"><strong>Invoice Number</strong><span>${invoiceNumber}</span></div>
            <div class="stamp mt"><strong>Issue Date</strong><span>${issueDate}</span></div>
            <div class="stamp mt"><strong>Client</strong><span>${clientName}</span></div>
            <div class="stamp mt"><strong>Attention</strong><span>${attention}</span></div>
            <div class="stamp mt"><strong>Status</strong><span>Pending Board Approval</span></div>
          </div>
          <div class="panel">
            <h3>Commercial Summary</h3>
            <p class="mt">Professional Consulting Services</p>
            <p class="mt">Executive Technology Assessment</p>
            <p class="mt">Technology Transformation Strategy</p>
            <div class="totals-grid mt">
              <div class="totals"><strong>Subtotal</strong><div class="amount">R25,000.00</div></div>
              <div class="totals"><strong>VAT</strong><div class="amount">Not Applicable</div></div>
              <div class="totals"><strong>Total Due</strong><div class="amount">R25,000.00</div></div>
            </div>
            <p class="mt">Torque Empire (Pty) Ltd is currently not VAT Registered.</p>
          </div>
        </div>
        <div class="table-card mt">
          <table>
            <thead><tr><th>Description</th><th>Quantity</th><th>Rate</th><th>Amount</th></tr></thead>
            <tbody>
              <tr><td>Executive Technology Assessment</td><td>1</td><td>R8,000.00</td><td>R8,000.00</td></tr>
              <tr><td>Enterprise Architecture & Platform Review</td><td>1</td><td>R6,000.00</td><td>R6,000.00</td></tr>
              <tr><td>Technology Transformation Strategy Development</td><td>1</td><td>R7,000.00</td><td>R7,000.00</td></tr>
              <tr><td>Executive Board Submission Preparation &amp; Strategic Consulting Services</td><td>1</td><td>R4,000.00</td><td>R4,000.00</td></tr>
            </tbody>
          </table>
        </div>
      `)}
      ${page(`
        <div class="grid two mt">
          <div class="panel">
            <div class="bank-grid mt">
              <div class="field"><strong>Account Name</strong><span>Torque Empire (Pty) Ltd</span></div>
              <div class="field"><strong>Bank</strong><span>Capitec Bank</span></div>
              <div class="field"><strong>Account Type</strong><span>Business Account</span></div>
              <div class="field"><strong>Account Number</strong><span>1052177301</span></div>
              <div class="field"><strong>Branch Code</strong><span>470010</span></div>
              <div class="field"><strong>Reference</strong><span>${invoiceNumber}</span></div>
            </div>
          </div>
        <div class="panel">
          <p class="mt"><strong>Payment Due:</strong> Within 7 calendar days from invoice date unless otherwise agreed in writing.</p>
          <p class="mt"><strong>VAT:</strong> Not Applicable. Torque Empire (Pty) Ltd is currently not VAT Registered.</p>
        </div>
      </div>
      <div class="panel mt">
        <div class="signature-mark"><img src="${signatureAssetDataUrl}" alt="Chadwin Karanie executive signature"></div>
        <div class="signature-name">Torque Empire (Pty) Ltd</div>
      </div>
        <div class="panel mt" style="background:#f6f9fc;border-color:${line};">
          <h3>Scope of This Invoice</h3>
          <p class="mt">This invoice covers the professional consulting services completed to date, including the Executive Technology Assessment, Enterprise Architecture Review, Technology Transformation Strategy, Executive Board Submission preparation and associated strategic consulting services delivered by Torque Empire (Pty) Ltd.</p>
        </div>
        <div class="panel mt" style="background:#fff6f2;border-color:#f0c7be;">
          <h3>Future Scope of Work</h3>
          <p class="mt">This invoice relates solely to the professional services described above.</p>
          <p class="mt">Any implementation activities, software development, infrastructure provisioning, managed services, artificial intelligence capabilities, integrations, training, support services or additional consulting requested after acceptance of the Executive Technology Transformation Strategy will be subject to a separate written proposal, commercial quotation and formal client approval.</p>
          <p class="mt">Where the agreed project scope changes, expands or additional requirements are introduced, Torque Empire (Pty) Ltd reserves the right to revise commercial pricing, project timelines and delivery schedules through a formal Change Control Process agreed by both parties.</p>
        </div>
        <div class="panel mt">
          <p class="mt">Thank you for the opportunity to assist Roar Cars SA with its technology transformation initiative. Torque Empire (Pty) Ltd appreciates the opportunity to contribute toward your strategic objectives and looks forward to supporting the successful implementation and long-term evolution of your technology platform.</p>
        </div>
      `)}
      <div class="footer"><span>Invoice</span><span>2</span></div>
    </body>
  </html>`;

  await renderPdfFromHtml(briefHtml, releaseBriefPdf);
  await renderPdfFromHtml(coverHtml, releaseCoverLetterPdf);
  await renderPdfFromHtml(commercialHtml, releaseCommercialPdf);
  await renderPdfFromHtml(invoiceHtml, releaseInvoicePdf);
  await replaceFile(releaseInvoiceAliasPdf, await fs.readFile(releaseInvoicePdf));

  await setPdfMetadata(releaseBriefPdf, {
    title: "Executive Brief - Roar Cars SA",
    subject: "Executive release brief",
    author: "Torque Empire (Pty) Ltd",
    keywords: ["Roar Cars SA", "Executive Brief", "Board Submission", "Torque Empire"],
    creator: "Torque Empire Executive Publications",
  });
  await setPdfMetadata(releaseCoverLetterPdf, {
    title: "Cover Letter - Roar Cars SA",
    subject: "Board submission cover letter",
    author: "Torque Empire (Pty) Ltd",
    keywords: ["Roar Cars SA", "Cover Letter", "Board Submission", "Torque Empire"],
    creator: "Torque Empire Executive Publications",
  });
  await setPdfMetadata(releaseCommercialPdf, {
    title: "Commercial Proposal - Roar Cars SA",
    subject: "Commercial proposal",
    author: "Torque Empire (Pty) Ltd",
    keywords: ["Roar Cars SA", "Commercial Proposal", "Pricing", "Torque Empire"],
    creator: "Torque Empire Executive Publications",
  });
  await setPdfMetadata(releaseInvoicePdf, {
    title: "Invoice - Roar Cars SA - Technology Transformation",
    subject: "Invoice",
    author: "Torque Empire (Pty) Ltd",
    keywords: ["Roar Cars SA", "Invoice", "Technology Transformation", "Torque Empire"],
    creator: "Torque Empire Executive Publications",
  });
  await setPdfMetadata(releaseInvoiceAliasPdf, {
    title: "Invoice - Roar Cars SA - Technology Transformation",
    subject: "Invoice",
    author: "Torque Empire (Pty) Ltd",
    keywords: ["Roar Cars SA", "Invoice", "Technology Transformation", "Torque Empire"],
    creator: "Torque Empire Executive Publications",
  });
}

async function verifyRelease() {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const JSZip = (await import("jszip")).default;
  const alerts = [];

  const strategyPdfData = await fs.readFile(releaseStrategyPdf);
  const strategyDoc = await pdfjs.getDocument({ data: new Uint8Array(strategyPdfData), disableWorker: true }).promise;
  let strategyText = "";
  for (let i = 1; i <= strategyDoc.numPages; i += 1) {
    const page = await strategyDoc.getPage(i);
    const content = await page.getTextContent();
    strategyText += content.items.map((item) => item.str).join(" ");
  }
  for (const term of blockedTerms) if (strategyText.includes(term)) alerts.push(`strategy pdf contains ${term}`);

  const pptx = await JSZip.loadAsync(await fs.readFile(releasePresentationPptx));
  let pptxText = "";
  for (const name of Object.keys(pptx.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))) {
    pptxText += await pptx.file(name).async("string");
  }
  for (const term of blockedTerms) if (pptxText.includes(term)) alerts.push(`pptx contains ${term}`);

  const commercialPdfData = await fs.readFile(releaseCommercialPdf);
  const commercialDoc = await pdfjs.getDocument({ data: new Uint8Array(commercialPdfData), disableWorker: true }).promise;
  let commercialText = "";
  for (let i = 1; i <= commercialDoc.numPages; i += 1) {
    const page = await commercialDoc.getPage(i);
    const content = await page.getTextContent();
    commercialText += content.items.map((item) => item.str).join(" ");
  }
  for (const term of blockedTerms) if (commercialText.includes(term)) alerts.push(`commercial pdf contains ${term}`);

  return alerts;
}

async function main() {
  await buildBoardDocs();
  const alerts = await verifyRelease();
  if (alerts.length) {
    throw new Error(alerts.join("; "));
  }
  console.log("Board submission package generated");
}

await main();
