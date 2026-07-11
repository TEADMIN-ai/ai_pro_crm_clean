import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { chromium } from "playwright";
import { PDFDocument, PDFName, PDFString } from "pdf-lib";

const root = process.cwd();
const packRoot = path.join(root, "documents", "Corporate", "Government Engagement Pack");
const issueDate = "8 July 2026";
const company = "Torque Empire (Pty) Ltd";
const packName = "Torque Empire Government Engagement Pack";
const reference = "TE-GOV-ENG-2026-001";
const preparedFor = "Government, Municipalities, SOEs, Investors and Corporate Clients";
const preparedBy = "Torque Empire Executive Office";
const contact = {
  email: "admin@torqueempire.net",
  website: "www.torqueempire.net",
  phone: "Available on request",
  location: "South Africa",
  director: "Chadwin Karanie",
};

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

const divisions = [
  "Procurement and tender support",
  "Hygiene and operational services",
  "Telecommunications and connectivity services",
  "Technology, TEOS and digital transformation",
];

const industries = [
  "Government and public sector",
  "Municipal service delivery",
  "State owned enterprises",
  "Construction and infrastructure",
  "Hygiene and facilities operations",
  "Automotive and finance operations",
  "Corporate procurement and compliance",
];

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function plain(value) {
  return String(value).replace(/<[^>]+>/g, "");
}

function bullets(items) {
  return `<ul>${items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`;
}

function mdBullets(items) {
  return items.map((item) => `- ${item}`).join("\n");
}

