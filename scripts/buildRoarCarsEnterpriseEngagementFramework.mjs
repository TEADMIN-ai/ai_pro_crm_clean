import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { PDFDocument, PDFName, PDFString } from "pdf-lib";

const root = process.cwd();
const distDir = path.join(root, "dist");
const sourceBoardDir = path.join(distDir, "Roar Cars SA - Board Submission");
const engagementRoot = path.join(distDir, "Roar Cars SA - Enterprise Engagement");
const boardDir = path.join(engagementRoot, "Board Submission");
const communicationsDir = path.join(engagementRoot, "communications");
const commercialDir = path.join(engagementRoot, "commercial");
const implementationDir = path.join(engagementRoot, "implementation");
const onboardingDir = path.join(engagementRoot, "client-onboarding");
const playbookDir = path.join(engagementRoot, "playbook");
const archiveDir = path.join(engagementRoot, "Archive");

const clientName = "Roar Cars SA";
const preparedBy = "Torque Empire (Pty) Ltd";
const issueDate = "2 July 2026";
const creator = "Torque Empire Executive Publications";

const navy = "#07111f";
const navy2 = "#101d2d";
const steel = "#40515e";
const charcoal = "#2b2f33";
const red = "#c1121f";
const blue = "#1f6feb";
const pale = "#f4f6f8";
const line = "#d9dee5";
const white = "#ffffff";
const text = "#23313f";

const browser = await chromium.launch({ headless: true });

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function copyTree(src, dest) {
  await fs.cp(src, dest, { recursive: true });
}

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

function cards(items, cols = 2) {
  return `<div class="grid cols-${cols}">${items
    .map(
      (item) => `<div class="card">
        <h3>${esc(item.title)}</h3>
        <p>${esc(item.text)}</p>
      </div>`,
    )
    .join("")}</div>`;
}

function table(headers, rows, className = "") {
  return `<div class="table-wrap ${className}"><table>
    <thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
    <tbody>
      ${rows
        .map(
          (row) =>
            `<tr>${row
              .map((cell) => `<td>${Array.isArray(cell) ? bullets(cell) : esc(cell)}</td>`)
              .join("")}</tr>`,
        )
        .join("")}
    </tbody>
  </table></div>`;
}

function checklist(items) {
  return `<div class="checklist">${items
    .map((item) => `<div class="check-item"><span class="box"></span><span>${esc(item)}</span></div>`)
    .join("")}</div>`;
}

function pageShell({ theme = "light", kicker, title, subtitle = "", body, footerLeft, footerRight }) {
  return `<section class="page ${theme}">
    <div class="page-inner">
      <div>
        <div class="brand-bar"><span>Torque Empire</span><span>${esc(clientName)}</span></div>
        ${kicker ? `<div class="kicker">${esc(kicker)}</div>` : ""}
        <h1>${esc(title)}</h1>
        ${subtitle ? `<p class="lead">${esc(subtitle)}</p>` : ""}
      </div>
      <div class="body-block">${body}</div>
    </div>
    <div class="footer"><span>${esc(footerLeft || `${clientName} - ${title}`)}</span><span>${esc(footerRight || "")}</span></div>
  </section>`;
}

function coverPage({ kicker, title, subtitle, meta }) {
  return `<section class="page dark cover">
    <div class="hero-glow"></div>
    <div class="page-inner hero-inner">
      <div>
        <div class="kicker">${esc(kicker)}</div>
        <div class="rule"></div>
        <h1>${esc(title)}</h1>
        <p class="lead">${esc(subtitle)}</p>
      </div>
      <div class="meta-grid">
        ${meta
          .map(
            (item) => `<div class="meta-box">
              <strong>${esc(item.label)}</strong>
              <span>${esc(item.value)}</span>
            </div>`,
          )
          .join("")}
      </div>
    </div>
    <div class="footer footer-dark"><span>${esc(preparedBy)}</span><span>1</span></div>
  </section>`;
}

