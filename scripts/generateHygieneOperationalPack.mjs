import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { chromium } from "playwright";

const root = process.cwd();
const outRoot = path.join(root, "output", "doc", "Torque Empire Hygiene Division Operational Pack V1.0");
const sourceRoot = path.join(outRoot, "source");
const company = "Torque Empire (Pty) Ltd";
const division = "Torque Empire Hygiene Division";
const packTitle = "Torque Empire Hygiene Division Operational Pack V1.0";
const confidentialFooter = "Confidential - Torque Empire internal and controlled distribution only.";
const brandBlue = "#0b2f57";
const brandNavy = "#07111f";
const brandGrey = "#6b7280";
const brandLight = "#f3f6f9";
const brandBorder = "#d9e2ec";
const brandText = "#1f2937";
const white = "#ffffff";
const revision = "3.0";
const version = "1.0";
const preparedBy = company;
const approvedBy = "Torque Empire Board of Directors";
const docDate = "4 July 2026";

const folders = [
  "01 Executive Pack",
  "02 SLA",
  "03 Quotations",
  "04 Invoices",
  "05 Operations",
  "06 Compliance",
  "07 Registers",
  "08 SOP Manual",
  "09 Forms",
  "10 Final Operations Manual",
];

const css = `
:root { --blue:${brandBlue}; --navy:${brandNavy}; --grey:${brandGrey}; --light:${brandLight}; --border:${brandBorder}; --text:${brandText}; --white:${white}; }
* { box-sizing:border-box; }
html, body { margin:0; padding:0; background:#dfe6ee; color:var(--text); font-family:Arial, Helvetica, sans-serif; }
body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.page { width:210mm; min-height:297mm; margin:0 auto 10mm; background:var(--white); padding:16mm 15mm 18mm; position:relative; page-break-after:always; }
.page:last-child { page-break-after:auto; }
.topbar { display:flex; justify-content:space-between; align-items:flex-start; gap:20px; border-bottom:3px solid var(--blue); padding-bottom:10px; margin-bottom:14px; }
.brand { font-size:13px; font-weight:700; color:var(--blue); text-transform:uppercase; letter-spacing:.06em; }
.title { font-size:26px; line-height:1.1; margin:4px 0 0; color:var(--navy); }
.subtitle { font-size:11px; color:var(--grey); margin-top:6px; }
.docbox { background:var(--light); border:1px solid var(--border); border-radius:8px; padding:10px 12px; min-width:220px; font-size:10.5px; line-height:1.4; }
.docbox strong { color:var(--navy); }
.section { margin:14px 0; }
.section h2 { font-size:14px; margin:0 0 8px; color:var(--blue); border-left:4px solid var(--blue); padding-left:8px; }
.section p, .section li { font-size:10.7px; line-height:1.5; margin:0 0 6px; }
ul { margin:0; padding-left:18px; }
.table { width:100%; border-collapse:collapse; font-size:10px; margin:6px 0 0; }
.table th, .table td { border:1px solid var(--border); padding:6px 7px; vertical-align:top; }
.table th { background:var(--navy); color:var(--white); text-align:left; font-weight:700; }
.table tr:nth-child(even) td { background:#fafcfe; }
.footer { position:absolute; left:15mm; right:15mm; bottom:10mm; display:flex; justify-content:space-between; align-items:center; font-size:9.3px; color:#51606f; border-top:1px solid var(--border); padding-top:6px; }
.cover { display:flex; min-height:260mm; flex-direction:column; justify-content:center; gap:16px; border:1px solid var(--border); border-radius:12px; padding:24mm 18mm; background:linear-gradient(180deg,#fff,#f8fbff); }
.cover h1 { font-size:30px; margin:0; color:var(--navy); }
.cover .lead { font-size:13px; color:var(--grey); max-width:150mm; }
.pill { display:inline-block; padding:5px 10px; border-radius:999px; background:var(--blue); color:#fff; font-size:10px; font-weight:700; }
.blank { color:#94a3b8; }
`;

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function p(text) {
  return `<p>${esc(text)}</p>`;
}

function bullets(items) {
  return `<ul>${items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`;
}

function table(headers, rows) {
  return `<table class="table"><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr>${rows
    .map((row) => `<tr>${row.map((cell) => `<td>${cell === "" ? '<span class="blank">&nbsp;</span>' : esc(cell)}</td>`).join("")}</tr>`)
    .join("")}</table>`;
}