function table(headers, rows) {
  return `<table><thead><tr>${headers.map((header) => `<th>${esc(header)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((row) => `<tr>${row.map((cell) => `<td>${Array.isArray(cell) ? bullets(cell) : esc(cell)}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

function mdTable(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => (Array.isArray(cell) ? cell.join("; ") : String(cell)).replace(/\|/g, "/")).join(" | ")} |`),
  ].join("\n");
}

function section(title, body) {
  return `<section class="section"><h2>${esc(title)}</h2>${body}</section>`;
}

function mdSection(title, body) {
  return `## ${title}\n\n${body}`;
}

const docs = [
  {
    fileBase: "01 - One Page Company Profile",
    title: "One Page Company Profile",
    subtitle: "Concise profile for government, SOE, investor and corporate introductions.",
    code: "TE-GOV-001",
    onePage: true,
    sections: [
      ["Who We Are", `${company} is a South African enterprise focused on practical service delivery, procurement support, hygiene operations, telecommunications and digital transformation through governed technology.`],
      ["What We Do", "We help organisations strengthen procurement control, improve operational discipline, digitise workflows, manage compliance evidence and build technology-enabled service models that are easier to audit, support and scale."],
      ["Our Four Divisions", bullets(divisions)],
      ["Technology Capability", "Torque Empire develops and operates TEOS, a governed operating platform designed around workspaces, auditability, role-aware workflows, document control, dashboards and future AI-assisted decision support. AI supports human judgement and remains subordinate to business rules and governance."],
      ["Industries Served", bullets(industries)],
      ["Contact Details", table(["Contact", "Details"], [["Director", contact.director], ["Email", contact.email], ["Website", contact.website], ["Telephone", contact.phone], ["Location", contact.location]])],
    ],
  },
  {
    fileBase: "02 - Corporate Capability Statement",
    title: "Corporate Capability Statement",
    subtitle: "Professional capability profile across services, compliance, operations and technology.",
    code: "TE-GOV-002",
    sections: [
      ["Executive Positioning", "Torque Empire brings together service delivery capability and disciplined technology development. The company is positioned to support government, SOEs and corporate clients where compliance, documentation, operational reliability and digital visibility are critical."],
      ["Procurement", bullets(["Tender tracking and bid support.", "Supplier document control and readiness checks.", "Commercial pack preparation and submission discipline.", "Contractor onboarding support and compliance file structure.", "Procurement workflow visibility through TEOS-aligned operating models."])],
      ["Hygiene", bullets(["Managed hygiene service documentation.", "Waste collection registers, manifests and service reports.", "Compliance-oriented SOPs, registers and audit trails.", "Operational planning for sites, routes, drivers, vehicles and customer reporting."])],
      ["Telecommunications", bullets(["Connectivity and telecoms advisory capability.", "Client-facing assessment of communication needs.", "Supplier and provider coordination.", "Support for operational continuity where communications affect service delivery."])],
      ["Technology", bullets(["TEOS platform strategy and architecture.", "Role-aware portals, workspaces and dashboards.", "Document verification, OCR-readiness and audit-friendly data capture.", "Workflow automation, notifications and controlled reporting.", "Future AI capability governed by human approval and explainability."])],
      ["Compliance", bullets(["Documented controls and registers.", "POPIA-aware information handling principles.", "Least-privilege access and controlled handover expectations.", "Traceable approvals, exceptions and service records.", "Support for auditable management reporting."])],
      ["Operational Excellence", bullets(["Structured runbooks and handover packs.", "Status reporting and escalation discipline.", "Service logs, work registers and implementation checklists.", "Reusable templates for repeatable delivery."])],
      ["Innovation", "Innovation is treated as practical improvement, not experimentation without governance. Torque Empire prioritises controlled pilots, measurable workflows, explainable AI support, and technology that improves service delivery without removing human accountability."],
    ],
  },
  {
    fileBase: "03 - Executive Company Profile",
    title: "Executive Company Profile",
    subtitle: "Board-ready company profile for public sector, investor and corporate engagement.",
    code: "TE-GOV-003",
    sections: [
      ["Company Vision", "To build a durable South African operating group that combines practical service delivery with governed technology, creating systems and services that can support public sector, enterprise and community outcomes at scale."],
      ["Mission", "Torque Empire's mission is to deliver auditable, reliable and technology-enabled services across procurement, hygiene, telecommunications and digital transformation, while building TEOS as a reusable operating platform for multi-workspace business execution."],
      ["Business Strategy", bullets(["Use service delivery divisions to solve real operational problems.", "Use TEOS to standardise workflows, evidence, dashboards and reporting.", "Build trust through documentation, compliance discipline and transparent execution.", "Develop repeatable commercial packs and delivery playbooks for enterprise clients.", "Create long-term value through governed technology investment rather than ad hoc projects."])],
      ["Growth Roadmap", table(["Phase", "Focus", "Outcome"], [["Foundation", "Formalise corporate documents, divisions, service packs and governance.", "Credible market entry and repeatable engagement model."], ["Execution", "Deliver professional services, hygiene operations, procurement support and telecoms advisory.", "Revenue, references and operational evidence."], ["Platform Expansion", "Extend TEOS workflows, workspaces and dashboards across divisions.", "Reusable operating system for multiple service lines."], ["Strategic Partnerships", "Engage government, SOEs, municipalities, investors and corporate clients.", "Scaled opportunities and institutional relationships."]])],
      ["Technology Investment", "Technology investment is focused on TEOS: a governed operating platform for workspaces, roles, tasks, documents, audits, notifications, dashboards and future AI-supported workflows. The platform is designed to make work visible, traceable and supportable."],
      ["Community Impact", bullets(["Support job creation through service delivery, field operations and digital administration.", "Improve small business readiness through procurement and compliance support.", "Strengthen public-sector execution through transparent workflow and reporting tools.", "Create opportunities for youth development in operations, technology and compliance administration."])],
    ],
  },
  {
    fileBase: "04 - Government Meeting Brief",
    title: "Government Meeting Brief",
    subtitle: "Preparation brief for Chadwin Karanie before government and institutional meetings.",
    code: "TE-GOV-004",
    sections: [
      ["Meeting Objectives", bullets(["Introduce Torque Empire professionally and clearly.", "Understand the institution's priorities, procurement rules and current service delivery challenges.", "Identify whether a pilot, partnership or formal tender route is appropriate.", "Position TEOS as a governance and operational visibility platform, not a replacement for public accountability.", "Secure the next practical step: document request, follow-up meeting, site visit, pilot discussion or procurement guidance."])],
      ["How to Introduce Torque Empire", "Torque Empire is a South African company with four operating divisions: procurement, hygiene, telecommunications and technology. We combine practical service delivery with TEOS, our governed operating platform, to help organisations improve compliance, workflow visibility, document control and service execution."],
      ["Questions to Ask", bullets(["What are the current operational or procurement pain points?", "Which compliance records are most difficult to maintain or audit?", "Are there existing systems that must remain in place?", "What procurement route applies for pilot projects or supplier onboarding?", "Who owns digital transformation, operational reporting and compliance oversight?", "What would a successful pilot or partnership need to prove?"])],
      ["Questions Likely to Be Asked", bullets(["What does Torque Empire do?", "What makes TEOS different?", "Do you have public-sector experience?", "How do you protect sensitive information?", "How do you ensure compliance?", "Can you integrate with existing systems?", "What is the commercial model?", "Can you start with a controlled pilot?"])],
      ["Topics to Avoid", bullets(["Do not promise guaranteed awards, savings or outcomes without evidence.", "Do not discuss political alignment or party matters.", "Do not criticise existing officials, suppliers or systems.", "Do not disclose confidential client or platform information.", "Do not overstate AI capability or imply that AI replaces accountable human decisions."])],
      ["Professional Etiquette", bullets(["Arrive prepared with a concise profile and capability statement.", "Listen before presenting solutions.", "Respect procurement rules and formal communication channels.", "Keep language clear, factual and non-political.", "Document next steps and send a professional follow-up email within 24 hours."])],
      ["Meeting Goals", table(["Goal", "Desired Outcome"], [["Credibility", "Stakeholders understand who Torque Empire is and why the company is relevant."], ["Need Discovery", "Pain points, constraints and procurement route are understood."], ["Fit Assessment", "Potential service, pilot or partnership area is identified."], ["Next Step", "A clear follow-up action, owner and timeframe are agreed."]])],
    ],
  },
  {
    fileBase: "05 - Frequently Asked Questions",
    title: "Frequently Asked Questions",
    subtitle: "Prepared responses for government, SOE, investor and corporate discussions.",
    code: "TE-GOV-005",
    sections: [
      ["Why should government work with Torque Empire?", "Torque Empire offers a practical combination of service delivery, compliance discipline and governed technology. The company is positioned to support public institutions that need clearer documentation, better workflow visibility, stronger contractor control and more reliable operational reporting."],
      ["What makes TEOS different?", "TEOS is designed as an operating platform rather than a single-purpose app. It is built around workspaces, roles, auditable records, workflow stages, notifications, dashboards and document control. The architecture treats data integrity and auditability as core product features."],
      ["How do you ensure compliance?", "Compliance is handled through structured records, documented workflows, access control, evidence registers, approval tracking and clear handover documentation. Torque Empire also separates business rules from presentation layers so processes remain explicit and reviewable."],
      ["How do you manage contractors?", "Contractor management can include onboarding records, document requirements, role-based access, workflow tasks, status tracking, notifications, compliance evidence and management dashboards. The intent is to prevent contractor work from becoming undocumented or unmanaged."],
      ["Can TEOS integrate with existing systems?", "Yes, where technically and commercially approved. TEOS is intended to support integration through clear API boundaries, structured records and thin adapters. Existing systems do not need to be replaced if they can remain the system of record or integrate into a governed workflow."],
      ["How do you protect information?", "Torque Empire follows least-privilege access principles, controlled credential handling, separation of public and protected configuration, input validation, security-relevant logging without leaking secrets, and human oversight for sensitive decisions."],
      ["How does your business create value?", "Torque Empire creates value by improving operational clarity, reducing undocumented work, strengthening compliance evidence, supporting service delivery, enabling better management reporting and creating technology foundations that can scale across departments, divisions and clients."],
    ],
  },
  {
    fileBase: "06 - Elevator Pitch",
    title: "Elevator Pitch",
    subtitle: "Short-form introductions for networking, boardroom and public-sector meetings.",
    code: "TE-GOV-006",
    sections: [
      ["30-second version", "Torque Empire is a South African company with four divisions: procurement, hygiene, telecommunications and technology. We help government, SOEs and corporate clients improve compliance, service delivery and operational visibility. Our technology platform, TEOS, supports auditable workflows, document control, dashboards and future AI-assisted decision support."],
      ["60-second version", "Torque Empire combines practical service delivery with governed technology. Our divisions cover procurement, hygiene, telecommunications and technology, allowing us to support both operational execution and digital transformation. Through TEOS, we help organisations structure workflows, manage documents, track contractors, improve compliance visibility and produce clearer executive reporting. We are interested in partnerships where a controlled pilot or defined service engagement can prove value before broader rollout."],
      ["3-minute version", "Torque Empire was built around a simple idea: organisations need both reliable service delivery and technology that makes work visible, auditable and easier to manage. We operate across four divisions: procurement, hygiene, telecommunications and technology. On the technology side, we are building TEOS as a governed operating platform for workspaces, roles, records, documents, dashboards and workflow management. This matters for government and large institutions because many operational problems are not caused by a lack of activity; they are caused by activity that is hard to track, hard to audit and hard to coordinate across teams and suppliers. Our approach is to start with the business process, document the compliance and operational requirements, and then support execution through structured services and technology. We do not position AI as a replacement for accountability. We position it as future decision support that remains explainable, reviewable and subordinate to human approval. For government, municipalities, SOEs and corporate clients, Torque Empire can support procurement readiness, contractor management, hygiene operations, telecommunications coordination, compliance documentation and digital transformation pilots. The ideal next step is a focused discussion on the institution's priorities, followed by a controlled pilot or formal procurement route where value can be measured responsibly."],
    ],
  },
  {
    fileBase: "07 - Director Talking Points",
    title: "Director Talking Points",
    subtitle: "Concise talking points for Chadwin Karanie in executive meetings.",
    code: "TE-GOV-007",
    sections: [
      ["Technology", bullets(["TEOS is being built as a governed operating platform, not a short-term app.", "The platform focuses on roles, workflows, documents, audit trails and dashboards.", "Technology should make service delivery visible and accountable."])],
      ["Innovation", bullets(["Innovation must solve real operational problems.", "AI should support judgement, not replace responsible officials or managers.", "Pilots should be controlled, measurable and aligned to governance."])],
      ["Procurement", bullets(["Procurement success depends on documentation, traceability and supplier readiness.", "Torque Empire can support tender discipline, supplier records and compliance evidence.", "We respect formal procurement processes and do not seek shortcuts."])],
      ["Compliance", bullets(["Compliance must be built into workflow, not added as an afterthought.", "Every important decision should have evidence, owner and status.", "Access control and information protection are part of the delivery model."])],
      ["Operational Efficiency", bullets(["Visibility reduces delay, duplication and unmanaged handoffs.", "Dashboards should support decisions, not create extra administration.", "Structured workflows help managers see what is stuck and who owns the next action."])],
      ["Job Creation", bullets(["Service delivery creates field, admin, compliance and support roles.", "Technology creates opportunities for digital administration and junior technical development.", "Partnerships can create practical training pathways tied to real work."])],
      ["Digital Transformation", bullets(["Digital transformation should start with business process clarity.", "Existing systems can be integrated or complemented where appropriate.", "The goal is better service delivery, auditability and management control."])],
    ],
  },
  {
    fileBase: "08 - Partnership Opportunities",
    title: "Partnership Opportunities",
    subtitle: "Collaboration pathways for government, SOEs and corporate clients.",
    code: "TE-GOV-008",
    sections: [
      ["Municipalities", bullets(["Service delivery workflow pilots.", "Hygiene and facilities service documentation.", "Contractor onboarding and compliance records.", "Ward-level operational reporting dashboards.", "Document registers for inspections, incidents and service completion."])],
      ["Provincial Government", bullets(["Supplier readiness and compliance support programmes.", "Digitised workflow pilots for departments or agencies.", "Operational reporting and document control initiatives.", "Youth training linked to digital administration and compliance operations."])],
      ["National Government", bullets(["Policy-aligned digital transformation pilots.", "Procurement and contractor governance support.", "Reusable workflow models for multi-department programmes.", "Data and document control frameworks aligned to accountability."])],
      ["SOEs", bullets(["Contractor lifecycle management.", "Operational dashboards for service providers and compliance status.", "Document verification and audit trail support.", "Telecommunications and technology coordination for operational sites."])],
      ["Private Sector", bullets(["Corporate procurement support.", "Compliance pack preparation and supplier onboarding.", "Hygiene operations and service reporting.", "Technology consulting, workflow design and TEOS-enabled dashboards."])],
    ],
  },
  {
    fileBase: "09 - Why Partner with Torque Empire",
    title: "Why Partner with Torque Empire",
    subtitle: "Executive case for partnership with public-sector and corporate stakeholders.",
    code: "TE-GOV-009",
    sections: [
      ["Partnership Rationale", "Torque Empire is a practical partner for organisations that need service delivery, compliance discipline and technology-enabled visibility. The company is early enough to be flexible, but structured enough to operate with professional documentation, executive reporting and governance discipline."],
      ["What Makes the Partnership Valuable", bullets(["Four-division model connects services, compliance and technology.", "TEOS creates a pathway from manual operations to auditable digital workflows.", "Documentation packs support board, audit and procurement readiness.", "The company can start with controlled pilots before larger engagements.", "Human accountability remains central to all AI and automation concepts."])],
      ["Value to Government", bullets(["Improved visibility of work, suppliers and evidence.", "Better documentation for compliance and audit purposes.", "Potential youth, contractor and small business enablement.", "Configurable workflows that can respect existing institutional structures."])],
      ["Value to Investors", bullets(["Clear divisional model with technology leverage.", "Reusable platform strategy through TEOS.", "Multiple market entry points across services and software.", "Governance-first positioning suitable for enterprise clients."])],
      ["Value to Corporate Clients", bullets(["Supplier and contractor visibility.", "Operational reporting improvements.", "Compliance document control.", "Professional service packs and structured implementation support."])],
    ],
  },
  {
    fileBase: "10 - Follow-up Email Template",
    title: "Follow-up Email Template",
    subtitle: "Professional follow-up email after networking, meetings and introductions.",
    code: "TE-GOV-010",
    sections: [
      ["Subject Line Options", bullets(["Follow-up: Torque Empire introduction", "Thank you for meeting with Torque Empire", "Torque Empire - follow-up and next steps", "Government engagement follow-up - Torque Empire"])],
      ["Email Template", `<p>Dear [Title and Surname],</p><p>Thank you for taking the time to meet with me and for the opportunity to introduce Torque Empire (Pty) Ltd.</p><p>As discussed, Torque Empire operates across procurement, hygiene, telecommunications and technology. Our technology platform, TEOS, is being developed to support auditable workflows, document control, contractor management, dashboards and future AI-assisted decision support.</p><p>Based on our conversation, the areas that may be most relevant are:</p>${bullets(["[Insert priority area 1]", "[Insert priority area 2]", "[Insert priority area 3]"])}<p>I would appreciate the opportunity to continue the discussion and understand the correct process for any formal engagement, pilot, supplier onboarding or procurement route.</p><p>Please let me know a suitable time for a follow-up discussion, or the correct person to whom we should submit the relevant company profile and capability documents.</p><p>Kind regards,<br>${esc(contact.director)}<br>${esc(company)}<br>${esc(contact.email)}<br>${esc(contact.website)}</p>`],
      ["Attachments to Consider", bullets(["One Page Company Profile", "Corporate Capability Statement", "Executive Company Profile", "Contact Information Sheet"])],
    ],
  },
  {
    fileBase: "11 - Contact Information Sheet",
    title: "Contact Information Sheet",
    subtitle: "Controlled contact and company information for stakeholder exchange.",
    code: "TE-GOV-011",
    sections: [
      ["Company Information", table(["Field", "Details"], [["Registered Name", company], ["Primary Contact", contact.director], ["Email", contact.email], ["Website", contact.website], ["Telephone", contact.phone], ["Country", contact.location], ["Engagement Pack Reference", reference]])],
      ["Divisions", bullets(divisions)],
      ["Primary Engagement Areas", bullets(["Government and municipal service delivery discussions.", "SOE and corporate partnership opportunities.", "Investor and strategic partnership introductions.", "Procurement, hygiene, telecommunications and technology opportunities.", "TEOS platform demonstrations and controlled pilot discussions."])],
      ["Document Control", table(["Document", "Status"], [["Government Engagement Pack", "Official issue"], ["Issue Date", issueDate], ["Prepared By", preparedBy], ["Distribution", "Controlled external distribution"]])],
    ],
  },
  {
    fileBase: "12 - Government Engagement Checklist",
    title: "Government Engagement Checklist",
    subtitle: "Preparation, meeting and follow-up checklist for institutional engagements.",
    code: "TE-GOV-012",
    sections: [
      ["Before the Meeting", bullets(["Confirm stakeholder names, titles and institution.", "Research mandate, current priorities and relevant procurement channels.", "Prepare one-page profile, capability statement and contact sheet.", "Clarify the meeting objective and desired next step.", "Prepare a concise introduction and two or three relevant examples.", "Confirm meeting location, time and protocol."])],
      ["During the Meeting", bullets(["Open professionally and thank the host.", "Introduce Torque Empire in under one minute.", "Ask discovery questions before presenting detailed solutions.", "Take notes on priorities, constraints and procurement process.", "Avoid political commentary and unsupported claims.", "Agree the next step, responsible person and timeframe."])],
      ["After the Meeting", bullets(["Send follow-up email within 24 hours.", "Attach agreed documents only.", "Record the opportunity, stakeholders, next action and deadline.", "Prepare any requested proposal or information pack.", "Follow formal procurement or supplier onboarding instructions."])],
      ["Documents to Carry", table(["Document", "Purpose"], [["One Page Company Profile", "Fast introduction"], ["Corporate Capability Statement", "Capability detail"], ["Executive Company Profile", "Board-level positioning"], ["Contact Information Sheet", "Accurate stakeholder exchange"], ["Government Meeting Brief", "Internal preparation"]])],
      ["Red Flags", bullets(["Request for informal procurement shortcuts.", "Pressure to promise guaranteed results.", "Requests for confidential client or platform information.", "Unclear authority or no formal next step.", "Misalignment with compliance, ethics or procurement rules."])],
    ],
  },
];

function css() {
  return `
    :root { --navy:${brand.navy}; --blue:${brand.blue}; --red:${brand.red}; --slate:${brand.slate}; --pale:${brand.pale}; --line:${brand.line}; --white:${brand.white}; --text:${brand.text}; }
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin:0; padding:0; background:#dfe5ec; color:var(--text); font-family:Arial, Helvetica, sans-serif; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .page { width:210mm; min-height:297mm; margin:0 auto; padding:15mm 14mm 18mm; background:var(--white); position:relative; page-break-after:always; overflow:hidden; }
    .page:last-child { page-break-after:auto; }
    .cover { background:var(--navy); color:var(--white); display:flex; flex-direction:column; justify-content:space-between; }
    .cover:before { content:""; position:absolute; left:0; top:0; width:8mm; height:100%; background:var(--red); }
    .brandline { display:flex; justify-content:space-between; gap:10mm; color:#aebbd0; text-transform:uppercase; letter-spacing:1.3px; font-size:8.6pt; font-weight:800; }
    .cover h1 { color:var(--white); font-size:33pt; line-height:1.05; margin:32mm 0 0; max-width:165mm; letter-spacing:0; }
    .cover .lead { color:#dbe4ef; font-size:13.2pt; line-height:1.42; max-width:160mm; margin-top:6mm; }
    .meta-grid { display:grid; grid-template-columns:repeat(2, 1fr); gap:4mm; max-width:155mm; margin-top:16mm; }
    .meta-box { border:1px solid rgba(255,255,255,.2); background:rgba(255,255,255,.07); border-radius:3mm; padding:4mm; }
    .meta-box strong { display:block; font-size:7.8pt; text-transform:uppercase; letter-spacing:1px; margin-bottom:1.5mm; color:var(--white); }
    .meta-box span { color:#dbe4ef; font-size:9.4pt; }
    .topbar { display:grid; grid-template-columns:1fr auto; gap:8mm; border-bottom:1.35mm solid var(--blue); padding-bottom:4mm; margin-bottom:4.5mm; }
    .wordmark { color:var(--blue); text-transform:uppercase; letter-spacing:1.2px; font-size:8.3pt; font-weight:800; }
    h1, h2, h3, p { margin:0; letter-spacing:0; }
    h1 { color:var(--navy); font-size:23pt; line-height:1.1; margin-top:2mm; }
    h2 { color:var(--blue); font-size:12.6pt; margin:4.8mm 0 2.5mm; border-left:1.25mm solid var(--blue); padding-left:3mm; line-height:1.16; }
    p, li { font-size:9.25pt; line-height:1.46; margin:0 0 2.35mm; }
    ul { margin:0 0 3mm; padding-left:5mm; }
    .docbox { min-width:55mm; border:1px solid var(--line); background:var(--pale); border-radius:2.5mm; padding:3.4mm; font-size:7.8pt; line-height:1.42; color:#344253; }
    .section { break-inside:avoid; }
    table { width:100%; border-collapse:collapse; font-size:7.6pt; margin:2mm 0 4mm; table-layout:fixed; }
    th { background:var(--navy); color:var(--white); text-align:left; padding:2.2mm; border:1px solid var(--navy); text-transform:uppercase; letter-spacing:.5px; font-size:7pt; }
    td { border:1px solid var(--line); padding:2.1mm; vertical-align:top; line-height:1.28; word-wrap:break-word; }
    tr:nth-child(even) td { background:#fafcff; }
    .profile-grid { display:grid; grid-template-columns:1fr 1fr; gap:3.5mm; }
    .profile-card { border:1px solid var(--line); background:var(--pale); border-radius:2.5mm; padding:3.2mm; min-height:26mm; }
    .profile-card h2 { margin-top:0; font-size:11pt; }
    .profile-card p, .profile-card li { font-size:8.35pt; line-height:1.34; }
    .footer { position:absolute; left:14mm; right:14mm; bottom:8.5mm; border-top:1px solid var(--line); padding-top:2.4mm; display:flex; justify-content:space-between; color:#64748b; font-size:7.5pt; }
    .cover .footer { border-color:rgba(255,255,255,.2); color:#aebbd0; }
  `;
}

function renderOnePage(doc) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(doc.fileBase)}</title><style>${css()}</style></head><body>
  <section class="page">
    <div class="topbar">
      <div><div class="wordmark">${esc(company)} | ${esc(packName)}</div><h1>${esc(doc.title)}</h1></div>
      <div class="docbox"><strong>Document Control</strong><br>Code: ${esc(doc.code)}<br>Reference: ${esc(reference)}<br>Date: ${esc(issueDate)}<br>Distribution: Executive external</div>
    </div>
    <div class="profile-grid">
      ${doc.sections.map(([title, body]) => `<div class="profile-card">${section(title, body)}</div>`).join("")}
    </div>
    <div class="footer"><span>${esc(company)}</span><span>${esc(contact.email)} | ${esc(contact.website)}</span></div>
  </section></body></html>`;
}

function renderHtml(doc) {
  if (doc.onePage) return renderOnePage(doc);
  const content = doc.sections.map(([title, body]) => section(title, body)).join("\n");
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(doc.fileBase)}</title><style>${css()}</style></head>
<body>
  <section class="page cover">
    <div>
      <div class="brandline"><span>${esc(company)}</span><span>${esc(packName)}</span></div>
      <h1>${esc(doc.title)}</h1>
      <p class="lead">${esc(doc.subtitle)}</p>
      <div class="meta-grid">
        <div class="meta-box"><strong>Prepared For</strong><span>${esc(preparedFor)}</span></div>
        <div class="meta-box"><strong>Prepared By</strong><span>${esc(preparedBy)}</span></div>
        <div class="meta-box"><strong>Issue Date</strong><span>${esc(issueDate)}</span></div>
        <div class="meta-box"><strong>Document Code</strong><span>${esc(doc.code)}</span></div>
      </div>
    </div>
    <div class="footer"><span>${esc(reference)}</span><span>Executive issue</span></div>
  </section>
  <section class="page">
    <div class="topbar">
      <div><div class="wordmark">${esc(company)} | ${esc(packName)}</div><h1>${esc(doc.title)}</h1></div>
      <div class="docbox"><strong>Document Control</strong><br>Code: ${esc(doc.code)}<br>Reference: ${esc(reference)}<br>Date: ${esc(issueDate)}<br>Distribution: Executive external</div>
    </div>
    ${content}
    <div class="footer"><span>${esc(company)} | ${esc(doc.code)}</span><span>${esc(contact.email)}</span></div>
  </section>
</body>
</html>`;
}

