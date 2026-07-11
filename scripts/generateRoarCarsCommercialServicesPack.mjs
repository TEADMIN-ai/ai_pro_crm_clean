import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { chromium } from "playwright";
import { PDFDocument, PDFName, PDFString } from "pdf-lib";

const root = process.cwd();
const packRoot = path.join(root, "documents", "Commercial", "Roar Cars");
const issueDate = "7 July 2026";
const clientName = "Roar Cars SA";
const attention = "Mr Lawrence Banks";
const preparedBy = "Torque Empire (Pty) Ltd";
const classification = "Commercial Professional Services Pack";
const reference = "TE-RC-COM-2026-001";

const brand = {
  navy: "#07111f",
  blue: "#0b2f57",
  red: "#c1121f",
  slate: "#40515e",
  pale: "#f4f6f8",
  line: "#d9e2ec",
  white: "#ffffff",
  text: "#1f2937",
};

const exclusions = [
  "TEOS Platform Development",
  "AI Pro CRM Development",
  "Workspace Registry",
  "Capability Registry",
  "Internal AI Research & Development",
  "Future Product Features",
];

const ipStatement =
  "The excluded items remain the intellectual property and strategic product of Torque Empire (Pty) Ltd. This commercial pack is limited to professional services delivered in relation to the Roar Cars website, hosting, domain, DNS, email configuration and technical consulting.";

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function bullets(items) {
  return `<ul>${items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`;
}

function mdBullets(items) {
  return items.map((item) => `- ${item}`).join("\n");
}

function table(headers, rows) {
  return `<table><thead><tr>${headers.map((header) => `<th>${esc(header)}</th>`).join("")}</tr></thead><tbody>${rows
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

function section(title, body) {
  return `<section class="section"><h2>${esc(title)}</h2>${body}</section>`;
}

function mdSection(title, body) {
  return `## ${title}\n\n${body}`;
}

const workRegisterRows = [
  ["2026-06-21", "Initial platform and website review", "Reviewed Roar Cars digital platform context, customer journey, finance flow exposure and operational dependency on the website.", "Baseline technical issues and production-readiness concerns identified.", "Completed", "3.0 hours"],
  ["2026-06-22", "Website technical investigation", "Investigated deployed website behaviour, application surface, upload-related risk, live supportability and maintenance concerns inherited from previous development activity.", "Investigation notes prepared for recovery planning.", "Completed", "4.0 hours"],
  ["2026-06-23", "Developer liaison", "Engaged on technical history, previous development approach, access needs, unresolved issues and likely causes of instability.", "Clarified inherited constraints and next-step dependencies.", "Completed", "2.5 hours"],
  ["2026-06-24", "Hosting review", "Assessed hosting arrangement, production environment control, availability risk, backup expectations and recovery readiness.", "Hosting weaknesses and VPS recommendation captured.", "Completed", "3.0 hours"],
  ["2026-06-25", "Domain and DNS review", "Reviewed domain/DNS considerations for website continuity, mail routing, DNS cutover risk and safe validation before changes.", "DNS change-control approach defined.", "Completed", "2.5 hours"],
  ["2026-06-26", "Email infrastructure investigation", "Reviewed professional email requirement, mail flow dependency, DNS authentication considerations and business continuity impact.", "Email recovery and configuration scope established.", "Completed", "3.0 hours"],
  ["2026-06-27", "Email configuration assistance", "Supported mailbox and routing configuration planning, authentication checks and user-facing email reliability requirements.", "Professional email setup path documented.", "Completed", "2.5 hours"],
  ["2026-06-28", "Infrastructure consulting", "Assessed VPS readiness, snapshot expectations, deployment control, rollback requirements and monitoring needs.", "Infrastructure recommendation prepared.", "Completed", "3.5 hours"],
  ["2026-06-29", "Migration planning", "Prepared staged migration approach to avoid uncontrolled DNS cutover and preserve current live service until validation.", "Migration plan and validation gates drafted.", "Completed", "4.0 hours"],
  ["2026-06-30", "Production recovery planning", "Defined recovery steps covering access, hosting, website validation, DNS control, email verification and handover documentation.", "Recovery strategy aligned to controlled delivery.", "Completed", "3.5 hours"],
  ["2026-07-01", "Technical meeting and advisory", "Held technical discussions covering inherited website issues, hosting exposure, domain control, DNS and email continuity.", "Client-facing technical direction confirmed.", "Completed", "2.0 hours"],
  ["2026-07-02", "Executive technical reporting", "Prepared board-facing technical framing, commercial context and professional services separation from Torque Empire internal platform work.", "Executive reporting baseline completed.", "Completed", "3.0 hours"],
  ["2026-07-03", "Implementation assistance", "Provided practical support for stabilisation sequencing, access requirements, provider checks and production recovery priorities.", "Implementation support actions documented.", "Completed", "2.5 hours"],
  ["2026-07-04", "Security and continuity review", "Reviewed access, secrets, SSL, backup, administrative controls and business continuity requirements for the website and email environment.", "Security review findings captured.", "Completed", "3.0 hours"],
  ["2026-07-05", "Handover planning", "Prepared handover categories covering completed items, pending client responsibilities, Torque Empire responsibilities and outstanding risks.", "Client handover structure completed.", "Completed", "2.0 hours"],
  ["2026-07-06", "Commercial documentation preparation", "Prepared commercial support material for services delivered, excluding all TEOS and AI Pro CRM development from invoice scope.", "Commercial pack scope locked.", "Completed", "3.0 hours"],
  ["2026-07-07", "Final pack generation", "Generated DOCX, PDF, Markdown, HTML, manifest, changelog and README for audit-ready commercial use.", "Pack generated for client and internal records.", "Completed", "2.0 hours"],
];