function section(title, blocks) {
  return `<div class="section"><h2>${esc(title)}</h2>${blocks.join("")}</div>`;
}

function docBox(doc) {
  return `<div class="docbox"><strong>Document Control</strong><br>Code: ${esc(doc.code)}<br>Revision: ${esc(revision)}<br>Version: ${esc(version)}<br>Prepared By: ${esc(preparedBy)}<br>Approved By: ${esc(approvedBy)}<br>Date: ${esc(docDate)}<br>Classification: Controlled Copy</div>`;
}

function page(doc, subtitle, body, klass = "") {
  return `<section class="page ${klass}"><div class="topbar"><div><div class="brand">${esc(company)} | ${esc(division)}</div><div class="title">${esc(doc.title)}</div><div class="subtitle">${esc(subtitle || doc.subtitle)}</div></div>${docBox(doc)}</div>${body}<div class="footer"><span>${esc(confidentialFooter)}</span><span>${esc(doc.code)} | Page</span></div></section>`;
}

function htmlDoc(doc) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(doc.title)}</title><style>${css}</style></head><body>${doc.pages
    .map((pg, index) => page(doc, pg.title, pg.body, index === 0 && doc.kind === "pack" ? "cover" : ""))
    .join("")}</body></html>`;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function coreXml(doc) {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(doc.title)}</dc:title><dc:subject>${esc(doc.subtitle)}</dc:subject><dc:creator>${esc(preparedBy)}</dc:creator><cp:lastModifiedBy>${esc(preparedBy)}</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
}

function appXml(doc) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Torque Empire Document Builder</Application><TitlesOfParts><vt:vector size="1" baseType="lpstr"><vt:lpstr>${esc(doc.title)}</vt:lpstr></vt:vector></TitlesOfParts></Properties>`;
}

function contentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="html" ContentType="text/html"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
}

function relsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
}

function headerXml(doc) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="0B2F57"/><w:sz w:val="18"/></w:rPr><w:t>${esc(company)}</w:t></w:r></w:p><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:color w:val="6B7280"/><w:sz w:val="14"/></w:rPr><w:t>${esc(division)} - ${esc(doc.title)}</w:t></w:r></w:p></w:hdr>`;
}

function footerXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:sz w:val="14"/></w:rPr><w:t>${esc(confidentialFooter)} </w:t></w:r><w:r><w:t>Page </w:t></w:r><w:fldSimple w:instr=" PAGE "><w:r><w:t>1</w:t></w:r></w:fldSimple><w:r><w:t> of </w:t></w:r><w:fldSimple w:instr=" NUMPAGES "><w:r><w:t>1</w:t></w:r></w:fldSimple></w:p></w:ftr>`;
}

function documentXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" mc:Ignorable="w14 wp14"><w:body><w:altChunk r:id="rId1"/><w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="900" w:right="850" w:bottom="900" w:left="850" w:header="500" w:footer="500" w:gutter="0"/><w:headerReference w:type="default" r:id="rId2"/><w:footerReference w:type="default" r:id="rId3"/></w:sectPr></w:body></w:document>`;
}

function documentRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/aFChunk" Target="afchunk.html"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>`;
}