function markdownBodyFor(title, body) {
  if (body.startsWith("<ul>")) return body.replace(/<ul>|<\/ul>/g, "").replace(/<li>/g, "- ").replace(/<\/li>/g, "\n").trim();
  if (body.startsWith("<table>")) {
    if (title === "Growth Roadmap") return mdTable(["Phase", "Focus", "Outcome"], [["Foundation", "Formalise corporate documents, divisions, service packs and governance.", "Credible market entry and repeatable engagement model."], ["Execution", "Deliver professional services, hygiene operations, procurement support and telecoms advisory.", "Revenue, references and operational evidence."], ["Platform Expansion", "Extend TEOS workflows, workspaces and dashboards across divisions.", "Reusable operating system for multiple service lines."], ["Strategic Partnerships", "Engage government, SOEs, municipalities, investors and corporate clients.", "Scaled opportunities and institutional relationships."]]);
    if (title === "Meeting Goals") return mdTable(["Goal", "Desired Outcome"], [["Credibility", "Stakeholders understand who Torque Empire is and why the company is relevant."], ["Need Discovery", "Pain points, constraints and procurement route are understood."], ["Fit Assessment", "Potential service, pilot or partnership area is identified."], ["Next Step", "A clear follow-up action, owner and timeframe are agreed."]]);
    if (title === "Contact Details") return mdTable(["Contact", "Details"], [["Director", contact.director], ["Email", contact.email], ["Website", contact.website], ["Telephone", contact.phone], ["Location", contact.location]]);
    if (title === "Company Information") return mdTable(["Field", "Details"], [["Registered Name", company], ["Primary Contact", contact.director], ["Email", contact.email], ["Website", contact.website], ["Telephone", contact.phone], ["Country", contact.location], ["Engagement Pack Reference", reference]]);
    if (title === "Document Control") return mdTable(["Document", "Status"], [["Government Engagement Pack", "Official issue"], ["Issue Date", issueDate], ["Prepared By", preparedBy], ["Distribution", "Controlled external distribution"]]);
    if (title === "Documents to Carry") return mdTable(["Document", "Purpose"], [["One Page Company Profile", "Fast introduction"], ["Corporate Capability Statement", "Capability detail"], ["Executive Company Profile", "Board-level positioning"], ["Contact Information Sheet", "Accurate stakeholder exchange"], ["Government Meeting Brief", "Internal preparation"]]);
  }
  return plain(body)
    .replace(/\[Insert priority area 1\]\[Insert priority area 2\]\[Insert priority area 3\]/, "\n- [Insert priority area 1]\n- [Insert priority area 2]\n- [Insert priority area 3]\n")
    .trim();
}