function wrapHtml(title, pages) {
  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${esc(title)}</title>
      <style>
        :root {
          --navy: ${navy};
          --navy2: ${navy2};
          --steel: ${steel};
          --charcoal: ${charcoal};
          --red: ${red};
          --blue: ${blue};
          --pale: ${pale};
          --line: ${line};
          --white: ${white};
          --text: ${text};
        }
        @page { size: A4; margin: 0; }
        * { box-sizing: border-box; }
        html, body {
          margin: 0;
          padding: 0;
          background: #dfe4ea;
          color: var(--text);
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
          page-break-after: always;
          overflow: hidden;
        }
        .page:last-child { page-break-after: auto; }
        .dark { background: var(--navy); color: var(--white); }
        .page-inner {
          position: relative;
          z-index: 1;
          min-height: 261mm;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .hero-inner { min-height: 261mm; }
        .hero-glow {
          position: absolute;
          inset: 0;
          background: var(--navy);
        }
        .brand-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: #91a1b4;
          text-transform: uppercase;
          letter-spacing: 1.6px;
          font-size: 8pt;
          font-weight: 700;
        }
        .dark .brand-bar { color: rgba(255,255,255,.62); }
        .kicker {
          margin-top: 10mm;
          color: var(--red);
          text-transform: uppercase;
          letter-spacing: 2px;
          font-size: 9pt;
          font-weight: 800;
        }
        .rule { width: 24mm; height: 1.5mm; background: var(--red); margin: 7mm 0 8mm; }
        h1, h2, h3, p { margin: 0; }
        h1 { font-size: 36pt; line-height: 1.06; max-width: 164mm; letter-spacing: 0; }
        h2 { font-size: 24pt; line-height: 1.08; color: var(--navy); letter-spacing: 0; }
        h3 { font-size: 12.5pt; line-height: 1.1; color: var(--navy); }
        .dark h2, .dark h3 { color: var(--white); }
        p { color: #283644; font-size: 10.5pt; line-height: 1.55; }
        .dark p { color: rgba(255,255,255,.84); }
        .lead { font-size: 14pt; max-width: 158mm; line-height: 1.45; margin-top: 8mm; }
        .body-block { margin-top: 10mm; }
        .grid { display: grid; gap: 5mm; }
        .cols-2 { grid-template-columns: repeat(2, 1fr); }
        .cols-3 { grid-template-columns: repeat(3, 1fr); }
        .cols-4 { grid-template-columns: repeat(4, 1fr); }
        .card, .panel {
          border: 1px solid var(--line);
          border-radius: 4mm;
          background: var(--white);
          padding: 5.5mm;
        }
        .dark .card, .dark .panel {
          background: rgba(255,255,255,.07);
          border-color: rgba(255,255,255,.16);
        }
        .card p, .panel p { margin-top: 3mm; }
        .note {
          border-left: 1.8mm solid var(--red);
          background: var(--pale);
          padding: 4mm 5mm;
          border-radius: 3mm;
        }
        .dark .note { background: rgba(255,255,255,.08); }
        .table-wrap { border: 1px solid var(--line); border-radius: 4mm; overflow: hidden; background: var(--white); }
        table { width: 100%; border-collapse: collapse; }
        th { background: var(--navy); color: var(--white); text-align: left; padding: 3mm; font-size: 8.2pt; text-transform: uppercase; letter-spacing: .7px; }
        td { border-top: 1px solid var(--line); vertical-align: top; padding: 3mm; font-size: 9.4pt; line-height: 1.42; color: #25333f; }
        .dark .table-wrap { border-color: rgba(255,255,255,.16); background: rgba(255,255,255,.05); }
        .dark th { background: rgba(255,255,255,.12); }
        .dark td { color: rgba(255,255,255,.88); border-top-color: rgba(255,255,255,.14); }
        .checklist { display: grid; gap: 3.2mm; }
        .check-item { display: grid; grid-template-columns: 5mm 1fr; gap: 3mm; align-items: start; font-size: 9.7pt; line-height: 1.4; }
        .box { width: 5mm; height: 5mm; border: 1px solid var(--steel); margin-top: .8mm; }
        .meta-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 4mm 7mm;
          max-width: 118mm;
        }
        .meta-box {
          border-top: 1px solid rgba(255,255,255,.28);
          padding-top: 2.8mm;
        }
        .meta-box strong {
          display: block;
          color: var(--white);
          font-size: 8pt;
          text-transform: uppercase;
          letter-spacing: 1.1px;
          margin-bottom: 1mm;
        }
        .meta-box span { color: rgba(255,255,255,.84); font-size: 10pt; }
        .footer {
          position: absolute;
          left: 18mm;
          right: 18mm;
          bottom: 9mm;
          border-top: 1px solid var(--line);
          padding-top: 3mm;
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: #738193;
          font-size: 8pt;
        }
        .footer-dark { border-top-color: rgba(255,255,255,.18); color: rgba(255,255,255,.58); }
        .spacer-sm { height: 4mm; }
        .spacer { height: 7mm; }
        .signature-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8mm; }
        .signature-line { border-bottom: 1px solid #aab3bd; height: 13mm; }
        .pill {
          display: inline-flex;
          padding: 2.2mm 4mm;
          border-radius: 99px;
          background: rgba(193,18,31,.1);
          color: var(--red);
          font-size: 8.3pt;
          font-weight: 800;
          text-transform: uppercase;
        }
        .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; }
        .summary-box {
          border: 1px solid var(--line);
          border-radius: 4mm;
          padding: 4.5mm;
          background: var(--pale);
        }
        .summary-box strong {
          display: block;
          text-transform: uppercase;
          letter-spacing: 1px;
          font-size: 8pt;
          color: #6b7785;
          margin-bottom: 2mm;
        }
        .summary-box span { font-size: 11pt; color: var(--navy); font-weight: 700; }
        .dark .summary-box { background: rgba(255,255,255,.08); border-color: rgba(255,255,255,.12); }
        .dark .summary-box strong { color: rgba(255,255,255,.62); }
        .dark .summary-box span { color: var(--white); }
        .stage-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 5mm; }
        .stage-card { border: 1px solid var(--line); border-radius: 4mm; padding: 5mm; background: var(--white); }
        .stage-card h3 { margin-bottom: 2.5mm; }
        .stage-card ul { margin: 0; padding-left: 5mm; color: #263442; font-size: 9.5pt; line-height: 1.4; }
        .stage-card li { margin-bottom: 1.4mm; }
        .dark .stage-card { background: rgba(255,255,255,.06); border-color: rgba(255,255,255,.14); }
        .dark .stage-card ul { color: rgba(255,255,255,.86); }
      </style>
    </head>
    <body>
      ${pages.join("")}
    </body>
  </html>`;
}

async function renderPdf(title, html, outputPath, metadata) {
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
  const doc = await PDFDocument.load(pdfBytes);
  doc.setTitle(metadata.title || title);
  if (metadata.subject) doc.setSubject(metadata.subject);
  if (metadata.author) doc.setAuthor(metadata.author);
  if (metadata.keywords) doc.setKeywords(metadata.keywords);
  if (metadata.creator) doc.setCreator(metadata.creator);
  doc.setProducer(creator);
  const info = doc.getInfoDict();
  info.set(PDFName.of("Company"), PDFString.of(preparedBy));
  const finalBytes = await doc.save();
  await fs.writeFile(outputPath, finalBytes);
}

function buildDocumentPages(pages, title) {
  return pages
    .map((pageDef, index) =>
      pageDef.cover
        ? coverPage(pageDef)
        : pageShell({
            ...pageDef,
            footerLeft: pageDef.footerLeft || `${clientName} - ${title}`,
            footerRight: pageDef.footerRight || String(index + 1),
          }),
    )
    .join("");
}

async function writeMarkdown(relativePath, content) {
  const fullPath = path.join(engagementRoot, relativePath);
  await ensureDir(path.dirname(fullPath));
  await fs.writeFile(fullPath, content, "utf8");
}

async function buildCommunications() {
  await writeMarkdown(
    "communications/01 - WhatsApp Introduction.md",
    `# WhatsApp Introduction

Good day, Board Secretariat.

The Executive Technology Transformation Strategy for ${clientName} has completed internal review and is now ready for board distribution.

The publication has been prepared for executive consideration and can be shared when convenient. It is intended to support a respectful, controlled board discussion and to keep the process clear for all parties.

Kind regards
Torque Empire Executive Office

## Configurable fields
- Date and time of send
- Recipient name or group
- Reference number
`,
  );

  await writeMarkdown(
    "communications/02 - Executive Board Email.md",
    `# Executive Board Email

**Subject:** Official Board Submission - Executive Technology Transformation Strategy

Dear Board Members,

Please find attached the official board submission package for ${clientName}.

The material has been prepared for executive review and discussion. It includes the Executive Strategy as the centrepiece, together with the supporting commercial and engagement documents required for a controlled board process.

The submission is intended to be read as an executive working pack rather than a sales communication. The tone, structure and document control follow the Torque Empire publication standard.

Kind regards

Torque Empire Executive Office

## Configurable fields
- Recipient list
- Send date
- Reference number
`,
  );

  await writeMarkdown(
    "communications/03 - Follow-up Email.md",
    `# Follow-up Email

**Subject:** Follow-up on Executive Board Submission

Dear Board Members,

I am following up on the executive submission issued for ${clientName}.

The package is ready for discussion whenever the Board is comfortable to proceed. There is no urgency implied in this note; it is simply intended to keep the process open and well organised.

If any additional supporting material would help the Board's review, we will provide it promptly.

Kind regards

Torque Empire Executive Office

## Configurable fields
- Follow-up date
- Recipient list
- Reference number
`,
  );

  await writeMarkdown(
    "communications/04 - Meeting Confirmation.md",
    `# Meeting Confirmation

Dear Board Secretariat,

Thank you for arranging the board discussion for ${clientName}.

This note confirms the meeting as an executive session focused on the Technology Transformation Strategy, the supporting commercial framework and the decision path for the next phase of work.

We will attend prepared with the strategy pack, the supporting board notes and the commercial options. The meeting format will remain concise, respectful and decision-oriented.

## Configurable fields
- Meeting date
- Meeting time
- Meeting venue or platform
- Attendee list
`,
  );

  await writeMarkdown(
    "communications/05 - Thank You Letter.md",
    `# Thank You Letter

Dear Board of Directors,

Thank you for the time and attention given to the executive submission for ${clientName}.

We value the opportunity to support a disciplined board process and appreciate the care taken in reviewing the proposal. The material has been prepared to support clear decision-making, a controlled implementation path and a long-term enterprise relationship.

Kind regards

Torque Empire (Pty) Ltd

## Configurable fields
- Date
- Reference number
- Signatory name
`,
  );
}

function questionCards(items) {
  return `<div class="grid cols-2">${items
    .map(
      (item) => `<div class="card">
        <h3>${esc(item.q)}</h3>
        <p>${esc(item.a)}</p>
      </div>`,
    )
    .join("")}</div>`;
}

function phasePage(phase) {
  return pageShell({
    kicker: "Implementation Roadmap",
    title: phase.name,
    subtitle: phase.summary,
    body: `<div class="grid cols-3">
      <div class="stage-card">
        <h3>Objectives</h3>
        ${bullets(phase.objectives)}
      </div>
      <div class="stage-card">
        <h3>Deliverables</h3>
        ${bullets(phase.deliverables)}
      </div>
      <div class="stage-card">
        <h3>Responsibilities</h3>
        ${bullets(phase.responsibilities)}
      </div>
      <div class="stage-card">
        <h3>Dependencies</h3>
        ${bullets(phase.dependencies)}
      </div>
      <div class="stage-card">
        <h3>Acceptance Criteria</h3>
        ${bullets(phase.acceptance)}
      </div>
      <div class="stage-card">
        <h3>Risks and Mitigations</h3>
        ${bullets(phase.risks)}
        <div class="spacer-sm"></div>
        ${bullets(phase.mitigations)}
      </div>
    </div>`,
    footerLeft: `${clientName} - Implementation Roadmap`,
  });
}

async function buildBoardDocs() {
  const agendaPages = [
    coverPage({
      kicker: "Board Meeting Pack",
      title: "Meeting Agenda",
      subtitle:
        "A concise board agenda for the executive discussion of the Roar Cars SA Technology Transformation Strategy.",
      meta: [
        { label: "Prepared for", value: clientName },
        { label: "Prepared by", value: preparedBy },
        { label: "Issue date", value: issueDate },
        { label: "Purpose", value: "Executive board discussion and decision support" },
      ],
    }),
    pageShell({
      kicker: "Meeting Flow",
      title: "Agenda and Decision Path",
      subtitle:
        "The meeting should stay focused on executive control, implementation confidence and the commercial model that best supports the Board's decision.",
      body:
        table(
          ["Agenda Item", "Purpose", "Expected Output"],
          [
            ["Opening and context", "Confirm the purpose of the meeting and the release baseline.", "Shared starting point"],
            ["Strategy overview", "Summarise the operating model, security posture and AI direction.", "Strategic alignment"],
            ["Board questions", "Address governance, data protection, delivery and support.", "Decision confidence"],
            ["Commercial framing", "Compare the implementation models without pricing pressure.", "Preferred model direction"],
            ["Decision and next steps", "Confirm the path forward, owners and timing.", "Clear action register"],
          ],
        ) +
        `<div class="summary-grid" style="margin-top:5mm">
          <div class="summary-box"><strong>Meeting tone</strong><span>Executive, respectful and controlled</span></div>
          <div class="summary-box"><strong>Primary outcome</strong><span>Board direction and approval path</span></div>
          <div class="summary-box"><strong>Supporting pack</strong><span>Strategy, notes, guide, Q&A and register</span></div>
        </div>`,
      footerLeft: `${clientName} - Meeting Agenda`,
    }),
  ];

  const presenterNotesPages = [
    coverPage({
      kicker: "Board Meeting Pack",
      title: "Presenter Notes",
      subtitle:
        "Board-facing notes for a disciplined executive presentation. The notes are structured to support calm delivery, clear governance and no sales language.",
      meta: [
        { label: "Audience", value: "Board of Directors" },
        { label: "Presenter", value: preparedBy },
        { label: "Tone", value: "Executive and relationship-focused" },
        { label: "Use", value: "Talk track for the board discussion" },
      ],
    }),
    pageShell({
      kicker: "Opening",
      title: "Opening Narrative",
      subtitle:
        "Lead with the objective, not the technology. The Board should hear the proposal as an operating control decision with a clear commercial path.",
      body: cards([
        {
          title: "Start point",
          text: "The strategy has completed internal review and is ready for official board discussion.",
        },
        {
          title: "Reason for change",
          text: "The existing environment needs stronger control, clearer support and a path to scalable transformation.",
        },
        {
          title: "Message discipline",
          text: "Keep the presentation factual, respectful and concise. Avoid promotional language.",
        },
        {
          title: "Board expectation",
          text: "The Board should leave with a clear view of the operating model, the risk posture and the decision path.",
        },
      ]),
    }),
    pageShell({
      kicker: "Delivery",
      title: "Delivery and Control Notes",
      subtitle:
        "Use these notes to explain the implementation approach, how data will be protected and how support will continue after Phase 1.",
      body: cards([
        {
          title: "Implementation",
          text: "Phase 1 should be managed in short, controlled steps with clear acceptance points.",
        },
        {
          title: "Data protection",
          text: "Access control, least-privilege permissions, logging and backup discipline are non-negotiable.",
        },
        {
          title: "Support model",
          text: "Support should move from project delivery into managed continuity with defined response expectations.",
        },
        {
          title: "What success looks like",
          text: "The Board sees a stable platform, transparent delivery and a framework that can scale for future clients.",
        },
      ]),
    }),
  ];

  const discussionGuidePages = [
    coverPage({
      kicker: "Board Meeting Pack",
      title: "Board Discussion Guide",
      subtitle:
        "A controlled discussion guide that helps the Board focus on the real decision points without drifting into unnecessary detail.",
      meta: [
        { label: "Purpose", value: "Structure the board conversation" },
        { label: "Style", value: "Executive and practical" },
        { label: "Prepared by", value: preparedBy },
        { label: "Client", value: clientName },
      ],
    }),
    pageShell({
      kicker: "Discussion Themes",
      title: "Topics to Keep in View",
      subtitle:
        "These themes help keep the board session disciplined and oriented to executive decisions.",
      body: cards([
        {
          title: "Governance",
          text: "Confirm ownership, authority and escalation paths before implementation begins.",
        },
        {
          title: "Data",
          text: "Clarify where data lives, who can access it and how it will be protected.",
        },
        {
          title: "Delivery",
          text: "Discuss pace, dependencies and the control gates that prevent rushed implementation.",
        },
        {
          title: "Support",
          text: "Explain the handover from project delivery to managed services or long-term partnership.",
        },
      ]),
    }),
    pageShell({
      kicker: "Preferred Responses",
      title: "How to Respond in the Room",
      subtitle:
        "Answer directly, avoid speculative detail and keep the discussion anchored to what the Board needs to approve.",
      body: table(
        ["Board Concern", "Preferred Response"],
        [
          ["Why now?", "The platform and governance need a controlled path before further operational complexity is added."],
          ["Why Torque Empire?", "The relationship combines strategic communication, delivery discipline and long-term support thinking."],
          ["Why VPS?", "The architecture needs a stable, controllable foundation that can be managed responsibly."],
          ["Why AI?", "AI is introduced as a sequenced capability, not as a shortcut or a replacement for control."],
          ["What happens after Phase 1?", "The platform moves into support, review and optional expansion once the baseline is stable."],
        ],
      ),
    }),
  ];

  const qnaPages = [
    coverPage({
      kicker: "Board Meeting Pack",
      title: "Executive Questions and Answers",
      subtitle:
        "Likely board questions with concise, executive responses prepared for the Roar Cars SA discussion.",
      meta: [
        { label: "Purpose", value: "Decision support" },
        { label: "Tone", value: "Direct and respectful" },
        { label: "Prepared for", value: clientName },
        { label: "Use", value: "Board discussion reference" },
      ],
    }),
    pageShell({
      kicker: "Questions",
      title: "Board Questions",
      subtitle:
        "Keep each answer short, factual and consistent with the published strategy.",
      body: questionCards([
        {
          q: "Why Torque Empire?",
          a: "Torque Empire combines executive communication, delivery discipline and a framework that can be reused for future enterprise clients.",
        },
        {
          q: "Why now?",
          a: "The current environment needs a controlled operating baseline before more complexity is added.",
        },
        {
          q: "Why VPS?",
          a: "A stable virtual private environment gives the platform a controlled base for security, deployment and support.",
        },
        {
          q: "Why AI?",
          a: "AI is used to strengthen verification, prioritisation and insight after the control baseline is in place.",
        },
      ]),
    }),
    pageShell({
      kicker: "More Questions",
      title: "Delivery, Protection and Support",
      subtitle:
        "These answers should reassure the Board that implementation is sequenced, data is protected and support is clear.",
      body: questionCards([
        {
          q: "How will implementation work?",
          a: "Implementation will be delivered in controlled phases with clear acceptance gates and regular review points.",
        },
        {
          q: "How will data be protected?",
          a: "Access control, encryption, logging, backups and least-privilege administration are built into the operating model.",
        },
        {
          q: "How long will Phase 1 take?",
          a: "The duration should be confirmed in the engagement plan, with the board briefing focused on scope and sequencing rather than a fixed promise.",
        },
        {
          q: "How will support work?",
          a: "Support moves into a defined managed model with response expectations, reporting and escalation discipline.",
        },
      ]),
    }),
    pageShell({
      kicker: "Commercial Direction",
      title: "Commercial and Future State",
      subtitle:
        "The commercial model should be presented as an option set, not as pressure. The board decides the right operating model.",
      body: questionCards([
        {
          q: "What happens after Phase 1?",
          a: "The platform stabilises first, then moves into managed support and improvement if the Board approves the next stage.",
        },
        {
          q: "What commercial model is recommended?",
          a: "Option B usually offers the best balance between controlled implementation and ongoing support, while Option C suits a longer-term partnership view.",
        },
        {
          q: "Can the model be reused for future clients?",
          a: "Yes. The framework is designed as a reusable enterprise engagement standard with configurable fields only.",
        },
        {
          q: "How do we avoid overcommitting?",
          a: "By keeping Phase 1 bounded, preserving governance discipline and sequencing any broader expansion only after success is proven.",
        },
      ]),
    }),
  ];

  const decisionRegisterPages = [
    coverPage({
      kicker: "Board Meeting Pack",
      title: "Decision Register",
      subtitle:
        "A controlled decision log for board approval, commercial direction and next-step ownership.",
      meta: [
        { label: "Use", value: "Record board decisions" },
        { label: "Prepared by", value: preparedBy },
        { label: "Client", value: clientName },
        { label: "Control", value: "Confidential executive record" },
      ],
    }),
    pageShell({
      kicker: "Decision Log",
      title: "Board Decision Points",
      subtitle:
        "Capture only the decisions that matter to release, funding, implementation and support.",
      body: table(
        ["Decision Area", "Board Input Required", "Owner", "Status"],
        [
          ["Proceed with executive issue", "Confirm the package is the official board baseline", "Board", "Open"],
          ["Implementation model", "Select the preferred delivery and support structure", "Board / Torque Empire", "Open"],
          ["Data governance", "Approve control expectations and access discipline", "Board / Operations", "Open"],
          ["Phase 1 authority", "Approve the scope and start condition for Phase 1", "Board", "Open"],
          ["Support model", "Confirm the post-launch support arrangement", "Board / Torque Empire", "Open"],
        ],
      ),
    }),
  ];

  const commercialPages = [
    coverPage({
      kicker: "Commercial Strategy",
      title: "Commercial Strategy",
      subtitle:
        "Three implementation models for the Roar Cars SA engagement. Pricing is intentionally left configurable so the Board can focus on the operating model.",
      meta: [
        { label: "Prepared for", value: clientName },
        { label: "Prepared by", value: preparedBy },
        { label: "Commercial status", value: "Configurable and reusable" },
        { label: "Scope", value: "Implementation, support and partnership options" },
      ],
    }),
    pageShell({
      kicker: "Model Comparison",
      title: "Implementation Models",
      subtitle:
        "Each model is designed to be clear, reusable and easy for future clients to adapt by changing the configurable fields only.",
      body: table(
        ["Option", "Structure", "Support", "Best Fit"],
        [
          [
            "Option A - Project Delivery",
            "One-time implementation with a defined project end point",
            "Transition support can be added separately",
            "Boards that want a contained project engagement",
          ],
          [
            "Option B - Implementation + Managed Services",
            "Implementation followed by recurring support and oversight",
            "Ongoing operational support and reporting",
            "Clients that want implementation plus continuity",
          ],
          [
            "Option C - Strategic Technology Partnership",
            "Long-term roadmap, managed services and continuous improvement",
            "Extended support with AI expansion potential",
            "Clients looking for a multi-year enterprise relationship",
          ],
        ],
      ),
    }),
    pageShell({
      kicker: "Option A",
      title: "Project Delivery",
      subtitle: "A bounded project model for a one-time implementation with clear handover.",
      body: cards([
        { title: "Scope", text: "Defined implementation work delivered to an agreed release point." },
        { title: "Commercial shape", text: "One-off project fee with optional add-ons for support or extensions." },
        { title: "Benefits", text: "Simple to approve, easy to govern and suitable for a contained engagement." },
        { title: "Consideration", text: "Post-launch support must be arranged separately if the Board wants continuity." },
      ]),
    }),
    pageShell({
      kicker: "Option B",
      title: "Implementation Plus Managed Services",
      subtitle: "A balanced model that combines project delivery with structured monthly support.",
      body: cards([
        { title: "Scope", text: "Implementation is followed by a managed support arrangement and reporting cadence." },
        { title: "Commercial shape", text: "Initial project fee plus configurable monthly service terms." },
        { title: "Benefits", text: "The Board gets continuity, operational visibility and a clear service relationship." },
        { title: "Consideration", text: "Requires a disciplined support definition so expectations remain controlled." },
      ]),
    }),
    pageShell({
      kicker: "Option C",
      title: "Strategic Technology Partnership",
      subtitle:
        "A long-term model for continuous improvement, managed services and sequenced AI expansion.",
      body: cards([
        { title: "Scope", text: "Implementation forms the first stage of a longer enterprise relationship." },
        { title: "Commercial shape", text: "Recurring services with configurable roadmap milestones and support tiers." },
        { title: "Benefits", text: "Best for a board that wants ongoing strategic support and future innovation." },
        { title: "Consideration", text: "Requires strong governance, regular reviews and shared roadmap discipline." },
      ]),
    }),
    pageShell({
      kicker: "Decision Guidance",
      title: "Recommended Framing",
      subtitle:
        "Present the three options neutrally. Let the Board choose the level of commitment that matches its appetite for continuity and growth.",
      body: `<div class="note">
        <p><strong>Positioning rule:</strong> no pricing pressure, no hard sell and no inflated claims.</p>
        <p style="margin-top:3mm">The commercial pack should simply make the operating choices understandable. Pricing remains configurable and can be completed once the Board confirms the direction.</p>
      </div>
      <div class="spacer"></div>
      ${table(["Configurable field", "Typical change"], [
        ["Client name", "Replaced for each engagement"],
        ["Reference", "Updated per board submission"],
        ["Dates", "Adjusted to the client timetable"],
        ["Pricing", "Entered only after commercial approval"],
      ])}`,
    }),
  ];

  const implementationPhases = [
    {
      name: "Discovery",
      summary: "Confirm the current state, stakeholders and the execution baseline.",
      objectives: [
        "Validate scope, participants and decision path",
        "Capture the current operating state and key dependencies",
        "Agree the success criteria before delivery begins",
      ],
      deliverables: [
        "Discovery notes",
        "Stakeholder map",
        "Baseline summary",
        "Initial risk register",
      ],
      responsibilities: [
        "Torque Empire facilitates workshops and baseline capture",
        `${clientName} provides access to stakeholders and source material`,
        "Both parties confirm the release scope",
      ],
      dependencies: [
        "Stakeholder availability",
        "Approved contacts",
        "Access to current documents and systems",
      ],
      acceptance: [
        "Scope is aligned",
        "Baseline is documented",
        "Go-forward assumptions are approved",
      ],
      risks: [
        "Risk: incomplete information can delay planning",
      ],
      mitigations: [
        "Mitigation: use a structured request list and a fixed follow-up cadence",
      ],
    },
    {
      name: "Planning",
      summary: "Translate the baseline into a controlled delivery plan and governance model.",
      objectives: [
        "Convert discovery findings into a practical delivery sequence",
        "Define owners, checkpoints and reporting rhythm",
        "Confirm the release plan and dependency order",
      ],
      deliverables: [
        "Implementation plan",
        "Governance schedule",
        "Dependency map",
        "Communication plan",
      ],
      responsibilities: [
        "Torque Empire prepares the execution plan",
        `${clientName} confirms business priorities and approvals`,
        "Shared ownership for schedule control",
      ],
      dependencies: [
        "Approved scope",
        "Decision-maker availability",
        "Working schedule for workshops and reviews",
      ],
      acceptance: [
        "Plan is agreed by both parties",
        "Dependencies are logged",
        "Escalation path is visible",
      ],
      risks: ["Risk: planning drift if approvals are delayed"],
      mitigations: ["Mitigation: freeze plan changes at agreed gates"],
    },
    {
      name: "Migration",
      summary: "Move or configure the required capabilities without disrupting the operating baseline.",
      objectives: [
        "Move data and configuration in a controlled sequence",
        "Preserve continuity of service",
        "Avoid unnecessary interruption to staff or customers",
      ],
      deliverables: [
        "Migration runbook",
        "Data transfer log",
        "Configuration checklist",
        "Rollback plan",
      ],
      responsibilities: [
        "Torque Empire coordinates technical execution",
        `${clientName} validates the business order of operations`,
        "Both sides sign off critical moves",
      ],
      dependencies: ["Stable access", "Approved migration window", "Backup and rollback readiness"],
      acceptance: ["Data is moved or configured correctly", "Rollback readiness is confirmed", "No material service loss"],
      risks: ["Risk: data mismatch or transfer error"],
      mitigations: ["Mitigation: pre-checks, backups and validated cutover steps"],
    },
    {
      name: "Security",
      summary: "Apply the controls that protect access, data integrity and operational resilience.",
      objectives: [
        "Secure the environment before wider use",
        "Reduce access exposure",
        "Strengthen logging, backup and recovery discipline",
      ],
      deliverables: ["Access model", "Security checklist", "Backup schedule", "Audit log baseline"],
      responsibilities: [
        "Torque Empire implements the agreed controls",
        `${clientName} approves access roles and policy decisions`,
        "Operational owners maintain the controls after handover",
      ],
      dependencies: ["Policy approval", "Credential readiness", "Infrastructure stability"],
      acceptance: ["Controls are active", "Access is least-privilege", "Recovery steps are documented"],
      risks: ["Risk: over-permissive access or incomplete logging"],
      mitigations: ["Mitigation: review roles, test logs and validate recovery before go-live"],
    },
    {
      name: "Testing",
      summary: "Prove that the platform works as expected before any live release.",
      objectives: [
        "Validate the business journey end to end",
        "Confirm that support paths and error handling work",
        "Identify issues before launch",
      ],
      deliverables: ["Test plan", "Test results", "Issue log", "Remediation tracker"],
      responsibilities: [
        "Torque Empire coordinates testing and fixes",
        `${clientName} validates business outcomes`,
        "Both parties agree pass/fail criteria",
      ],
      dependencies: ["Stable test environment", "Data samples", "Test participants"],
      acceptance: ["Critical issues are resolved", "Journey tests pass", "Business sign-off is recorded"],
      risks: ["Risk: unresolved defects or hidden workflow gaps"],
      mitigations: ["Mitigation: structured testing, issue triage and retest discipline"],
    },
    {
      name: "Go-Live",
      summary: "Release the approved baseline into live operation with controlled authority.",
      objectives: [
        "Move from test to live with minimal disruption",
        "Keep the release authorised and visible",
        "Protect the board-approved scope",
      ],
      deliverables: ["Go-live checklist", "Release note", "Authority record", "Cutover confirmation"],
      responsibilities: [
        "Torque Empire manages cutover coordination",
        `${clientName} confirms release authority`,
        "Operational teams monitor the live transition",
      ],
      dependencies: ["Successful testing", "Approval to proceed", "Support coverage"],
      acceptance: ["Live environment is stable", "Journey works as expected", "Escalations are under control"],
      risks: ["Risk: live transition issues or support overload"],
      mitigations: ["Mitigation: go-live window control, support on standby and rollback readiness"],
    },
    {
      name: "Support",
      summary: "Transition into stable support with clear expectations and response discipline.",
      objectives: [
        "Provide continuity after launch",
        "Set support expectations and response routes",
        "Track issues and service health",
      ],
      deliverables: ["Support model", "Escalation matrix", "Service log", "Reporting cadence"],
      responsibilities: [
        "Torque Empire provides support according to the agreed model",
        `${clientName} routes issues through the agreed channel`,
        "Both parties review recurring themes",
      ],
      dependencies: ["Go-live completion", "Support contacts", "Agreed service windows"],
      acceptance: ["Incidents are handled within target response times", "Owners are clear", "Support reporting is live"],
      risks: ["Risk: unclear support ownership"],
      mitigations: ["Mitigation: publish contacts, SLAs and escalation paths"],
    },
    {
      name: "Continuous Improvement",
      summary: "Use the stable baseline to improve operations, reporting and future capability.",
      objectives: [
        "Capture lessons learned and improvement opportunities",
        "Prepare future enhancements in a controlled way",
        "Move from project delivery to growth planning",
      ],
      deliverables: ["Improvement backlog", "Quarterly review pack", "Roadmap refresh", "Opportunity log"],
      responsibilities: [
        "Torque Empire proposes improvement options",
        `${clientName} prioritises future work`,
        "Jointly review performance and opportunity signals",
      ],
      dependencies: ["Stable support baseline", "Review cadence", "Agreed commercial framework"],
      acceptance: ["Improvement priorities are agreed", "Quarterly reviews are scheduled", "Expansion paths are visible"],
      risks: ["Risk: scope creep or uncontrolled expansion"],
      mitigations: ["Mitigation: keep improvements in a reviewed roadmap with board visibility"],
    },
  ];

  const implementationPages = [
    coverPage({
      kicker: "Implementation Roadmap",
      title: "Implementation Roadmap",
      subtitle:
        "A reusable roadmap that expands the delivery phases from Discovery through Continuous Improvement.",
      meta: [
        { label: "Prepared for", value: clientName },
        { label: "Prepared by", value: preparedBy },
        { label: "Use", value: "Planning, delivery and handover" },
        { label: "Format", value: "Reusable template" },
      ],
    }),
    pageShell({
      kicker: "Roadmap Overview",
      title: "Delivery Sequence",
      subtitle:
        "The roadmap is structured to keep delivery disciplined and easy to govern. Each phase has explicit objectives, outputs and acceptance points.",
      body: table(
        ["Phase", "Focus", "Control Gate"],
        implementationPhases.map((phase) => [phase.name, phase.summary, "Acceptance criteria sign-off"]),
      ),
    }),
    ...implementationPhases.map(phasePage),
  ];

  const onboardingPages = [
    {
      file: path.join(onboardingDir, "Welcome Pack.pdf"),
      title: "Welcome Pack - Roar Cars SA",
      pages: [
        coverPage({
          kicker: "Client Onboarding",
          title: "Welcome Pack",
          subtitle:
            "A calm, executive onboarding pack for the start of the Roar Cars SA engagement.",
          meta: [
            { label: "Client", value: clientName },
            { label: "Prepared by", value: preparedBy },
            { label: "Purpose", value: "Set the working tone and operating rhythm" },
            { label: "Format", value: "Reusable template" },
          ],
        }),
        pageShell({
          kicker: "Onboarding",
          title: "Working Arrangement",
          subtitle:
            "The onboarding pack sets expectations for communication, governance and delivery discipline.",
          body: cards([
            {
              title: "Tone",
              text: "Respectful, executive and focused on clear decisions.",
            },
            {
              title: "Cadence",
              text: "Regular check-ins, visible owners and concise status reporting.",
            },
            {
              title: "Support",
              text: "Questions and requests follow a defined route so nothing is left ambiguous.",
            },
            {
              title: "Outcome",
              text: "A stable working relationship with a clear start, middle and end state.",
            },
          ]),
        }),
      ],
    },
    {
      file: path.join(onboardingDir, "Project Kickoff Checklist.pdf"),
      title: "Project Kickoff Checklist - Roar Cars SA",
      pages: [
        pageShell({
          kicker: "Client Onboarding",
          title: "Project Kickoff Checklist",
          subtitle: "Confirm the items that need to be in place before delivery begins.",
          body: checklist([
            "Board approval or internal authority to proceed",
            "Named business owner and technical owner",
            "Stakeholder list and communication path",
            "Approved scope and reference number",
            "Calendar hold for kickoff meeting",
            "Access to current documents and baseline material",
            "Risk and dependency log opened",
            "Support and escalation contacts confirmed",
          ]),
        }),
      ],
    },
    {
      file: path.join(onboardingDir, "Information Request Checklist.pdf"),
      title: "Information Request Checklist - Roar Cars SA",
      pages: [
        pageShell({
          kicker: "Client Onboarding",
          title: "Information Request Checklist",
          subtitle: "A structured list of the information needed to start in a controlled way.",
          body: `<div class="grid cols-2">
            <div class="panel"><h3>Business inputs</h3>${checklist([
              "Current process notes",
              "Stakeholder roles",
              "Known pain points",
              "Reporting requirements",
            ])}</div>
            <div class="panel"><h3>Technical inputs</h3>${checklist([
              "System list",
              "Hosting details",
              "Integration map",
              "Security controls",
            ])}</div>
            <div class="panel"><h3>Governance inputs</h3>${checklist([
              "Decision owner",
              "Approval process",
              "Escalation contacts",
              "Meeting cadence",
            ])}</div>
            <div class="panel"><h3>Document inputs</h3>${checklist([
              "Policies",
              "Templates",
              "Current proposals",
              "Reference documents",
            ])}</div>
          </div>`,
        }),
      ],
    },
    {
      file: path.join(onboardingDir, "Access Checklist.pdf"),
      title: "Access Checklist - Roar Cars SA",
      pages: [
        pageShell({
          kicker: "Client Onboarding",
          title: "Access Checklist",
          subtitle: "Use this list to keep access controlled and auditable.",
          body: cards([
            {
              title: "User accounts",
              text: "Create or confirm named user accounts for the delivery team and client owners.",
            },
            {
              title: "Permissions",
              text: "Apply least-privilege access to documents, systems and shared channels.",
            },
            {
              title: "Security controls",
              text: "Confirm MFA, password policy and any approval steps required for elevated access.",
            },
            {
              title: "Logging",
              text: "Ensure access changes and administrative actions are auditable.",
            },
          ]),
        }),
      ],
    },
    {
      file: path.join(onboardingDir, "Environment Checklist.pdf"),
      title: "Environment Checklist - Roar Cars SA",
      pages: [
        pageShell({
          kicker: "Client Onboarding",
          title: "Environment Checklist",
          subtitle: "Confirm the environment is fit for controlled delivery and support.",
          body: cards([
            { title: "Hosting", text: "Production and staging environments are identified and reachable." },
            { title: "Backups", text: "Backup and restore arrangements are confirmed." },
            { title: "Monitoring", text: "Health checks, logging and alerting are in place." },
            { title: "Integrations", text: "External dependencies and integrations are documented." },
          ]),
        }),
      ],
    },
    {
      file: path.join(onboardingDir, "Success Criteria.pdf"),
      title: "Success Criteria - Roar Cars SA",
      pages: [
        pageShell({
          kicker: "Client Onboarding",
          title: "Success Criteria",
          subtitle: "Define what good looks like before the work starts.",
          body: table(
            ["Area", "Success Criteria"],
            [
              ["Governance", "Owners, approvals and escalation routes are clear."],
              ["Delivery", "Work is completed against the agreed plan and acceptance points."],
              ["Security", "Access and data controls operate as expected."],
              ["Support", "Issues are handled through the agreed support path."],
              ["Reporting", "The board receives concise and useful progress visibility."],
            ],
          ),
        }),
      ],
    },
  ];

  const playbookPages = [
    coverPage({
      kicker: "Torque Empire Playbook",
      title: "Enterprise Engagement Playbook",
      subtitle:
        "Torque Empire's internal operating standard for enterprise client engagement, built for reuse across future boards and future clients.",
      meta: [
        { label: "Audience", value: "Internal delivery teams" },
        { label: "Prepared by", value: preparedBy },
        { label: "Purpose", value: "Standardise enterprise engagement" },
        { label: "Format", value: "Reusable operating playbook" },
      ],
    }),
    pageShell({
      kicker: "Operating Standard",
      title: "Engagement Lifecycle",
      subtitle:
        "The playbook uses the same sequence for each enterprise client so delivery remains repeatable and measurable.",
      body: table(
        ["Stage", "Objective", "Exit Gate"],
        [
          ["Lead Qualification", "Confirm the opportunity is real and worth time", "Qualified engagement"],
          ["Discovery", "Understand the business need and current state", "Baseline agreed"],
          ["Assessment", "Translate discovery into an executable view", "Assessment approved"],
          ["Executive Proposal", "Prepare the board-facing proposal", "Executive issue"],
          ["Board Presentation", "Present the case and answer questions", "Board direction"],
          ["Commercial Approval", "Confirm the operating and commercial model", "Commercial sign-off"],
          ["Kickoff", "Start delivery with a controlled plan", "Work authorised"],
          ["Implementation", "Deliver against the approved plan", "Acceptance reached"],
          ["Support", "Stabilise the service and handle issues", "Support live"],
          ["Quarterly Reviews", "Track value and risks", "Review cadence active"],
          ["Expansion", "Plan the next phase of work", "Expansion approved"],
        ],
      ),
    }),
    pageShell({
      kicker: "Stage Discipline",
      title: "How the Team Should Work",
      subtitle:
        "Each stage has clear questions, evidence and approval discipline so no client is carried through the process on assumption.",
      body: cards([
        {
          title: "Lead Qualification",
          text: "Check fit, urgency, authority and budget before committing delivery time.",
        },
        {
          title: "Discovery",
          text: "Capture the real problem, stakeholders and current state before proposing solutions.",
        },
        {
          title: "Assessment",
          text: "Translate the facts into a controlled recommendation and risk view.",
        },
        {
          title: "Executive Proposal",
          text: "Write for the board and keep the proposal concise, factual and decision-ready.",
        },
        {
          title: "Board Presentation",
          text: "Prepare the narrative, questions and support material for executive discussion.",
        },
        {
          title: "Commercial Approval",
          text: "Keep the commercial model explicit, configurable and linked to the operating model.",
        },
      ]),
    }),
    pageShell({
      kicker: "Control Points",
      title: "What Must Be True Before We Move On",
      subtitle:
        "Every stage should finish with documented evidence, an owner and a clear next step.",
      body: cards([
        {
          title: "Evidence",
          text: "All claims must be supported by the relevant notes, records or agreed outputs.",
        },
        {
          title: "Owner",
          text: "One person owns the next step and knows what is required to close the stage.",
        },
        {
          title: "Approval",
          text: "No stage moves forward without the right authority and documented confidence.",
        },
        {
          title: "Review",
          text: "Quarterly reviews check value, issues, support quality and expansion opportunities.",
        },
      ]),
    }),
    pageShell({
      kicker: "Reuse",
      title: "Reusable Across Future Clients",
      subtitle:
        "This playbook is written to be adapted without redesign. Future clients should only require changes to the client name, reference, dates, scope and commercial values.",
      body: `<div class="note">
        <p><strong>Standardisation rule:</strong> keep the tone, structure and control points the same across engagements.</p>
        <p style="margin-top:3mm">Only client-specific fields should change. The delivery standard, approval discipline and brand expression should remain stable.</p>
      </div>`,
    }),
  ];

  const docs = [
    { file: path.join(commercialDir, "Commercial Strategy.pdf"), title: "Commercial Strategy - Roar Cars SA", subject: "Commercial strategy", pages: commercialPages },
    { file: path.join(implementationDir, "Implementation Roadmap.pdf"), title: "Implementation Roadmap - Roar Cars SA", subject: "Implementation roadmap", pages: implementationPages },
    ...onboardingPages,
    { file: path.join(playbookDir, "Enterprise Engagement Playbook.pdf"), title: "Enterprise Engagement Playbook", subject: "Internal operating standard", pages: playbookPages },
  ];

  const boardDocs = [
    { file: path.join(boardDir, "Meeting Agenda.pdf"), title: "Meeting Agenda - Roar Cars SA", subject: "Board meeting agenda", pages: agendaPages },
    { file: path.join(boardDir, "Presenter Notes.pdf"), title: "Presenter Notes - Roar Cars SA", subject: "Presenter notes", pages: presenterNotesPages },
    { file: path.join(boardDir, "Board Discussion Guide.pdf"), title: "Board Discussion Guide - Roar Cars SA", subject: "Board discussion guide", pages: discussionGuidePages },
    { file: path.join(boardDir, "Executive Questions & Answers.pdf"), title: "Executive Questions & Answers - Roar Cars SA", subject: "Executive Q and A", pages: qnaPages },
    { file: path.join(boardDir, "Decision Register.pdf"), title: "Decision Register - Roar Cars SA", subject: "Decision register", pages: decisionRegisterPages },
  ];

  for (const doc of [...docs, ...boardDocs]) {
    await renderPdf(
      doc.title,
      wrapHtml(doc.title, doc.pages),
      doc.file,
      {
        title: doc.title,
        subject: doc.subject,
        author: preparedBy,
        creator,
        keywords: [clientName, "Torque Empire", doc.title, "Enterprise Engagement"],
      },
    );
  }
}

async function verifyText() {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const JSZip = (await import("jszip")).default;
  const terms = ["Draft", "Internal Release", "Executive Review", "Board Review", "Version 2.1", "v2.1", "v3.0"];
  const outputs = [
    path.join(boardDir, "Meeting Agenda.pdf"),
    path.join(boardDir, "Presenter Notes.pdf"),
    path.join(boardDir, "Board Discussion Guide.pdf"),
    path.join(boardDir, "Executive Questions & Answers.pdf"),
    path.join(boardDir, "Decision Register.pdf"),
    path.join(commercialDir, "Commercial Strategy.pdf"),
    path.join(implementationDir, "Implementation Roadmap.pdf"),
    path.join(onboardingDir, "Welcome Pack.pdf"),
    path.join(playbookDir, "Enterprise Engagement Playbook.pdf"),
  ];
  const hits = [];
  for (const file of outputs) {
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await fs.readFile(file)), disableWorker: true }).promise;
    let textContent = "";
    for (let i = 1; i <= doc.numPages; i += 1) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      textContent += content.items.map((item) => item.str).join(" ");
    }
    for (const term of terms) {
      if (textContent.includes(term)) hits.push(`${path.basename(file)} contains ${term}`);
    }
  }

  const boardZip = await JSZip.loadAsync(await fs.readFile(path.join(boardDir, "02 - Roar Cars SA Executive Board Presentation.pptx")));
  let pptText = "";
  for (const name of Object.keys(boardZip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))) {
    pptText += await boardZip.file(name).async("string");
  }
  for (const term of terms) {
    if (pptText.includes(term)) hits.push(`board presentation contains ${term}`);
  }

  return hits;
}

async function main() {
  await ensureDir(engagementRoot);
  await ensureDir(archiveDir);
  await copyTree(sourceBoardDir, boardDir);
  await ensureDir(communicationsDir);
  await ensureDir(commercialDir);
  await ensureDir(implementationDir);
  await ensureDir(onboardingDir);
  await ensureDir(playbookDir);

  await buildCommunications();
  await buildBoardDocs();

  const hits = await verifyText();
  if (hits.length) {
    throw new Error(hits.join("; "));
  }

  console.log("Enterprise engagement framework generated");
}

try {
  await main();
} finally {
  await browser.close();
}