async function writeDocx(doc, html) {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", contentTypesXml());
  zip.folder("_rels").file(".rels", relsXml());
  zip.folder("docProps").file("core.xml", coreXml(doc));
  zip.folder("docProps").file("app.xml", appXml(doc));
  zip.folder("word").file("document.xml", documentXml());
  zip.folder("word").file("styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>`);
  zip.folder("word").file("afchunk.html", html);
  zip.folder("word").file("header1.xml", headerXml(doc));
  zip.folder("word").file("footer1.xml", footerXml());
  zip.folder("word").folder("_rels").file("document.xml.rels", documentRelsXml());
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

async function writePdf(html, pdfPath, title) {
  const browser = await chromium.launch({ headless: true });
  const pageObj = await browser.newPage({ viewport: { width: 1240, height: 1754 } });
  await pageObj.setContent(html, { waitUntil: "load" });
  await pageObj.emulateMedia({ media: "print" });
  await pageObj.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    displayHeaderFooter: true,
    margin: { top: "18mm", right: "12mm", bottom: "16mm", left: "12mm" },
    headerTemplate: `<div style="font-size:8px;color:#6b7280;width:100%;padding:0 12mm;">${esc(company)} - ${esc(title)}</div>`,
    footerTemplate: `<div style="font-size:8px;color:#6b7280;width:100%;padding:0 12mm;display:flex;justify-content:space-between;"><span>${esc(confidentialFooter)}</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
  });
  await browser.close();
}

const docs = [
  { folder: "01 Executive Pack", fileBase: "Executive Cover Pack", title: "Executive Cover Pack", code: "TE-HY-EXEC-001", subtitle: "Operational pack index, control registers and distribution governance.", kind: "pack", pages: [ { title: "Executive Cover Pack", body: [ section("Document Purpose", [ p("This controlled pack supports live commercial operations, client onboarding, compliance inspections, hazardous waste transport, internal audits and ISO-quality operational management."), p("The pack is structured as a working operational library. Each document is designed for boardroom presentation, live execution and controlled revision management.") ]), section("Document Index", [ bullets([ "02 SLA - Corporate Service Level Agreement", "03 Quotations - Corporate Quotation Template", "04 Invoices - Corporate Invoice Template", "05 Operations - Waste Collection Manifest, Service Completion Certificate, Monthly Service Report", "06 Compliance - Vehicle Inspection Register, PPE Register, Incident Report, Non-Conformance Report, Internal Audit Checklist", "07 Registers - Customer Complaint Register, Bin Placement Register, Collection Schedule, Disposal Verification Register, Driver Training Register", "08 SOP Manual - Standard Operating Procedures Manual", "09 Forms - Driver Daily Checklist", "10 Final Operations Manual - Corporate Hygiene Operations Manual" ]) ]), section("Controlled Copy Register", [ table(["Copy No", "Holder", "Format", "Status"], [ ["01", "Torque Empire Board", "PDF and DOCX", "Controlled"], ["02", "Operations Manager", "PDF and DOCX", "Controlled"], ["03", "Compliance Officer", "PDF and DOCX", "Controlled"], ["04", "Client File", "PDF", "Issued on approval"] ]) ]), section("Distribution Register", [ table(["Recipient", "Role", "Format", "Authorised"], [ ["Board of Directors", "Governance", "PDF and DOCX", "Yes"], ["Operations Management", "Operations", "PDF and DOCX", "Yes"], ["Compliance and Audit", "Assurance", "PDF and DOCX", "Yes"], ["Client Representative", "Client onboarding", "PDF", "On issue"] ]) ]) ] } ] },
  { folder: "02 SLA", fileBase: "Corporate Service Level Agreement", title: "Corporate Service Level Agreement", code: "TE-HY-SLA-003.0", subtitle: "Commercial agreement for managed hygiene waste services.", kind: "agreement", pages: [ { title: "Corporate Service Level Agreement", body: [ section("Parties", [ table(["Party", "Description"], [[company, "Service provider and operator"], ["Client", "Commercial customer receiving managed hygiene waste services"]]) ]), section("Commercial Philosophy", [ p("Torque Empire provides a professionally managed hygiene waste service. The customer purchases a monthly managed service. Collections are scheduled according to operational requirements and are not individually billed."), p("The service includes collection planning, vehicle allocation, driver allocation, waste transport, disposal capacity, compliance documentation, customer reporting and administrative support.") ]), section("Service Scope", [ bullets(["Scheduled collections and emergency collections as approved.", "Waste handling, loading, transport and disposal coordination.", "Manifest control and chain of custody records.", "Compliance documentation and incident reporting.", "Customer communication, service reports and issue escalation."]) ]), section("Responsibilities", [ table(["Torque Empire Responsibilities", "Client Responsibilities"], [["Professional conduct, reliable scheduling, regulatory compliance, environmental responsibility and documentation.", "Maintain safe access, authorised representatives, waste segregation, cancellation notice and operational communication."], ["Safe transport, PPE compliance, incident reporting and record retention.", "Provide site access, accurate information and timely cooperation."]]) ]) ] }, { title: "Commercial Terms", body: [ section("Schedule and Emergency Response", [ p("Collections may be weekly, fortnightly, monthly, custom, emergency or multi-site. A change in collection schedule does not automatically change the commercial model."), p("Emergency attendance, public holiday support and after-hours work are only performed where approved or contractually required.") ]), section("Health and Safety", [ bullets(["OHSA alignment and safe working controls.", "PPE and vehicle safety obligations.", "Incident, spill and exposure reporting.", "Hazardous waste handling and transport controls."]) ]), section("Confidentiality and POPIA", [ p("Both parties must protect commercial, operational and personal information. Personal data must be handled lawfully, minimally and only for the purposes of service delivery, compliance and record keeping.") ]), section("Insurance, Indemnities and Force Majeure", [ bullets(["The operator maintains appropriate business insurance where required.", "Each party remains responsible for its own negligence and unlawful acts.", "Force majeure applies where lawful performance is materially prevented by events outside reasonable control."]) ]), section("Payment Terms", [ p("Invoices are issued monthly unless otherwise agreed in writing. Terms, late payment consequences and collections suspension rights apply as stated in the acceptance schedule.") ]), section("Dispute Resolution and Governing Law", [ p("The parties will seek good-faith resolution before formal dispute escalation. South African law governs this agreement.") ]) ] } ] },
  { folder: "03 Quotations", fileBase: "Corporate Quotation Template", title: "Corporate Quotation Template", code: "TE-HY-QUO-001", subtitle: "Editable quotation template with automatic totals.", kind: "form", pages: [ { title: "Corporate Quotation Template", body: [ section("Pricing Schedule", [ table(["Service Item", "Qty", "Unit", "Rate (ZAR)", "Amount (ZAR)"], [["Monthly managed hygiene waste service fee", "", "Month", "", ""], ["Emergency collection", "", "Call-out", "", ""], ["Weekend collection", "", "Visit", "", ""], ["Public holiday collection", "", "Visit", "", ""], ["Additional hygiene units", "", "Unit", "", ""]]) ]), section("Totals", [ table(["Subtotal", "VAT", "Total"], [["", "", ""]]) ]), section("Acceptance", [ table(["Client authoriser", "Signature", "Date"], [["", "", ""]]) ]), section("Terms and Conditions", [ bullets(["Quotation is valid for 30 days unless otherwise stated.", "Scope changes require written approval.", "Rates exclude items not expressly listed."]) ]) ] } ] },
  { folder: "04 Invoices", fileBase: "Corporate Invoice Template", title: "Corporate Invoice Template", code: "TE-HY-INV-001", subtitle: "Automatic numbering, payment reference and banking details.", kind: "form", pages: [ { title: "Corporate Invoice Template", body: [ section("Invoice Details", [ table(["Invoice No", "Invoice Date", "Due Date", "Client Reference"], [["", "", "", ""]]) ]), section("Service Lines", [ table(["Description", "Qty", "Unit", "Rate (ZAR)", "Amount (ZAR)"], [["Monthly managed hygiene waste service fee", "", "Month", "", ""], ["Additional approved services", "", "As agreed", "", ""]]) ]), section("Payment Details", [ table(["Bank", "Account Name", "Account Number", "Branch Code"], [["", "", "", ""]]), table(["Payment Reference", "QR Payment Placeholder"], [["", ""]]) ]), section("Payment Terms", [ bullets(["Payment due within the agreed terms stated on the invoice.", "Proof of payment should reference the invoice number.", "Service suspension rights apply for non-payment as allowed by contract."]) ]) ] } ] },
  { folder: "05 Operations", fileBase: "Waste Collection Manifest", title: "Waste Collection Manifest", code: "TE-HY-MAN-001", subtitle: "Chain of custody from generator to disposal facility.", kind: "form", pages: [ { title: "Waste Collection Manifest", body: [ section("Chain of Custody", [ table(["Generator", "Transporter", "Disposal Facility"], [["", "", ""]]), table(["Manifest No", "Collection Date", "Weight", "Waste Type"], [["", "", "", ""]]), table(["Collected By", "Vehicle", "Driver", "Supervisor"], [["", "", "", ""]]) ]), section("Signatures", [ table(["Generator Signature", "Transporter Signature", "Facility Signature"], [["", "", ""]]) ]) ] }, { title: "Service Completion Certificate", body: [ section("Customer Confirmation", [ p("The customer confirms that the scheduled service was completed in accordance with the service agreement and site requirements.") ]), section("Driver Confirmation", [ p("The driver confirms that collection, loading, manifest handling and handover were completed and recorded.") ]), section("Photographic Evidence", [ table(["Photo Ref", "Description", "Captured At"], [["", "", ""], ["", "", ""]]) ]), section("Digital Signatures", [ table(["Customer", "Driver", "Supervisor"], [["", "", ""]]) ]) ] }, { title: "Monthly Service Report", body: [ section("Summary", [ table(["Metric", "Value"], [["Collections", ""], ["Volumes", ""], ["Waste Type", ""], ["Service Issues", ""], ["Recommendations", ""]]) ]), section("Management Sign-off", [ table(["Prepared By", "Reviewed By", "Approved By", "Date"], [["", "", "", ""]]) ]) ] } ] },
  { folder: "06 Compliance", fileBase: "Vehicle Inspection Register", title: "Vehicle Inspection Register", code: "TE-HY-REG-001", subtitle: "Daily, weekly and monthly fleet condition register.", kind: "register", pages: [ { title: "Vehicle Inspection Register", body: [ section("Inspection Checks", [ table(["Date", "Vehicle", "Tyres", "Lights", "Brakes", "Spill Kit", "Fire Extinguisher", "Load Area", "Hazchem Equipment", "Inspector"], [["", "", "", "", "", "", "", "", "", ""], ["", "", "", "", "", "", "", "", "", ""]]) ]), section("Notes", [ p("All defects must be escalated before vehicle dispatch. Unsafe vehicles must not operate until corrected and signed off.") ]) ] }, { title: "PPE Register", body: [ section("Issue Register", [ table(["Employee", "Issue Date", "Item", "Size", "Replacement Date", "Employee Signature", "Supervisor Signature"], [["", "", "", "", "", "", ""], ["", "", "", "", "", "", ""]]) ]) ] }, { title: "Incident Report", body: [ section("Incident Details", [ table(["Incident Type", "Date", "Location", "Reported By"], [["", "", "", ""]]) ]), section("Root Cause Analysis", [ table(["Cause", "Finding", "Corrective Action", "Preventive Action"], [["", "", "", ""]]) ]), section("Approvals", [ table(["Investigator", "Manager", "HSE", "Date"], [["", "", "", ""]]) ]) ] }, { title: "Non-Conformance Report", body: [ section("Issue and Risk", [ table(["Issue", "Risk", "Immediate Containment"], [["", "", ""]]) ]), section("Action Tracking", [ table(["Corrective Action", "Preventive Action", "Verification", "Close-out Date"], [["", "", "", ""]]) ]) ] }, { title: "Internal Audit Checklist", body: [ section("Audit Control Areas", [ table(["Area", "Pass", "Fail", "Evidence", "Auditor"], [["Operational", "", "", "", ""], ["Legal", "", "", "", ""], ["Environmental", "", "", "", ""], ["Health and Safety", "", "", "", ""], ["Fleet", "", "", "", ""], ["Documentation", "", "", "", ""]]) ]) ] } ] },
  { folder: "07 Registers", fileBase: "Customer Complaint Register", title: "Customer Complaint Register", code: "TE-HY-REG-002", subtitle: "Complaint, investigation, resolution and close-out control.", kind: "register", pages: [ { title: "Customer Complaint Register", body: [ section("Complaint Tracking", [ table(["Date", "Customer", "Complaint", "Investigation", "Resolution", "Close-out", "Owner"], [["", "", "", "", "", "", ""], ["", "", "", "", "", "", ""]]) ]) ] }, { title: "Bin Placement Register", body: [ section("Asset Tracking", [ table(["Serial No", "Customer", "Location", "Condition", "Maintenance History", "Last Check", "Next Check"], [["", "", "", "", "", "", ""], ["", "", "", "", "", "", ""]]) ]) ] }, { title: "Collection Schedule", body: [ section("Scheduled Routes", [ table(["Frequency", "Customer Route", "Driver Allocation", "Day", "Time Window", "Notes"], [["Weekly", "", "", "", "", ""], ["Monthly", "", "", "", "", ""], ["Quarterly", "", "", "", "", ""]]) ]) ] }, { title: "Disposal Verification Register", body: [ section("Disposal Control", [ table(["Waste Facility", "Manifest Number", "Weight", "Certificate", "Disposal Confirmation", "Verified By"], [["", "", "", "", "", ""], ["", "", "", "", "", ""]]) ]) ] }, { title: "Driver Training Register", body: [ section("Training and Competency", [ table(["Driver", "Attendance", "Competency", "Refresher Training", "Expiry", "Trainer"], [["", "", "", "", "", ""], ["", "", "", "", "", ""]]) ]) ] } ] },
  { folder: "08 SOP Manual", fileBase: "Standard Operating Procedures Manual", title: "Standard Operating Procedures Manual", code: "TE-HY-SOP-001", subtitle: "Operating procedures for live service execution.", kind: "manual", pages: [ { title: "SOP Manual", body: [ section("Purpose", [ p("This manual defines the operating steps for customer onboarding, bin installation, collections, loading, transport, unloading, emergency response, administration and records management.") ]), section("Procedures", [ bullets(["Customer onboarding", "Bin installation", "Collection procedure", "Transport procedure", "Loading procedure", "Unloading procedure", "Emergency spill response", "Vehicle breakdown response", "Accident response", "PPE requirements", "Waste acceptance", "Waste rejection", "Office administration", "Records management", "Daily close-out"]) ]), section("Compliance Notes", [ p("All steps must align with South African legislation, OHSA, NEMWA, Gauteng waste controls, waste classification requirements, POPIA and COIDA where applicable.") ]) ] } ] },
  { folder: "09 Forms", fileBase: "Driver Daily Checklist", title: "Driver Daily Checklist", code: "TE-HY-FRM-001", subtitle: "Driver pre-departure and route readiness checklist.", kind: "form", pages: [ { title: "Driver Daily Checklist", body: [ section("Daily Checks", [ table(["Check Item", "Yes", "No", "Comments"], [["Licence", "", "", ""], ["PDP", "", "", ""], ["PPE", "", "", ""], ["Fuel", "", "", ""], ["Vehicle", "", "", ""], ["Waste Containers", "", "", ""], ["Manifest", "", "", ""]]) ]), section("Sign-off", [ table(["Driver", "Supervisor", "Date"], [["", "", ""]]) ]) ] } ] },
  { folder: "10 Final Operations Manual", fileBase: "Corporate Hygiene Operations Manual", title: "Corporate Hygiene Operations Manual", code: "TE-HY-MANUAL-001", subtitle: "Master manual for live operations and compliance management.", kind: "manual", pages: [ { title: "Corporate Hygiene Operations Manual", body: [ section("Executive Summary", [ p("Torque Empire Hygiene Division operates as a managed hygiene waste service built around controlled scheduling, legal compliance, chain of custody and document discipline.") ]), section("Corporate Introduction", [ p("This manual consolidates the operational pack, forms, registers and SOPs into one controlled working manual suitable for client onboarding, inspections and internal audit.") ]), section("Organisation Structure", [ table(["Function", "Role"], [["Board", "Oversight"], ["Operations", "Service delivery"], ["Compliance", "Legal and environmental control"], ["Drivers", "Field execution"], ["Administration", "Records and reporting"]]) ]), section("Operational Workflow", [ bullets(["Onboard client", "Install bins", "Schedule route", "Collect waste", "Complete manifest", "Confirm disposal", "Report service outcome"]) ]), section("Document References", [ bullets(["SLA", "Quotation template", "Invoice template", "Manifest", "Completion certificate", "Monthly service report", "Registers", "SOP manual"]) ]), section("Appendices", [ p("Appendix A - Forms. Appendix B - Registers. Appendix C - SOP control. Appendix D - Document control register.") ]) ] } ] },

];

function docSummary() {
  return {
    company,
    division,
    packTitle,
    revision,
    version,
    preparedBy,
    approvedBy,
    confidentialFooter,
    docs: docs.map((d) => ({ folder: d.folder, title: d.title, code: d.code, fileBase: d.fileBase })),
  };
}

async function run() {
  for (const folder of folders) {
    await ensureDir(path.join(outRoot, folder));
  }
  await ensureDir(sourceRoot);
  await fs.writeFile(path.join(sourceRoot, 'pack-styles.css'), css, 'utf8');
  for (const doc of docs) {
    const folderPath = path.join(outRoot, doc.folder);
    await ensureDir(folderPath);
    const html = htmlDoc(doc);
    const pdfPath = path.join(folderPath, doc.fileBase + '.pdf');
    const docxPath = path.join(folderPath, doc.fileBase + '.docx');
    await fs.writeFile(path.join(sourceRoot, doc.fileBase + '.html'), html, 'utf8');
    await fs.writeFile(path.join(sourceRoot, doc.fileBase + '.json'), JSON.stringify({ title: doc.title, code: doc.code, revision, version, pages: doc.pages.length }, null, 2), 'utf8');
    await fs.writeFile(docxPath, await writeDocx(doc, html));
    await writePdf(html, pdfPath, doc.title);
  }
  await fs.writeFile(path.join(sourceRoot, '.pack-data.json'), JSON.stringify(docSummary(), null, 2), 'utf8');
  await fs.writeFile(path.join(outRoot, 'README.md'), '# ' + packTitle + '\n\nGenerated operational pack for Torque Empire Hygiene Division.\n', 'utf8');
  console.log('Generated hygiene operational pack at ' + outRoot);
}

await run();