function renderMarkdown(doc) {
  return `# ${doc.title}

**Company:** ${company}
**Prepared for:** ${preparedFor}
**Prepared by:** ${preparedBy}
**Issue date:** ${issueDate}
**Reference:** ${reference}
**Document code:** ${doc.code}

${doc.sections.map(([title, body]) => mdSection(title, markdownBodyFor(title, body))).join("\n\n")}
`;
}

function contentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="html" ContentType="text/html"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
}

function relsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
}

function coreXml(doc) {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(doc.title)}</dc:title><dc:subject>${esc(doc.subtitle)}</dc:subject><dc:creator>${esc(preparedBy)}</dc:creator><cp:lastModifiedBy>${esc(preparedBy)}</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
}

function appXml(doc) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Torque Empire Document Builder</Application><TitlesOfParts><vt:vector size="1" baseType="lpstr"><vt:lpstr>${esc(doc.title)}</vt:lpstr></vt:vector></TitlesOfParts></Properties>`;
}

function documentXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" mc:Ignorable=""><w:body><w:altChunk r:id="rId1"/><w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="850" w:right="800" w:bottom="850" w:left="800" w:header="500" w:footer="500" w:gutter="0"/><w:headerReference w:type="default" r:id="rId2"/><w:footerReference w:type="default" r:id="rId3"/></w:sectPr></w:body></w:document>`;
}

function documentRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/aFChunk" Target="afchunk.html"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>`;
}

function headerXml(doc) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="0B2F57"/><w:sz w:val="18"/></w:rPr><w:t>${esc(company)} - ${esc(doc.title)}</w:t></w:r></w:p></w:hdr>`;
}

function footerXml(doc) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:sz w:val="14"/></w:rPr><w:t>${esc(reference)} - ${esc(doc.code)} - Page </w:t></w:r><w:fldSimple w:instr=" PAGE "><w:r><w:t>1</w:t></w:r></w:fldSimple><w:r><w:t> of </w:t></w:r><w:fldSimple w:instr=" NUMPAGES "><w:r><w:t>1</w:t></w:r></w:fldSimple></w:p></w:ftr>`;
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
  await fs.writeFile(outputPath, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
}

async function writePdf(browser, doc, html, outputPath) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1900 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "load" });
  await page.pdf({ path: outputPath, format: "A4", printBackground: true, preferCSSPageSize: true, margin: { top: "0", right: "0", bottom: "0", left: "0" } });
  await page.close();

  const pdfBytes = await fs.readFile(outputPath);
  const pdf = await PDFDocument.load(pdfBytes);
  pdf.setTitle(`${doc.fileBase} - ${company}`);
  pdf.setSubject(doc.subtitle);
  pdf.setAuthor(preparedBy);
  pdf.setCreator("Torque Empire Government Engagement Pack Builder");
  pdf.setProducer("Torque Empire Government Engagement Pack Builder");
  pdf.setKeywords([company, "Government Engagement", "Municipalities", "SOEs", "Investors", "Corporate Clients", "TEOS"]);
  const info = pdf.getInfoDict();
  info.set(PDFName.of("Company"), PDFString.of(company));
  info.set(PDFName.of("DocumentReference"), PDFString.of(reference));
  await fs.writeFile(outputPath, await pdf.save());
}