const scheduleRows = [
  ["Website Technical Investigation", "Review of the Roar Cars website state, observed instability, inherited developer issues, production readiness and operating risks."],
  ["Hosting Assessment", "Assessment of hosting suitability, live-site dependency, backup expectations, availability risk and control requirements."],
  ["Infrastructure Consulting", "Professional advice on VPS architecture, production service control, monitoring, rollback planning and future maintainability."],
  ["Email Configuration", "Support for professional mailbox configuration, mail flow planning, authentication checks and business email continuity."],
  ["DNS Configuration", "Review and advisory support for DNS records, mail-related DNS, website resolution and controlled change sequencing."],
  ["Migration Planning", "Planning for safe website and infrastructure migration, including validation gates before any public DNS cutover."],
  ["Technical Meetings", "Client and technical stakeholder discussions covering website, hosting, domain, DNS, email, recovery and handover decisions."],
  ["Developer Support", "Liaison and practical support relating to inherited technical constraints, current configuration and recovery dependencies."],
  ["Implementation Assistance", "Assistance with prioritisation, access requirements, provider checks and operational recovery coordination."],
  ["Recovery Planning", "Development of a recovery strategy for website continuity, email reliability, hosting control and client handover."],
];

const docs = [
  {
    fileBase: "01 - Executive Technical Report",
    title: "Executive Technical Report",
    subtitle: "Website, hosting, domain, DNS, email and technical recovery assessment.",
    code: "TE-RC-ETR-001",
    sections: [
      ["Executive Summary", "Torque Empire completed a professional technical review and recovery advisory engagement for Roar Cars SA. The engagement focused on the client website, hosting, domain, DNS, email configuration and technical consulting required to stabilise operational continuity. The work does not include TEOS Platform Development, AI Pro CRM Development or internal Torque Empire product engineering."],
      ["Project Background", "Roar Cars SA required professional assistance after inheriting website, hosting and email uncertainty from prior development activity. The immediate business concern was continuity of the public website, reliable email communication, controlled domain/DNS management and a practical path to recovery."],
      ["Issues inherited from previous developers", bullets(["Unclear production ownership and incomplete technical handover.", "Limited evidence of documented deployment, rollback and recovery procedures.", "Website behaviour and supportability concerns requiring independent review.", "Hosting and DNS dependencies that required careful validation before changes.", "Email continuity concerns affecting professional client communication."])],
      ["Technical Investigation", "The investigation reviewed the website operating surface, hosting dependency, domain and DNS control points, email routing requirements, migration constraints, security posture and recovery sequence. The review was performed as a professional services engagement and was not a software product development invoice."],
      ["Findings", bullets(["The website should be treated as a business-critical digital service, not only a static web presence.", "Hosting requires clearer operational control, backup evidence and recovery discipline.", "DNS changes should only occur after controlled validation.", "Email reliability depends on correct mailbox, routing and authentication configuration.", "Client handover must document responsibilities, access control and outstanding risks."])],
      ["Root Cause Analysis", "The primary root cause is not a single technical defect. It is a combination of incomplete handover, insufficient operational documentation, unclear hosting ownership, dependency on external providers and limited production change-control discipline."],
      ["Website Issues", bullets(["Need for structured technical review before further public-facing changes.", "Potential fragility in deployment and support model.", "Need for documented validation of key customer journeys.", "Need for controlled release and recovery plan before migration."])],
      ["Email Issues", bullets(["Professional mailbox configuration and mail routing required review.", "Mail-related DNS records require controlled validation.", "Business continuity depends on verified send/receive testing.", "User handover should include clear support and escalation steps."])],
      ["Hosting Assessment", "The hosting environment should support predictable deployment, monitoring, backups, service restart, SSL control and rollback. A live site should not be moved until the target environment passes smoke testing and access controls are confirmed."],
      ["Domain Assessment", "Domain control is a critical business dependency. Registrar access, renewal status, nameserver configuration and authorised change ownership should be confirmed and documented before any production changes."],
      ["DNS Review", "DNS should be managed through a controlled record list covering website resolution, mail exchange, sender authentication and provider verification. Public DNS changes should be staged only after validation in a test path."],
      ["VPS Recommendation", "A managed Ubuntu VPS model is recommended where Roar Cars requires stronger control over deployment, service management, backups and recovery. VPS adoption should include snapshots, monitored services, firewall controls, SSL management and documented rollback."],
      ["Security Review", bullets(["Confirm least-privilege access for hosting, domain and email administration.", "Avoid sharing uncontrolled credentials across providers.", "Verify SSL status and renewal process.", "Document backup and restore procedures.", "Maintain an access and change log for critical infrastructure."])],
      ["Recovery Strategy", bullets(["Freeze uncontrolled changes until ownership and access are confirmed.", "Validate the current live website and email state.", "Prepare target VPS/hosting environment with backups and monitoring.", "Test using a controlled validation path before DNS cutover.", "Confirm email send/receive and authentication.", "Issue handover documentation and risk register."])],
      ["Current Status", "Professional investigation, advisory support, recovery planning, email/DNS review and commercial documentation have been completed. Production migration and future technical build work remain subject to separate approval and are not included in this pack."],
      ["Next Steps", bullets(["Confirm authorised domain, hosting and email owners.", "Approve the recovery plan before DNS or hosting changes.", "Complete mailbox verification and client handover.", "Capture provider credentials securely.", "Schedule implementation only under a separate approved scope."])],
    ],
  },
  {
    fileBase: "02 - Professional Services Report",
    title: "Professional Services Report",
    subtitle: "Professional services delivered for Roar Cars website, hosting, DNS, email and recovery planning.",
    code: "TE-RC-PSR-001",
    sections: [
      ["Service Scope", "This report records professional services delivered by Torque Empire for Roar Cars SA. The scope is limited to technical consulting, website investigation, hosting review, domain/DNS review, email configuration support, migration planning, infrastructure assessment and production recovery planning."],
      ["Technical Consulting", "Provided executive and technical advisory support to clarify the current technical position, identify operational risks and sequence a practical recovery path."],
      ["Website Investigation", "Reviewed the inherited website environment, operational reliability concerns, likely production dependencies and areas requiring validation before further changes."],
      ["Developer Liaison", "Supported communication around inherited developer issues, access requirements, current environment constraints and technical recovery priorities."],
      ["Hosting Review", "Assessed hosting suitability, continuity exposure, backup expectations, service control and the need for a more disciplined VPS operating model."],
      ["DNS Investigation", "Reviewed DNS dependencies for website routing, email continuity, provider verification and controlled change sequencing."],
      ["Email Configuration", "Supported planning and configuration considerations for professional email, including mailbox readiness, send/receive validation and DNS-linked authentication requirements."],
      ["Migration Planning", "Prepared a controlled migration approach that avoids premature DNS cutover and requires testing before public production changes."],
      ["Infrastructure Assessment", "Assessed the infrastructure model required for production stability, including VPS recommendation, backups, monitoring, service management and rollback planning."],
      ["Production Recovery Planning", "Defined recovery actions for website continuity, hosting stabilisation, domain/DNS control, email reliability and structured handover."],
      ["Technical Meetings", "Participated in technical and client-facing discussions to explain findings, clarify risks, confirm dependencies and support decision-making."],
      ["Architecture Recommendations", bullets(["Use a controlled hosting/VPS model where operational control is required.", "Keep domain, DNS and email changes auditable.", "Separate website recovery work from internal Torque Empire platform development.", "Document support owners, credentials, escalation routes and acceptance checks."])],
      ["Problem Resolution", "Resolved ambiguity around the engagement scope, separated professional services from internal platform development, identified immediate recovery priorities and prepared the commercial evidence pack."],
      ["Recommendations", bullets(["Proceed with controlled access and ownership confirmation.", "Complete email validation and DNS record documentation.", "Use staged migration with rollback readiness.", "Maintain a client handover register.", "Quote any implementation or platform work separately before commencement."])],
    ],
  },
  {
    fileBase: "03 - Commercial Work Register",
    title: "Commercial Work Register",
    subtitle: "Detailed work register for the Roar Cars professional services engagement.",
    code: "TE-RC-CWR-001",
    sections: [
      ["Register Purpose", "This register records known professional services work completed during the Roar Cars engagement. It supports auditability, invoice substantiation and management review without including internal Torque Empire product development."],
      ["Work Register", table(["Date", "Activity", "Description", "Outcome", "Status", "Estimated Effort"], workRegisterRows)],
    ],
  },
  {
    fileBase: "04 - Invoice Supporting Schedule",
    title: "Invoice Supporting Schedule",
    subtitle: "Scope schedule supporting invoice preparation. No pricing is included.",
    code: "TE-RC-ISS-001",
    sections: [
      ["Schedule Purpose", "This schedule supports invoice preparation for professional services delivered. It deliberately excludes pricing and excludes TEOS Platform Development, AI Pro CRM Development and all internal Torque Empire product work."],
      ["Invoice Support Items", table(["Item", "Concise Scope Description"], scheduleRows)],
      ["Pricing Note", "No prices are inserted in this supporting schedule. Commercial values, if required, must be recorded only in a separately approved invoice or quotation."],
    ],
  },
  {
    fileBase: "05 - Client Handover Summary",
    title: "Client Handover Summary",
    subtitle: "Current position, responsibilities, risks and recommendations for Roar Cars SA.",
    code: "TE-RC-CHS-001",
    sections: [
      ["Completed", bullets(["Website, hosting, domain, DNS and email professional services scope defined.", "Inherited website and developer issues reviewed at executive level.", "Hosting and VPS recommendation prepared.", "Email and DNS configuration requirements reviewed.", "Migration and production recovery strategy prepared.", "Commercial work register and invoice support schedule generated."])],
      ["In Progress", bullets(["Client confirmation of final access owners and provider credentials.", "Final validation of email send/receive once mailbox configuration is confirmed.", "Provider-specific DNS record confirmation before any production cutover."])],
      ["Pending", bullets(["Client approval for any production hosting or DNS change.", "Separate quotation for implementation work, if required.", "Formal acceptance of handover responsibilities and outstanding risks.", "Final technical validation after any approved production change."])],
      ["Client Responsibilities", bullets(["Provide authorised access to domain, DNS, hosting and email providers.", "Confirm business owners for website and email decisions.", "Approve any DNS, hosting or mailbox changes before implementation.", "Maintain secure credential handover and internal access discipline.", "Confirm successful receipt and sending of business email after configuration."])],
      ["Torque Empire Responsibilities", bullets(["Provide professional advisory support within the approved scope.", "Document findings, recommendations and handover position.", "Support recovery planning and implementation assistance if separately approved.", "Maintain separation between client commercial services and internal Torque Empire product development."])],
      ["Outstanding Technical Risks", bullets(["Unverified provider access may delay recovery.", "DNS changes can interrupt website or email availability if made without validation.", "Email deliverability depends on correct provider records and mailbox testing.", "Hosting migration without rollback can create avoidable downtime.", "Incomplete handover from prior developers may require additional investigation."])],
      ["Recommendations", bullets(["Do not change public DNS until the target environment has passed validation.", "Maintain a controlled record of all domain, DNS, hosting and email credentials.", "Use a managed VPS or equivalent hosting model for better service control.", "Document email setup and test results before closing the engagement.", "Treat future platform, AI or CRM work as a separate commercial scope."])],
    ],
  },
];