async function writeManifest(generatedFiles) {
  const manifest = {
    packName,
    reference,
    issueDate,
    company,
    preparedFor,
    preparedBy,
    contact,
    divisions,
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
      const paths = {
        html: path.join(packRoot, `${doc.fileBase}.html`),
        md: path.join(packRoot, `${doc.fileBase}.md`),
        docx: path.join(packRoot, `${doc.fileBase}.docx`),
        pdf: path.join(packRoot, `${doc.fileBase}.pdf`),
      };
      await fs.writeFile(paths.html, html, "utf8");
      await fs.writeFile(paths.md, markdown, "utf8");
      await writeDocx(doc, html, paths.docx);
      await writePdf(browser, doc, html, paths.pdf);
      generatedFiles.push(`${doc.fileBase}.html`, `${doc.fileBase}.md`, `${doc.fileBase}.docx`, `${doc.fileBase}.pdf`);
    }
  } finally {
    await browser.close();
  }

  const readme = `# ${packName}

Official executive engagement pack for meetings with government, municipalities, state owned enterprises, investors and corporate clients.

## Issue Details

- Company: ${company}
- Reference: ${reference}
- Issue date: ${issueDate}
- Prepared by: ${preparedBy}

## Documents

${docs.map((doc) => `- ${doc.fileBase}.docx / ${doc.fileBase}.pdf / ${doc.fileBase}.md / ${doc.fileBase}.html`).join("\n")}
`;
  await fs.writeFile(path.join(packRoot, "README.md"), readme, "utf8");
  generatedFiles.push("README.md");

  const changelog = `# Changelog

## 1.0.0 - ${issueDate}

- Created the official Torque Empire Government Engagement Pack.
- Generated DOCX, PDF, Markdown and HTML outputs for all twelve engagement documents.
- Added manifest, README and changelog.
- Structured content for government, municipality, SOE, investor and corporate meetings.
`;
  await fs.writeFile(path.join(packRoot, "CHANGELOG.md"), changelog, "utf8");
  generatedFiles.push("CHANGELOG.md");

  await writeManifest([...generatedFiles, "manifest.json"]);
  generatedFiles.push("manifest.json");

  console.log(`Generated ${packName} at ${packRoot}`);
  for (const file of generatedFiles) console.log(file);
}

await main();