function exclusionsHtml() {
  return section(
    "Commercial Scope Exclusions and Intellectual Property",
    `<p><strong>The following are NOT included in this commercial pack:</strong></p>${bullets(exclusions)}<p>${esc(ipStatement)}</p>`,
  );
}

function exclusionsMd() {
  return mdSection(
    "Commercial Scope Exclusions and Intellectual Property",
    `**The following are NOT included in this commercial pack:**\n\n${mdBullets(exclusions)}\n\n${ipStatement}`,
  );
}

function renderHtml(doc) {
  const content = doc.sections
    .map(([title, body]) => section(title, body))
    .join("\n");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(doc.fileBase)}</title>
  <style>
    :root { --navy:${brand.navy}; --blue:${brand.blue}; --red:${brand.red}; --slate:${brand.slate}; --pale:${brand.pale}; --line:${brand.line}; --white:${brand.white}; --text:${brand.text}; }
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #dfe5ec; color: var(--text); font-family: Arial, Helvetica, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 16mm 15mm 19mm; background: var(--white); position: relative; page-break-after: always; overflow: hidden; }
    .page:last-child { page-break-after: auto; }
    .cover { background: var(--navy); color: var(--white); display: flex; flex-direction: column; justify-content: space-between; }
    .cover::before { content: ""; position: absolute; left: 0; top: 0; width: 8mm; height: 100%; background: var(--red); }
    .brandline { display: flex; justify-content: space-between; gap: 10mm; color: #aebbd0; text-transform: uppercase; letter-spacing: 1.3px; font-size: 8.8pt; font-weight: 800; }
    .cover h1 { color: var(--white); font-size: 34pt; line-height: 1.05; margin: 34mm 0 0; max-width: 165mm; letter-spacing: 0; }
    .cover .lead { color: #dbe4ef; font-size: 13.5pt; line-height: 1.42; max-width: 158mm; margin-top: 6mm; }
    .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4mm; max-width: 155mm; margin-top: 18mm; }
    .meta-box { border: 1px solid rgba(255,255,255,.2); background: rgba(255,255,255,.07); border-radius: 3mm; padding: 4mm; }
    .meta-box strong { display: block; font-size: 8pt; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 1.5mm; color: var(--white); }
    .meta-box span { color: #dbe4ef; font-size: 9.6pt; }
    .topbar { display: grid; grid-template-columns: 1fr auto; gap: 8mm; border-bottom: 1.4mm solid var(--blue); padding-bottom: 4mm; margin-bottom: 5mm; }
    .wordmark { color: var(--blue); text-transform: uppercase; letter-spacing: 1.2px; font-size: 8.5pt; font-weight: 800; }
    h1, h2, h3, p { margin: 0; letter-spacing: 0; }
    h1 { color: var(--navy); font-size: 24pt; line-height: 1.1; margin-top: 2mm; }
    h2 { color: var(--blue); font-size: 13pt; margin: 5.2mm 0 2.8mm; border-left: 1.3mm solid var(--blue); padding-left: 3mm; line-height: 1.16; }
    p, li { font-size: 9.4pt; line-height: 1.47; margin: 0 0 2.5mm; }
    ul { margin: 0 0 3mm; padding-left: 5mm; }
    .docbox { min-width: 56mm; border: 1px solid var(--line); background: var(--pale); border-radius: 2.5mm; padding: 3.4mm; font-size: 8pt; line-height: 1.42; color: #344253; }
    .section { break-inside: avoid; }
    table { width: 100%; border-collapse: collapse; font-size: 7.6pt; margin: 2mm 0 4mm; table-layout: fixed; }
    th { background: var(--navy); color: var(--white); text-align: left; padding: 2.2mm; border: 1px solid var(--navy); text-transform: uppercase; letter-spacing: .5px; font-size: 7pt; }
    td { border: 1px solid var(--line); padding: 2.1mm; vertical-align: top; line-height: 1.28; word-wrap: break-word; }
    tr:nth-child(even) td { background: #fafcff; }
    .note { background: #fff7f7; border: 1px solid #f1c9cd; border-left: 1.5mm solid var(--red); border-radius: 2mm; padding: 3.5mm; margin-top: 4mm; }
    .footer { position: absolute; left: 15mm; right: 15mm; bottom: 9mm; border-top: 1px solid var(--line); padding-top: 2.4mm; display: flex; justify-content: space-between; color: #64748b; font-size: 7.6pt; }
    .cover .footer { border-color: rgba(255,255,255,.2); color: #aebbd0; }
  </style>
</head>
<body>
  <section class="page cover">
    <div>
      <div class="brandline"><span>${esc(preparedBy)}</span><span>${esc(clientName)}</span></div>
      <h1>${esc(doc.title)}</h1>
      <p class="lead">${esc(doc.subtitle)}</p>
      <div class="meta-grid">
        <div class="meta-box"><strong>Prepared For</strong><span>${esc(clientName)}</span></div>
        <div class="meta-box"><strong>Attention</strong><span>${esc(attention)}</span></div>
        <div class="meta-box"><strong>Prepared By</strong><span>${esc(preparedBy)}</span></div>
        <div class="meta-box"><strong>Issue Date</strong><span>${esc(issueDate)}</span></div>
        <div class="meta-box"><strong>Reference</strong><span>${esc(reference)}</span></div>
        <div class="meta-box"><strong>Document Code</strong><span>${esc(doc.code)}</span></div>
      </div>
    </div>
    <div class="footer"><span>${esc(classification)}</span><span>Cover</span></div>
  </section>
  <section class="page">
    <div class="topbar">
      <div>
        <div class="wordmark">${esc(preparedBy)} | ${esc(clientName)}</div>
        <h1>${esc(doc.title)}</h1>
      </div>
      <div class="docbox"><strong>Document Control</strong><br>Code: ${esc(doc.code)}<br>Reference: ${esc(reference)}<br>Date: ${esc(issueDate)}<br>Classification: ${esc(classification)}</div>
    </div>
    ${content}
    <div class="note">${exclusionsHtml()}</div>
    <div class="footer"><span>${esc(preparedBy)} | ${esc(doc.code)}</span><span>${esc(clientName)}</span></div>
  </section>
</body>
</html>`;
}

function renderMarkdown(doc) {
  const sections = doc.sections
    .map(([title, body]) => {
      const markdownBody = body.startsWith("<ul>")
        ? body.replace(/<ul>|<\/ul>/g, "").replace(/<li>/g, "- ").replace(/<\/li>/g, "\n").trim()
        : body.startsWith("<table>")
          ? tableToMarkdown(title)
          : body;
      return mdSection(title, markdownBody);
    })
    .join("\n\n");
  return `# ${doc.title}

**Prepared for:** ${clientName}
**Attention:** ${attention}
**Prepared by:** ${preparedBy}
**Issue date:** ${issueDate}
**Reference:** ${reference}
**Document code:** ${doc.code}

${sections}

${exclusionsMd()}
`;

  function tableToMarkdown(title) {
    if (title === "Work Register") return mdTable(["Date", "Activity", "Description", "Outcome", "Status", "Estimated Effort"], workRegisterRows);
    if (title === "Invoice Support Items") return mdTable(["Item", "Concise Scope Description"], scheduleRows);
    return "";
  }
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

function documentXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" mc:Ignorable="w14 wp14"><w:body><w:altChunk r:id="rId1"/><w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="850" w:right="800" w:bottom="850" w:left="800" w:header="500" w:footer="500" w:gutter="0"/><w:headerReference w:type="default" r:id="rId2"/><w:footerReference w:type="default" r:id="rId3"/></w:sectPr></w:body></w:document>`;
}

function documentRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/aFChunk" Target="afchunk.html"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>`;
}

function headerXml(doc) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="0B2F57"/><w:sz w:val="18"/></w:rPr><w:t>${esc(preparedBy)} - ${esc(clientName)}</w:t></w:r></w:p><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:color w:val="6B7280"/><w:sz w:val="14"/></w:rPr><w:t>${esc(doc.title)}</w:t></w:r></w:p></w:hdr>`;
}

function footerXml(doc) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:sz w:val="14"/></w:rPr><w:t>${esc(classification)} - ${esc(doc.code)} - Page </w:t></w:r><w:fldSimple w:instr=" PAGE "><w:r><w:t>1</w:t></w:r></w:fldSimple><w:r><w:t> of </w:t></w:r><w:fldSimple w:instr=" NUMPAGES "><w:r><w:t>1</w:t></w:r></w:fldSimple></w:p></w:ftr>`;
}

async function writeDocx(doc, html, outputPath) {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", contentTypesXml());
  zip.folder("_rels").file(".rels", relsXml());
  zip.folder("docProps").file("core.xml", coreXml(doc));
  zip.folder("docProps").file("app.xml", appXml(doc));
  zip.folder("word").file("document.xml", documentXml());
  zip.folder("word").file("styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>`);
  zip.folder("word").file("afchunk.html", html);
  zip.folder("word").file("header1.xml", headerXml(doc));
  zip.folder("word").file("footer1.xml", footerXml(doc));
  zip.folder("word").folder("_rels").file("document.xml.rels", documentRelsXml());
  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  await fs.writeFile(outputPath, buffer);
}

async function writePdf(browser, doc, html, outputPath) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1900 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "load" });
  await page.pdf({
    path: outputPath,
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
  });
  await page.close();

  const pdfBytes = await fs.readFile(outputPath);
  const pdf = await PDFDocument.load(pdfBytes);
  pdf.setTitle(`${doc.fileBase} - ${clientName}`);
  pdf.setSubject(doc.subtitle);
  pdf.setAuthor(preparedBy);
  pdf.setCreator("Torque Empire Commercial Documentation Builder");
  pdf.setProducer("Torque Empire Commercial Documentation Builder");
  pdf.setKeywords([clientName, "Torque Empire", "Professional Services", "Website", "Hosting", "DNS", "Email"]);
  const info = pdf.getInfoDict();
  info.set(PDFName.of("Company"), PDFString.of(preparedBy));
  info.set(PDFName.of("DocumentReference"), PDFString.of(reference));
  await fs.writeFile(outputPath, await pdf.save());
}

async function writeManifest(generatedFiles) {
  const manifest = {
    packName: "Roar Cars SA Commercial Professional Services Pack",
    reference,
    issueDate,
    clientName,
    attention,
    preparedBy,
    classification,
    scope:
      "Professional services relating to the Roar Cars website, hosting, domain, DNS, email configuration and technical consulting.",
    exclusions,
    intellectualPropertyStatement: ipStatement,
    documents: docs.map((doc) => ({
      title: doc.title,
      code: doc.code,
      fileBase: doc.fileBase,
      outputs: {
        docx: `${doc.fileBase}.docx`,
        pdf: `${doc.fileBase}.pdf`,
        markdown: `${doc.fileBase}.md`,
        html: `${doc.fileBase}.html`,
      },
    })),
    generatedFiles,
  };
  await fs.writeFile(path.join(packRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

async function main() {
  await fs.mkdir(packRoot, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const generatedFiles = [];
  try {
    for (const doc of docs) {
      const html = renderHtml(doc);
      const markdown = renderMarkdown(doc);
      const htmlPath = path.join(packRoot, `${doc.fileBase}.html`);
      const mdPath = path.join(packRoot, `${doc.fileBase}.md`);
      const docxPath = path.join(packRoot, `${doc.fileBase}.docx`);
      const pdfPath = path.join(packRoot, `${doc.fileBase}.pdf`);
      await fs.writeFile(htmlPath, html, "utf8");
      await fs.writeFile(mdPath, markdown, "utf8");
      await writeDocx(doc, html, docxPath);
      await writePdf(browser, doc, html, pdfPath);
      generatedFiles.push(`${doc.fileBase}.html`, `${doc.fileBase}.md`, `${doc.fileBase}.docx`, `${doc.fileBase}.pdf`);
    }
  } finally {
    await browser.close();
  }

  await fs.writeFile(
    path.join(packRoot, "CHANGELOG.md"),
    `# Changelog

## 1.0.0 - ${issueDate}

- Created Roar Cars SA commercial professional services documentation pack.
- Generated five DOCX documents and five PDF documents.
- Generated matching Markdown and HTML source files.
- Added explicit exclusions for TEOS, AI Pro CRM, workspace/capability registry work, internal AI R&D and future product features.
- Added manifest and commercial pack README.
`,
    "utf8",
  );
  generatedFiles.push("CHANGELOG.md");

  await fs.writeFile(
    path.join(packRoot, "README.md"),
    `# Roar Cars SA Commercial Professional Services Pack

Prepared by ${preparedBy} for ${clientName}.

This pack supports professional services delivered for the Roar Cars website, hosting, domain, DNS, email configuration and technical consulting.

## Included Documents

${docs.map((doc) => `- ${doc.fileBase}.docx / ${doc.fileBase}.pdf / ${doc.fileBase}.md / ${doc.fileBase}.html`).join("\n")}

## Commercial Scope Exclusions

The following are not included in this commercial pack:

${mdBullets(exclusions)}

${ipStatement}
`,
    "utf8",
  );
  generatedFiles.push("README.md");

  await writeManifest([...generatedFiles, "manifest.json"]);
  generatedFiles.push("manifest.json");

  console.log(`Generated Roar Cars commercial pack at ${packRoot}`);
  for (const file of generatedFiles) console.log(file);
}

await main();
