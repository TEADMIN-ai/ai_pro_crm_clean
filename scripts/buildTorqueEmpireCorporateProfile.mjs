import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { PDFDocument, PDFName, PDFString } from "pdf-lib";
import JSZip from "jszip";

const root = process.cwd();
const distDir = path.join(root, "dist");
const outputRoot = path.join(distDir, "Torque Empire Corporate Profile - Executive Edition 2026");
const corporateDir = path.join(outputRoot, "Corporate");
const brandDir = path.join(outputRoot, "Brand");
const photoDir = path.join(outputRoot, "Corporate Photography Placeholders");
const svgDir = path.join(outputRoot, "SVG Assets");
const iconDir = path.join(outputRoot, "Corporate Icons");

const CORPORATE_PROFILE_TITLE = "Torque Empire Corporate Profile – Executive Edition 2026";
const CORPORATE_PROFILE_PDF_TITLE = "Torque Empire Corporate Profile – Executive Edition 2026";
const BRAND_GUIDE_TITLE = "Executive Brand Guidelines";
const preparedBy = "Torque Empire (Pty) Ltd";
const creator = "Torque Empire Executive Publications";
const slogan = "Enterprise discipline. Practical delivery.";

const navy = "#07111f";
const navy2 = "#101d2d";
const steel = "#40515e";
const charcoal = "#2b2f33";
const red = "#c1121f";
const blue = "#1f6feb";
const pale = "#f4f6f8";
const line = "#d9dee5";
const white = "#ffffff";
const slate = "#64748b";
const text = "#22313f";

const browser = await chromium.launch({ headless: true });

const assets = {
  coverHero: path.join(photoDir, "cover-hero-placeholder.svg"),
  founderPortrait: path.join(photoDir, "founder-portrait-placeholder.svg"),
  leadershipMeeting: path.join(photoDir, "leadership-meeting-placeholder.svg"),
  fieldOperations: path.join(photoDir, "field-operations-placeholder.svg"),
  technologyRoom: path.join(photoDir, "technology-room-placeholder.svg"),
  sustainability: path.join(photoDir, "sustainability-placeholder.svg"),
  backCover: path.join(photoDir, "back-cover-placeholder.svg"),
  timeline: path.join(svgDir, "corporate-timeline.svg"),
  structure: path.join(svgDir, "corporate-structure.svg"),
  wasteFlow: path.join(svgDir, "waste-flow.svg"),
  technologyArchitecture: path.join(svgDir, "technology-architecture.svg"),
  complianceFlow: path.join(svgDir, "compliance-flow.svg"),
  hseProcess: path.join(svgDir, "health-safety-process.svg"),
  aiWorkflow: path.join(svgDir, "ai-workflow.svg"),
  environmentalCycle: path.join(svgDir, "environmental-cycle.svg"),
  expansionMap: path.join(svgDir, "national-expansion-map.svg"),
  procurementIcon: path.join(iconDir, "procurement.svg"),
  technologyIcon: path.join(iconDir, "technology.svg"),
  hygieneIcon: path.join(iconDir, "hygiene.svg"),
  telecomIcon: path.join(iconDir, "telecom.svg"),
  governanceIcon: path.join(iconDir, "governance.svg"),
  complianceIcon: path.join(iconDir, "compliance.svg"),
  hseIcon: path.join(iconDir, "hse.svg"),
  aiIcon: path.join(iconDir, "ai.svg"),
  environmentIcon: path.join(iconDir, "environment.svg"),
  expansionIcon: path.join(iconDir, "expansion.svg"),
  wordmark: path.join(svgDir, "torque-empire-wordmark.svg"),
};

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function writeSvg(filePath, content) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, "utf8");
}

async function writeText(filePath, content) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, "utf8");
}

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function svgShell(title, subtitle, body = "", w = 1600, h = 1000) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${navy}"/>
        <stop offset="1" stop-color="${charcoal}"/>
      </linearGradient>
      <linearGradient id="redBand" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${red}"/>
        <stop offset="1" stop-color="#8f0f18"/>
      </linearGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#bg)"/>
    <rect x="72" y="72" width="${w - 144}" height="${h - 144}" rx="34" fill="#ffffff08" stroke="#ffffff20"/>
    <rect x="116" y="122" width="96" height="8" fill="url(#redBand)"/>
    <text x="116" y="210" fill="${white}" font-family="Arial, sans-serif" font-size="56" font-weight="700">${esc(title)}</text>
    <text x="116" y="266" fill="#ced7e2" font-family="Arial, sans-serif" font-size="26">${esc(subtitle)}</text>
    ${body}
  </svg>`;
}

function iconSvg(label, d) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180" role="img" aria-label="${esc(label)}">
    <rect width="180" height="180" rx="24" fill="${navy}"/>
    <circle cx="90" cy="90" r="54" fill="#ffffff08" stroke="#ffffff20"/>
    <g transform="translate(90 90) scale(0.95)" fill="none" stroke="${white}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">${d}</g>
    <text x="90" y="162" text-anchor="middle" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="16" letter-spacing="1.6">${esc(label.toUpperCase())}</text>
  </svg>`;
}

function placeholderPhoto(title, subtitle, bodyText = "Replace with approved photography") {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000" role="img" aria-label="${esc(title)}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#06111d"/>
        <stop offset="0.55" stop-color="#172334"/>
        <stop offset="1" stop-color="#0b1017"/>
      </linearGradient>
    </defs>
    <rect width="1600" height="1000" fill="url(#bg)"/>
    <rect x="100" y="84" width="1400" height="832" rx="36" fill="#ffffff06" stroke="#ffffff14"/>
    <rect x="132" y="128" width="92" height="8" fill="${red}"/>
    <text x="132" y="206" fill="${white}" font-family="Arial, sans-serif" font-size="54" font-weight="700">${esc(title)}</text>
    <text x="132" y="262" fill="#d7dee8" font-family="Arial, sans-serif" font-size="26">${esc(subtitle)}</text>
    <rect x="132" y="346" width="1336" height="410" rx="26" fill="#ffffff06" stroke="#ffffff14"/>
    <path d="M246 652 C420 520 560 476 780 476 C1010 476 1178 535 1360 652" fill="none" stroke="#ffffff18" stroke-width="20" stroke-linecap="round"/>
    <circle cx="442" cy="658" r="62" fill="none" stroke="#ffffff22" stroke-width="16"/>
    <circle cx="1066" cy="658" r="62" fill="none" stroke="#ffffff22" stroke-width="16"/>
    <text x="132" y="842" fill="#9fb0c4" font-family="Arial, sans-serif" font-size="24">${esc(bodyText)}</text>
  </svg>`;
}

function wordmarkSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="120" viewBox="0 0 480 120" role="img" aria-label="Torque Empire wordmark">
    <rect width="480" height="120" fill="none"/>
    <text x="0" y="58" fill="${navy}" font-family="Arial, sans-serif" font-size="34" font-weight="700" letter-spacing="1">TORQUE EMPIRE</text>
    <rect x="0" y="78" width="138" height="6" fill="${red}"/>
    <text x="0" y="104" fill="${slate}" font-family="Arial, sans-serif" font-size="16" letter-spacing="2">${esc(slogan.toUpperCase())}</text>
  </svg>`;
}

function timelineSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="760" viewBox="0 0 1500 760" role="img" aria-label="Corporate timeline">
    <rect width="1500" height="760" rx="28" fill="#07111f"/>
    <line x1="120" y1="380" x2="1380" y2="380" stroke="#ffffff2a" stroke-width="10"/>
    ${[
      ["2024", "Company established", 180],
      ["2025", "Procurement growth and technology development", 500],
      ["2026", "AI platform, Roar Cars, hygiene division and government compliance", 820],
      ["Future", "National expansion and enterprise partnerships", 1140],
    ].map(([year, label, x]) => `<circle cx="${x}" cy="380" r="58" fill="${red}"/><text x="${x}" y="390" text-anchor="middle" fill="${white}" font-family="Arial" font-size="24" font-weight="700">${year}</text><text x="${x}" y="486" text-anchor="middle" fill="#d8e0ea" font-family="Arial" font-size="24">${esc(label)}</text>`).join("")}
  </svg>`;
}

function structureSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="760" viewBox="0 0 1500 760" role="img" aria-label="Corporate structure">
    <rect width="1500" height="760" rx="28" fill="#07111f"/>
    <rect x="558" y="92" width="384" height="94" rx="18" fill="${red}"/>
    <text x="750" y="150" text-anchor="middle" fill="${white}" font-family="Arial" font-size="28" font-weight="700">Torque Empire (Pty) Ltd</text>
    <line x1="750" y1="186" x2="750" y2="242" stroke="#ffffff40" stroke-width="8"/>
    ${[
      ["Procurement", 80],
      ["Technology", 390],
      ["Hygiene Services", 700],
      ["Telecommunications", 1010],
    ].map(([label, x]) => `<rect x="${x}" y="260" width="300" height="112" rx="18" fill="#ffffff0d" stroke="#ffffff24"/><text x="${x + 150}" y="326" text-anchor="middle" fill="${white}" font-family="Arial" font-size="27" font-weight="700">${esc(label)}</text>`).join("")}
    ${[230, 540, 850, 1160].map((x) => `<line x1="750" y1="242" x2="${x}" y2="260" stroke="#ffffff35" stroke-width="6"/>`).join("")}
    <rect x="116" y="522" width="1268" height="120" rx="18" fill="#0b1320" stroke="#ffffff18"/>
    <text x="170" y="592" fill="#d7dee8" font-family="Arial" font-size="26">Shared capability layers</text>
    <text x="470" y="592" fill="#d7dee8" font-family="Arial" font-size="26">Governance | Compliance | HSE | Reporting | Quality | AI</text>
  </svg>`;
}

function complianceFlowSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="760" viewBox="0 0 1500 760" role="img" aria-label="Compliance flow">
    <rect width="1500" height="760" rx="28" fill="#07111f"/>
    ${[
      ["Policy", 110],
      ["Permit", 350],
      ["Training", 590],
      ["Records", 830],
      ["Audit", 1070],
    ].map(([label, x]) => `<rect x="${x}" y="280" width="180" height="96" rx="16" fill="#ffffff0d" stroke="${red}"/><text x="${x + 90}" y="338" text-anchor="middle" fill="${white}" font-family="Arial" font-size="26" font-weight="700">${esc(label)}</text>`).join("")}
    ${[290, 530, 770, 1010].map((x) => `<path d="M${x} 328 H${x + 50}" stroke="${white}" stroke-opacity="0.45" stroke-width="8" marker-end="url(#a)"/>`).join("")}
    <defs><marker id="a" markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="${white}"/></marker></defs>
    <text x="750" y="150" text-anchor="middle" fill="${white}" font-family="Arial" font-size="34" font-weight="700">Compliance control flow</text>
    <text x="750" y="208" text-anchor="middle" fill="#d7dee8" font-family="Arial" font-size="22">Application in progress is clearly marked where approvals are pending</text>
  </svg>`;
}

function simpleProcessSvg(title, steps) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="760" viewBox="0 0 1500 760" role="img" aria-label="${esc(title)}">
    <rect width="1500" height="760" rx="28" fill="#07111f"/>
    <text x="750" y="112" text-anchor="middle" fill="${white}" font-family="Arial" font-size="34" font-weight="700">${esc(title)}</text>
    <line x1="110" y1="420" x2="1390" y2="420" stroke="#ffffff2a" stroke-width="10"/>
    ${steps.map((step, i) => {
      const x = 110 + i * 290;
      return `<rect x="${x}" y="320" width="240" height="180" rx="20" fill="#ffffff0d" stroke="${i % 2 ? blue : red}"/><circle cx="${x + 120}" cy="390" r="30" fill="${i % 2 ? blue : red}"/><text x="${x + 120}" y="399" text-anchor="middle" fill="${white}" font-family="Arial" font-size="22" font-weight="700">${i + 1}</text><text x="${x + 24}" y="454" fill="${white}" font-family="Arial" font-size="24" font-weight="700">${esc(step)}</text>`;
    }).join("")}
  </svg>`;
}

function mapSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="760" viewBox="0 0 1500 760" role="img" aria-label="National expansion map">
    <rect width="1500" height="760" rx="28" fill="#07111f"/>
    <path d="M200 180 L330 220 L420 390 L360 580 L230 620 L150 510 L120 320 Z" fill="#ffffff0a" stroke="#ffffff24"/>
    <path d="M520 130 L760 150 L920 250 L840 430 L650 540 L490 400 L450 250 Z" fill="#ffffff0a" stroke="#ffffff24"/>
    <path d="M980 190 L1220 220 L1340 420 L1220 610 L1030 570 L940 370 Z" fill="#ffffff0a" stroke="#ffffff24"/>
    <circle cx="320" cy="360" r="14" fill="${red}"/>
    <circle cx="760" cy="330" r="14" fill="${red}"/>
    <circle cx="1140" cy="380" r="14" fill="${red}"/>
    <text x="750" y="86" text-anchor="middle" fill="${white}" font-family="Arial" font-size="32" font-weight="700">National expansion footprint</text>
    <text x="750" y="144" text-anchor="middle" fill="#d7dee8" font-family="Arial" font-size="20">Current presence and future expansion potential across South Africa</text>
  </svg>`;
}

function iconSet() {
  return {
    procurement: iconSvg("Procurement", `<path d="M-34 -16 h68 v30 h-68z"/><path d="M-26 14 h52"/><path d="M-34 -16 l14 -18 h38 l14 18"/><path d="M-8 -16 v30"/><path d="M14 -16 v30"/>`),
    technology: iconSvg("Technology", `<rect x="-36" y="-26" width="72" height="52" rx="8"/><path d="M-22 28 h44"/><path d="M-12 28 v16 h24 v-16"/>`),
    hygiene: iconSvg("Hygiene", `<path d="M-10 -42 l14 18 l22 12 v30 c0 24 -12 40 -36 52 c-24 -12 -36 -28 -36 -52 v-30 l22 -12 14 -18z"/><path d="M-6 -6 l8 10 l18 -22"/><path d="M24 30 h36"/>`),
    telecom: iconSvg("Telecom", `<path d="M-42 18 h84"/><path d="M-18 18 c0 -30 24 -54 54 -54"/><path d="M-34 18 c0 -40 32 -72 72 -72"/><circle cx="0" cy="18" r="8" fill="${white}"/>`),
    governance: iconSvg("Governance", `<circle cx="0" cy="-22" r="14"/><path d="M-40 38 h80"/><path d="M-22 -8 l22 22 l22 -22"/><path d="M0 8 v30"/>`),
    compliance: iconSvg("Compliance", `<path d="M0 -44 l40 18 v28 c0 28 -18 46 -40 58 c-22 -12 -40 -30 -40 -58 v-28z"/><path d="M-16 2 l12 12 l24 -30"/>`),
    hse: iconSvg("HSE", `<path d="M-38 -12 h76"/><path d="M-32 -12 v56 h64 v-56"/><path d="M0 -12 v56"/><path d="M-16 12 h32"/><path d="M-16 28 h32"/>`),
    ai: iconSvg("AI", `<circle cx="0" cy="0" r="38"/><path d="M-16 -12 h32"/><path d="M-16 6 h32"/><path d="M0 -38 v-16"/><path d="M0 54 v-16"/><path d="M-54 0 h16"/><path d="M38 0 h16"/>`),
    environment: iconSvg("Environment", `<path d="M-34 20 C-18 -14 10 -42 42 -52 C34 -18 10 18 -14 38 C-24 46 -30 54 -34 66 C-40 50 -40 36 -34 20z"/><path d="M-16 14 C2 0 18 -18 30 -36"/>`),
    expansion: iconSvg("Expansion", `<path d="M-40 40 L40 -40"/><path d="M12 -40 h28 v28"/><path d="M-40 40 h28 v-28"/>`),
  };
}

function card(title, text) {
  return { title, text };
}

function bulletList(items) {
  return `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
}

function cards(items, cols = 2) {
  return `<div class="grid cols-${cols}">${items.map((item) => `<div class="card"><h3>${esc(item.title)}</h3><p>${esc(item.text)}</p></div>`).join("")}</div>`;
}

function table(headers, rows) {
  return `<div class="table-wrap"><table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${Array.isArray(cell) ? bulletList(cell) : esc(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function pageShell({ dark = false, kicker = "", title, subtitle = "", body = "", footerLeft = "", footerRight = "" }) {
  return `<section class="page ${dark ? "dark" : ""}">
    <div class="page-inner">
      <div>
        <div class="brand-bar"><span>Torque Empire</span><span>${esc("Roar Cars SA")}</span></div>
        ${kicker ? `<div class="kicker">${esc(kicker)}</div>` : ""}
        <h1>${esc(title)}</h1>
        ${subtitle ? `<p class="lead">${esc(subtitle)}</p>` : ""}
      </div>
      <div class="content">${body}</div>
    </div>
    <div class="footer"><span>${esc(footerLeft || `${preparedBy} | ${title}`)}</span><span>${esc(footerRight)}</span></div>
  </section>`;
}

function coverPage({ kicker, title, subtitle, meta, image }) {
  return `<section class="page dark cover">
    <div class="cover-hero"></div>
    ${image ? `<img class="cover-image" src="${path.relative(path.join(outputRoot, "Corporate"), image).replace(/\\/g, "/")}" alt="" />` : ""}
    <div class="page-inner">
      <div>
        <div class="kicker">${esc(kicker)}</div>
        <div class="rule"></div>
        <h1>${esc(title)}</h1>
        <p class="lead">${esc(subtitle)}</p>
      </div>
      <div class="meta-grid">${meta.map((m) => `<div class="meta-box"><strong>${esc(m.label)}</strong><span>${esc(m.value)}</span></div>`).join("")}</div>
    </div>
    <div class="footer footer-dark"><span>${preparedBy}</span><span>1</span></div>
  </section>`;
}

function buildHtmlDoc(title, pages, baseHref = null) {
  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      ${baseHref ? `<base href="${esc(baseHref)}" />` : ""}
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
          --slate: ${slate};
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
          overflow: hidden;
          page-break-after: always;
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
        .cover { padding: 0; }
        .cover-hero {
          position: absolute;
          inset: 0;
          background: var(--navy);
        }
        .cover-image {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          opacity: .18;
          mix-blend-mode: screen;
        }
        .brand-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: #93a3b7;
          text-transform: uppercase;
          letter-spacing: 1.6px;
          font-size: 8pt;
          font-weight: 700;
        }
        .dark .brand-bar { color: rgba(255,255,255,.64); }
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
        h1 { font-size: 36pt; line-height: 1.06; max-width: 162mm; letter-spacing: 0; }
        h2 { font-size: 24pt; line-height: 1.08; color: var(--navy); letter-spacing: 0; }
        h3 { font-size: 12.5pt; line-height: 1.1; color: var(--navy); }
        .dark h2, .dark h3 { color: var(--white); }
        p { color: #283644; font-size: 10.5pt; line-height: 1.55; }
        .dark p { color: rgba(255,255,255,.84); }
        .lead { font-size: 14pt; line-height: 1.45; margin-top: 8mm; max-width: 156mm; }
        .content { margin-top: 10mm; }
        .grid { display: grid; gap: 5mm; }
        .cols-2 { grid-template-columns: repeat(2, 1fr); }
        .cols-3 { grid-template-columns: repeat(3, 1fr); }
        .cols-4 { grid-template-columns: repeat(4, 1fr); }
        .card, .panel, .summary-box, .metric {
          border: 1px solid var(--line);
          border-radius: 4mm;
          background: var(--white);
          padding: 5.5mm;
        }
        .dark .card, .dark .panel, .dark .summary-box, .dark .metric {
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
        th {
          background: var(--navy);
          color: var(--white);
          text-align: left;
          padding: 3mm;
          font-size: 8.2pt;
          text-transform: uppercase;
          letter-spacing: .7px;
        }
        td {
          border-top: 1px solid var(--line);
          vertical-align: top;
          padding: 3mm;
          font-size: 9.4pt;
          line-height: 1.42;
          color: #25333f;
        }
        .dark .table-wrap { border-color: rgba(255,255,255,.16); background: rgba(255,255,255,.05); }
        .dark th { background: rgba(255,255,255,.12); }
        .dark td { color: rgba(255,255,255,.88); border-top-color: rgba(255,255,255,.14); }
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
        .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; }
        .summary-box strong {
          display: block;
          text-transform: uppercase;
          letter-spacing: 1px;
          font-size: 8pt;
          color: #6b7785;
          margin-bottom: 2mm;
        }
        .summary-box span { font-size: 11pt; color: var(--navy); font-weight: 700; }
        .dark .summary-box strong { color: rgba(255,255,255,.62); }
        .dark .summary-box span { color: var(--white); }
        .stage-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 5mm; }
        .stage-card { border: 1px solid var(--line); border-radius: 4mm; padding: 5mm; background: var(--white); }
        .stage-card h3 { margin-bottom: 2.5mm; }
        .stage-card ul { margin: 0; padding-left: 5mm; color: #263442; font-size: 9.5pt; line-height: 1.4; }
        .stage-card li { margin-bottom: 1.4mm; }
        .dark .stage-card { background: rgba(255,255,255,.06); border-color: rgba(255,255,255,.14); }
        .dark .stage-card ul { color: rgba(255,255,255,.86); }
        .quote {
          font-size: 22pt;
          line-height: 1.24;
          color: var(--navy);
          font-weight: 700;
        }
        .dark .quote { color: var(--white); }
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
      </style>
    </head>
  <body>${pages.join("")}</body>
  </html>`;
}

async function inlineSvgImages(html, baseHref) {
  if (!baseHref) return html;
  const srcPattern = /src="([^"]+\.svg(?:\?[^"]*)?)"/g;
  const sources = [...new Set([...html.matchAll(srcPattern)].map((match) => match[1]))];
  if (!sources.length) return html;

  const replacements = new Map();
  await Promise.all(
    sources.map(async (src) => {
      const resolved = new URL(src, baseHref).href;
      const filePath = fileURLToPath(resolved);
      const svg = await fs.readFile(filePath, "utf8");
      replacements.set(src, `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`);
    }),
  );

  return html.replace(srcPattern, (match, src) => {
    const replacement = replacements.get(src);
    return replacement ? `src="${replacement}"` : match;
  });
}

async function patchPptxMetadata(filePath, { title, subject, creatorName, slideCount }) {
  const zip = await JSZip.loadAsync(await fs.readFile(filePath));
  const xmlEscape = (value) => esc(value);

  const corePath = "docProps/core.xml";
  const appPath = "docProps/app.xml";

  let core = await zip.file(corePath).async("string");
  core = core
    .replace(/<dc:title>[^<]*<\/dc:title>/, `<dc:title>${xmlEscape(title)}</dc:title>`)
    .replace(/<dc:creator>[^<]*<\/dc:creator>/, `<dc:creator>${xmlEscape(creatorName)}</dc:creator>`)
    .replace(/<lastModifiedBy>[^<]*<\/lastModifiedBy>/, `<lastModifiedBy>${xmlEscape(creatorName)}</lastModifiedBy>`)
    .replace(/<dc:description>[^<]*<\/dc:description>/, `<dc:description>${xmlEscape(subject)}</dc:description>`);

  let app = await zip.file(appPath).async("string");
  app = app
    .replace(/<ap:Slides>\d+<\/ap:Slides>/, `<ap:Slides>${slideCount}</ap:Slides>`)
    .replace(/<ap:Notes>\d+<\/ap:Notes>/, `<ap:Notes>30</ap:Notes>`);

  zip.file(corePath, core);
  zip.file(appPath, app);
  await fs.writeFile(filePath, await zip.generateAsync({ type: "nodebuffer" }));
}

async function renderPdf(filePath, html, metadata) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1900 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "load" });
  await page.pdf({
    path: filePath,
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
  });
  await page.close();

  const bytes = await fs.readFile(filePath);
  const doc = await PDFDocument.load(bytes);
  doc.setTitle(metadata.title);
  doc.setSubject(metadata.subject);
  doc.setAuthor(preparedBy);
  doc.setCreator(creator);
  doc.setKeywords(metadata.keywords);
  doc.setProducer(creator);
  const info = doc.context.lookup(doc.context.trailerInfo.Info);
  if (info && info.set) {
    info.set(PDFName.of("Company"), PDFString.of(preparedBy));
    info.set(PDFName.of("DocumentReference"), PDFString.of(metadata.reference || "TE-CP-2026"));
  }
  await fs.writeFile(filePath, await doc.save());
}

async function renderImageFromSvg(svgPath, pngPath, scale = 1.6) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
  const svg = await fs.readFile(svgPath, "utf8");
  const html = `<!doctype html><html><body style="margin:0;background:#fff">${svg}</body></html>`;
  await page.setContent(html, { waitUntil: "load" });
  const box = await page.locator("svg").boundingBox();
  if (!box) throw new Error(`Unable to render ${svgPath}`);
  await page.locator("svg").screenshot({ path: pngPath, scale, omitBackground: false });
  await page.close();
}

async function buildAssets() {
  await Promise.all([corporateDir, brandDir, photoDir, svgDir, iconDir].map(ensureDir));
  await writeSvg(assets.coverHero, placeholderPhoto("Corporate Profile Hero", "Executive Edition 2026", "Premium full-page hero image placeholder"));
  await writeSvg(assets.founderPortrait, placeholderPhoto("Founder Portrait", "Letter from the Founder", "Replace with approved founder portrait"));
  await writeSvg(assets.leadershipMeeting, placeholderPhoto("Leadership Meeting", "Governance and board context", "Replace with approved boardroom image"));
  await writeSvg(assets.fieldOperations, placeholderPhoto("Field Operations", "Service delivery and logistics", "Replace with approved operational image"));
  await writeSvg(assets.technologyRoom, placeholderPhoto("Technology Environment", "Digital platforms and control room", "Replace with approved technology image"));
  await writeSvg(assets.sustainability, placeholderPhoto("Sustainability", "Environmental responsibility and chain of custody", "Replace with approved sustainability image"));
  await writeSvg(assets.backCover, placeholderPhoto("Back Cover", "Torque Empire Corporate Profile", "Premium closing image placeholder"));

  await writeSvg(assets.timeline, timelineSvg());
  await writeSvg(assets.structure, structureSvg());
  await writeSvg(assets.complianceFlow, complianceFlowSvg());
  await writeSvg(assets.wasteFlow, simpleProcessSvg("Waste Flow Diagram", ["Collection", "Transport", "Storage", "Tracking", "Manifest", "Disposal"]))
  await writeSvg(assets.technologyArchitecture, simpleProcessSvg("Technology Architecture", ["Portal", "API", "Workflow", "OCR", "AI", "Reporting"]));
  await writeSvg(assets.hseProcess, simpleProcessSvg("Health and Safety Process", ["Prepare", "Protect", "Report", "Respond", "Review", "Improve"]));
  await writeSvg(assets.aiWorkflow, simpleProcessSvg("AI Workflow", ["Capture", "Extract", "Validate", "Score", "Review", "Decide"]));
  await writeSvg(assets.environmentalCycle, simpleProcessSvg("Environmental Cycle", ["Collect", "Sort", "Track", "Dispose", "Record", "Improve"]));
  await writeSvg(assets.expansionMap, mapSvg());
  await writeSvg(assets.wordmark, wordmarkSvg());

  const icons = iconSet();
  await writeSvg(assets.procurementIcon, icons.procurement);
  await writeSvg(assets.technologyIcon, icons.technology);
  await writeSvg(assets.hygieneIcon, icons.hygiene);
  await writeSvg(assets.telecomIcon, icons.telecom);
  await writeSvg(assets.governanceIcon, icons.governance);
  await writeSvg(assets.complianceIcon, icons.compliance);
  await writeSvg(assets.hseIcon, icons.hse);
  await writeSvg(assets.aiIcon, icons.ai);
  await writeSvg(assets.environmentIcon, icons.environment);
  await writeSvg(assets.expansionIcon, icons.expansion);
}

function pageCover() {
  return coverPage({
    kicker: "Executive Corporate Profile",
    title: "Torque Empire (Pty) Ltd",
    subtitle: `${slogan} - Executive Edition 2026`,
    meta: [
      { label: "Audience", value: "Government, investors, banks and enterprise clients" },
      { label: "Purpose", value: "Flagship corporate publication" },
      { label: "Prepared by", value: preparedBy },
      { label: "Version", value: "Executive Edition 2026" },
    ],
    image: assets.coverHero,
  });
}

function pageFounder() {
  return pageShell({
    dark: false,
    kicker: "Letter from the Founder",
    title: "Purpose, responsibility and long-term partnership",
    subtitle: "Written from the perspective of Chadwin Wesley Karanie.",
    body: `<div class="grid cols-2">
      <div class="panel">
        <p class="quote">Torque Empire exists to build disciplined, useful and accountable solutions that can stand up to public scrutiny and long-term enterprise use.</p>
        <p style="margin-top:4mm">The company is guided by purpose, integrity, innovation and service. We build with an understanding that people, communities and operating environments depend on the quality of the systems and services we deliver.</p>
      </div>
      <div class="panel">
        <p>Our work spans technology, procurement, hygiene services and telecommunications because real enterprise problems do not sit in one lane. They require systems thinking, practical delivery and a respect for governance.</p>
        <p style="margin-top:3mm">We seek long-term partnerships that create employment, support communities, protect the environment and strengthen client operations through professional service.</p>
        <p style="margin-top:3mm">We do not promise more than we can prove. We prefer reliable delivery, measured growth and an operating culture that can be trusted by government, financial institutions and enterprise clients.</p>
      </div>
    </div>
    ${cards([
      card("Purpose", "Build disciplined, useful and accountable solutions."),
      card("Responsibility", "Support people, communities and regulated operations."),
      card("Integrity", "Do not promise more than can be proven."),
      card("Long-term partnership", "Create stable operating relationships."),
    ], 2)}`,
    footerLeft: "Letter from the Founder",
  });
}

function whoWeArePage() {
  return pageShell({
    kicker: "Who We Are",
    title: "A corporate platform built for operational trust",
    subtitle: "Torque Empire combines governance, practical execution and forward-looking capability.",
    body: `${cards([
      card("History", "Founded in 2024 and shaped through procurement growth, technology development and a broader enterprise services mandate."),
      card("Company Overview", "A multi-division enterprise focused on procurement, technology, hygiene services and telecommunications."),
      card("Vision", "To be a trusted South African enterprise partner delivering disciplined solutions across regulated and operational sectors."),
      card("Mission", "To provide practical services and systems that improve control, support growth and create long-term value."),
      card("Values", "Integrity, accountability, service discipline, environmental responsibility and continuous improvement."),
      card("Leadership Philosophy", "Lead with clarity, act responsibly, document decisions and build systems that can be sustained."),
    ], 3)}
    <div class="panel" style="margin-top:5mm">
      <img src="../SVG Assets/corporate-structure.svg" alt="Corporate structure" style="width:100%;display:block;border-radius:18px" />
    </div>`,
    footerLeft: "Who We Are",
  });
}

function corporateTimelinePage() {
  return pageShell({
    kicker: "Corporate Timeline",
    title: "Growth with a controlled direction of travel",
    subtitle: "The timeline records the company's progression without overstating maturity or market position.",
    body: `<div class="grid cols-2">
      <div class="panel"><img src="../SVG Assets/corporate-timeline.svg" alt="Corporate timeline" style="width:100%;display:block;border-radius:18px" /></div>
      <div class="panel">
        <div class="summary-grid">
          ${[
            ["2024", "Company established"],
            ["2025", "Procurement growth and technology development"],
            ["2026", "AI platform, Roar Cars, hygiene division and government compliance"],
            ["Future", "National expansion and enterprise partnerships"],
          ].map(([label, value]) => `<div class="summary-box"><strong>${esc(label)}</strong><span>${esc(value)}</span></div>`).join("")}
        </div>
        <p style="margin-top:5mm">The timeline shows an enterprise that is still building, but doing so with intent, structure and a multi-division operating model that can scale responsibly.</p>
      </div>
    </div>`,
  });
}

function divisionsOverviewPage() {
  return pageShell({
    kicker: "Our Four Divisions",
    title: "A multi-division model with shared governance",
    subtitle: "Each division has a distinct service focus while sharing the same brand, control and reporting discipline.",
    body: `<div class="grid cols-2">
      <div class="panel"><img src="../SVG Assets/corporate-structure.svg" alt="Corporate structure" style="width:100%;display:block;border-radius:18px" /></div>
      <div class="grid cols-2">
        ${[
          ["Procurement", "Tender management, contractor onboarding, supplier compliance and bid support.", "../Corporate Icons/procurement.svg"],
          ["Technology", "AI platform, software delivery, OCR, dashboards and cyber-secure workflows.", "../Corporate Icons/technology.svg"],
          ["Hygiene Services", "Sanitary waste collection, hazardous transport, manifests and environmental care.", "../Corporate Icons/hygiene.svg"],
          ["Telecommunications", "Civil infrastructure, fibre, deployment and maintenance services.", "../Corporate Icons/telecom.svg"],
        ].map(([title, text, icon]) => `<div class="panel"><img src="${icon}" alt="" style="width:68px;height:68px;display:block;margin-bottom:3mm" /><h3>${esc(title)}</h3><p>${esc(text)}</p></div>`).join("")}
      </div>
    </div>`,
  });
}

function divisionPage({ title, kicker, subtitle, icon, overview, capabilities, services, industries, roadmap, asset }) {
  return pageShell({
    kicker,
    title,
    subtitle,
    body: `<div class="grid cols-2">
      <div class="panel"><img src="${path.relative(corporateDir, asset).replace(/\\/g, "/")}" alt="" style="width:100%;display:block;border-radius:18px" /></div>
      <div class="grid cols-2">
        <div class="panel"><img src="${path.relative(corporateDir, icon).replace(/\\/g, "/")}" alt="" style="width:72px;height:72px;display:block;margin-bottom:3mm" /><h3>Overview</h3><p>${esc(overview)}</p></div>
        <div class="panel"><h3>Capabilities</h3>${bulletList(capabilities)}</div>
        <div class="panel"><h3>Services</h3>${bulletList(services)}</div>
        <div class="panel"><h3>Industries served</h3>${bulletList(industries)}</div>
      </div>
    </div>
    <div class="note" style="margin-top:5mm"><strong>Future roadmap:</strong> ${esc(roadmap)}</div>`,
  });
}

function hygieneDetailPage() {
  return pageShell({
    kicker: "Hygiene Division",
    title: "Sanitary waste collection with chain of custody discipline",
    subtitle: "This is one of the strongest sections in the profile because it speaks directly to public-sector and regulated-environment expectations.",
    body: `<div class="grid cols-2">
      <div class="panel">
        ${bulletList([
          "Sanitary waste collection and transport",
          "Hazardous waste handling and storage",
          "Collection scheduling and route discipline",
          "PPE, incident reporting and risk management",
          "Waste manifest control and chain of custody",
          "Digital reporting, e-signatures and future client portal",
        ])}
      </div>
      <div class="panel">
        <img src="../SVG Assets/waste-flow.svg" alt="Waste flow diagram" style="width:100%;display:block;border-radius:18px" />
      </div>
    </div>
    <div class="grid cols-2" style="margin-top:5mm">
      <div class="panel">
        <img src="../SVG Assets/compliance-flow.svg" alt="Chain of custody workflow" style="width:100%;display:block;border-radius:18px" />
        <h3 style="margin-top:4mm">Chain of custody</h3>
        <p>Waste manifest control, handover traceability and controlled records remain visible at every step.</p>
      </div>
      <div class="panel">
        <img src="../SVG Assets/environmental-cycle.svg" alt="Environmental stewardship" style="width:100%;display:block;border-radius:18px" />
        <h3 style="margin-top:4mm">Environmental stewardship</h3>
        <p>Protect people, records and the environment while maintaining operational discipline.</p>
      </div>
      <div class="panel">
        <img src="../SVG Assets/waste-flow.svg" alt="Operational process diagram" style="width:100%;display:block;border-radius:18px" />
        <h3 style="margin-top:4mm">Operational process</h3>
        <p>Collection, transport, storage, tracking and disposal are shown as one managed sequence.</p>
      </div>
      <div class="panel">
        <h3>Compliance</h3>
        ${bulletList(["Waste manifest control", "Chain of custody", "Quality assurance", "Digital reporting", "Electronic signatures", "Future client portal"])}
      </div>
    </div>`,
  });
}

function technologyDetailPage() {
  return pageShell({
    kicker: "Technology Division",
    title: "AI platform, workflow and enterprise reporting",
    subtitle: "Technology is positioned as a practical enterprise capability rather than a marketing headline.",
    body: `<div class="grid cols-2">
      <div class="panel"><img src="../SVG Assets/technology-architecture.svg" alt="Technology architecture" style="width:100%;display:block;border-radius:18px" /></div>
      <div class="grid cols-2">
        <div class="panel"><h3>Core capability</h3>${bulletList(["AI platform", "OCR", "Document verification", "Fraud intelligence", "Dashboards", "Workflow automation"])}</div>
        <div class="panel"><h3>Enterprise scope</h3>${bulletList(["Enterprise software", "Cloud infrastructure", "Cyber security", "Reporting and analytics", "Governance controls"])}</div>
        <div class="panel"><h3>Future roadmap</h3>${bulletList(["AI expansion", "Role-based reporting", "Client portals", "Continuous improvement", "Platform hardening"])}</div>
        <div class="panel"><img src="../Corporate Icons/ai.svg" alt="" style="width:74px;height:74px;display:block;margin-bottom:3mm" /><p>Technology work should improve control, not create unnecessary complexity.</p></div>
      </div>
    </div>`,
  });
}

function procurementDetailPage() {
  return pageShell({
    kicker: "Procurement Division",
    title: "Tender management and supplier compliance",
    subtitle: "This division supports organisations that need disciplined bid support, document control and supplier onboarding.",
    body: `<div class="grid cols-2">
      <div class="panel">
        <img src="../Corporate Icons/procurement.svg" alt="" style="width:74px;height:74px;display:block;margin-bottom:3mm" />
        ${bulletList(["Tender management", "Contractor onboarding", "Supplier compliance", "Document verification", "AI tender intelligence", "BOQ and QS intelligence", "Bid support"])}
      </div>
      <div class="panel">
        <h3>Industries served</h3>
        ${bulletList(["Government and municipalities", "Construction", "Mining", "Healthcare", "Manufacturing", "Automotive finance"])}
        <div class="spacer"></div>
        <h3>Future roadmap</h3>
        ${bulletList(["Automated tender tracking", "Document intelligence", "Digital compliance onboarding", "Scoring and governance support"])}
      </div>
    </div>`,
  });
}

function telecomPage() {
  return pageShell({
    kicker: "Telecommunications Division",
    title: "Civil infrastructure and network deployment",
    subtitle: "Telecommunications is presented as a practical implementation capability with maintenance discipline.",
    body: `<div class="grid cols-2">
      <div class="panel"><img src="../Corporate Icons/telecom.svg" alt="" style="width:74px;height:74px;display:block;margin-bottom:3mm" />${bulletList(["Civil infrastructure", "Fibre deployment", "Network rollout", "Maintenance services"])}<div class="spacer"></div><p>Future roadmap: structured maintenance, service visibility and broader network support capacity.</p></div>
      <div class="panel"><img src="../SVG Assets/national-expansion-map.svg" alt="Expansion map" style="width:100%;display:block;border-radius:18px" /></div>
    </div>`,
  });
}

function governancePage() {
  return pageShell({
    kicker: "Corporate Governance",
    title: "Decision making, risk management and quality assurance",
    subtitle: "Governance is treated as a practical operating discipline, not a compliance paragraph.",
    body: table(
      ["Topic", "Operating expectation"],
      [
        ["Board", "Clear authority, documented decisions and visible ownership."],
        ["Leadership", "Lead from the front, act responsibly and keep records clean."],
        ["Risk management", "Track, escalate and close risk with evidence."],
        ["Internal controls", "Role clarity, approval discipline and access control."],
        ["Quality assurance", "Review outputs before release and improve from feedback."],
        ["Continuous improvement", "Use evidence to raise the standard over time."],
      ],
    ),
  });
}

function compliancePage() {
  return pageShell({
    kicker: "Compliance",
    title: "Compliance with approvals clearly marked",
    subtitle: "Where approvals are still in progress, the publication states that plainly rather than implying approval has already been granted.",
    body: `<div class="grid cols-2">
      <div class="panel">
        ${bulletList([
          "COIDA",
          "Waste transport registration",
          "Disposal permit - Application in progress",
          "Environmental management",
          "Occupational health and safety",
          "POPIA and data protection",
          "Incident reporting",
          "Training",
          "Quality management",
          "Document control",
        ])}
      </div>
      <div class="panel"><img src="../SVG Assets/compliance-flow.svg" alt="Compliance flow" style="width:100%;display:block;border-radius:18px" /></div>
    </div>`,
  });
}

function hsePage() {
  return pageShell({
    kicker: "Health, Safety and Environment",
    title: "Safety culture, incident response and stewardship",
    subtitle: "The HSE message is practical: protect people, protect environments and document the response.",
    body: `<div class="grid cols-2">
      <div class="panel">
        <img src="../Corporate Icons/hse.svg" alt="" style="width:74px;height:74px;display:block;margin-bottom:3mm" />
        ${bulletList(["Safety culture", "PPE", "Safe transport", "Emergency response", "Spill management", "Environmental stewardship"])}
      </div>
      <div class="panel"><img src="../SVG Assets/health-safety-process.svg" alt="Health and safety process" style="width:100%;display:block;border-radius:18px" /></div>
    </div>`,
  });
}

function techAdvantagePage() {
  return pageShell({
    kicker: "Technology Advantage",
    title: "AI, automation, cloud and reporting",
    subtitle: "The advantage is framed as operational utility: faster control, better evidence and clearer reporting.",
    body: cards([
      card("AI", "Used to support verification, prioritisation and insight."),
      card("Automation", "Improves repeatability and reduces unnecessary manual effort."),
      card("Cloud", "Provides managed infrastructure and deployable control."),
      card("Reporting", "Makes progress, risk and operations visible."),
      card("Analytics", "Supports better decisions and trend awareness."),
      card("Future innovation", "Introduced only after the base operating model is stable."),
    ], 3),
  });
}

function industriesPage() {
  return pageShell({
    kicker: "Industries We Serve",
    title: "Cross-sector capability with one executive standard",
    subtitle: "The publication is aimed at government and enterprise audiences without changing the tone or control model.",
    body: cards([
      card("Government", "National, provincial and local government."),
      card("Municipalities", "Service delivery and infrastructure environments."),
      card("Healthcare", "Facilities requiring controls, records and care."),
      card("Commercial", "Businesses that need disciplined operating support."),
      card("Industrial", "Warehousing, logistics and production environments."),
      card("Automotive", "Dealers, finance and digital workflow environments."),
      card("Construction", "Tendering, compliance and site-based operations."),
      card("Mining", "Operationally demanding environments with strong HSE requirements."),
    ], 4),
  });
}

function whyTorquePage() {
  return pageShell({
    kicker: "Why Torque Empire",
    title: "Evidence-based, professional and operationally grounded",
    subtitle: "The case is built around the quality of the operating model, not marketing claims.",
    body: `<div class="note">
      <p class="quote">Torque Empire is positioned as a practical enterprise partner that can combine governance, delivery discipline and long-term support.</p>
    </div>
    <div class="summary-grid" style="margin-top:5mm">
      <div class="summary-box"><strong>Professional</strong><span>Clear writing, clear controls and clear ownership</span></div>
      <div class="summary-box"><strong>Evidence-based</strong><span>Claims are supported by work, process or records</span></div>
      <div class="summary-box"><strong>Long-term</strong><span>The operating model is reusable and supportable</span></div>
    </div>`,
  });
}

function environmentalPage() {
  return pageShell({
    kicker: "Environmental Commitment",
    title: "Responsible waste handling and community stewardship",
    subtitle: "Environmental responsibility is treated as a business obligation, not a decorative statement.",
    body: `<div class="grid cols-2">
      <div class="panel">
        <img src="../Corporate Icons/environment.svg" alt="" style="width:74px;height:74px;display:block;margin-bottom:3mm" />
        ${bulletList(["Responsible waste handling", "Chain of custody", "Licensed disposal partners where applicable", "Compliance", "Sustainability", "Community responsibility"])}
      </div>
      <div class="panel"><img src="../SVG Assets/environmental-cycle.svg" alt="Environmental cycle" style="width:100%;display:block;border-radius:18px" /></div>
    </div>`,
  });
}

function futureVisionPage() {
  return pageShell({
    kicker: "Future Vision",
    title: "National growth with technology leadership and employment creation",
    subtitle: "The vision is expressed as disciplined expansion with measured capability growth.",
    body: `<div class="grid cols-2">
      <div class="panel">
        <img src="../Corporate Icons/expansion.svg" alt="" style="width:74px;height:74px;display:block;margin-bottom:3mm" />
        ${bulletList(["National growth", "Technology leadership", "Employment creation", "AI capability", "Environmental services", "Long-term partnerships"])}
      </div>
      <div class="panel"><img src="../SVG Assets/national-expansion-map.svg" alt="Expansion map" style="width:100%;display:block;border-radius:18px" /></div>
      </div>`,
  });
}

function procurementOperationsPage() {
  return pageShell({
    kicker: "Procurement Division",
    title: "Operating model, review discipline and bid support",
    subtitle: "Procurement work is strongest when process, evidence and turnaround time are all visible.",
    body: table(
      ["Area", "Control expectation"],
      [
        ["Process", "A structured review path for tenders, contractors and supplier records."],
        ["Evidence", "Bid packs, due diligence and document verification recorded clearly."],
        ["Turnaround", "Response timing managed against board or client deadlines."],
        ["Quality", "Every submission reviewed before release."],
        ["Roadmap", "Digitised onboarding and tender tracking."],
      ],
    ),
  });
}

function technologyControlsPage() {
  return pageShell({
    kicker: "Technology Division",
    title: "Control layers, security and reporting discipline",
    subtitle: "The technology division is intended to be dependable before it is ambitious.",
    body: `<div class="grid cols-2">
      <div class="panel">
        ${bulletList([
          "Cloud infrastructure",
          "Cyber security",
          "Role-based access",
          "Document verification",
          "OCR and AI support",
          "Enterprise reporting",
        ])}
      </div>
      <div class="panel"><img src="../SVG Assets/technology-architecture.svg" alt="Technology architecture" style="width:100%;display:block;border-radius:18px" /></div>
    </div>`,
  });
}

function hygieneOperationsPage() {
  return pageShell({
    kicker: "Hygiene Division",
    title: "Operations, scheduling and quality assurance",
    subtitle: "Scheduling and control are central to sustainable service delivery.",
    body: `${cards([
      card("Collection scheduling", "Route discipline, timing and service tracking."),
      card("Health and safety", "PPE, safe transport and incident management."),
      card("Digital reporting", "Records, manifests and client visibility."),
      card("Future portal", "Client access and electronic signatures."),
      card("Quality assurance", "Checks, logs and verified handover."),
      card("Environmental care", "Protection of people and the environment."),
    ], 3)}
    <div class="summary-grid" style="margin-top:5mm">
      <div class="summary-box"><strong>Chain of custody</strong><span>Traceability through collection and handover</span></div>
      <div class="summary-box"><strong>Compliance</strong><span>Manifest control, records and approvals</span></div>
      <div class="summary-box"><strong>Environmental stewardship</strong><span>Protection of people and the environment</span></div>
    </div>`,
  });
}

function telecomOperationsPage() {
  return pageShell({
    kicker: "Telecommunications Division",
    title: "Deployment, maintenance and service continuity",
    subtitle: "The work is practical, site-based and measured against an operations standard.",
    body: `<div class="grid cols-2">
      <div class="panel">
        ${bulletList([
          "Civil build support",
          "Fibre deployment",
          "Network installation",
          "Testing and activation",
          "Maintenance visits",
          "Service continuity controls",
        ])}
      </div>
      <div class="panel"><img src="../SVG Assets/national-expansion-map.svg" alt="National expansion map" style="width:100%;display:block;border-radius:18px" /></div>
    </div>`,
  });
}

function governanceFrameworkPage() {
  return pageShell({
    kicker: "Corporate Governance",
    title: "Leadership, control and continuous improvement",
    subtitle: "The governance model is intentionally simple so it can be used across future clients.",
    body: cards([
      card("Leadership", "Lead from the front and keep decisions visible."),
      card("Risk management", "Escalate, track and close issues with evidence."),
      card("Internal controls", "Access, approvals and records stay disciplined."),
      card("Quality assurance", "Use reviews and feedback to improve outcomes."),
    ], 2),
  });
}

function complianceStatusPage() {
  return pageShell({
    kicker: "Compliance",
    title: "Current compliance position and status note",
    subtitle: "The publication separates granted approvals from applications that are still in progress.",
    body: `<div class="grid cols-2">
      <div class="panel">
        <h3>Approved or active</h3>
        ${bulletList(["COIDA", "Environmental management", "POPIA and data protection", "Training", "Quality management", "Document control"])}
      </div>
      <div class="panel">
        <h3>In progress</h3>
        ${bulletList(["Disposal permit - Application in progress", "Additional registrations where applicable", "Expansion-related permits as required"])}
      </div>
    </div>`,
  });
}

function hseResponsePage() {
  return pageShell({
    kicker: "Health, Safety and Environment",
    title: "Emergency response, spill management and reporting",
    subtitle: "The response model should be easy to train, easy to audit and easy to follow.",
    body: `<div class="grid cols-2">
      <div class="panel"><img src="../SVG Assets/health-safety-process.svg" alt="Health and safety process" style="width:100%;display:block;border-radius:18px" /></div>
      <div class="panel">
        ${bulletList([
          "Emergency response",
          "Spill management",
          "Incident reporting",
          "PPE usage",
          "Safe transport",
          "Environmental stewardship",
        ])}
      </div>
    </div>`,
  });
}

function industriesMatrixPage() {
  return pageShell({
    kicker: "Industries We Serve",
    title: "Sector fit and operating expectations",
    subtitle: "The same standard can be adapted across sectors without diluting control.",
    body: table(
      ["Sector", "Operating emphasis"],
      [
        ["Government", "Governance, procurement and documentation discipline."],
        ["Municipalities", "Service continuity, reporting and environmental care."],
        ["Healthcare", "Compliance, safety and reliable process."],
        ["Automotive", "Workflow control, finance support and digital handling."],
        ["Construction", "Tendering, site operations and contractor compliance."],
        ["Mining", "HSE, logistics and controlled field execution."],
      ],
    ),
  });
}

function evidencePage() {
  return pageShell({
    kicker: "Why Torque Empire",
    title: "Evidence, proof and operational maturity",
    subtitle: "The profile should show how the enterprise behaves, not just what it says.",
    body: `<div class="summary-grid">
      <div class="summary-box"><strong>Proof</strong><span>Work, records and operating controls</span></div>
      <div class="summary-box"><strong>Reliability</strong><span>Turnaround, follow-through and visibility</span></div>
      <div class="summary-box"><strong>Partnership</strong><span>Long-term support and measured growth</span></div>
    </div>
    <div class="spacer"></div>
    <div class="note"><p>Torque Empire should be read as a practical partner that can execute, support and improve over time.</p></div>`,
  });
}

function sustainabilityPage2() {
  return pageShell({
    kicker: "Environmental Commitment",
    title: "Chain of custody and responsible disposal",
    subtitle: "Environmental responsibility only has value when it is backed by control and records.",
    body: cards([
      card("Chain of custody", "Track the item from collection to handover."),
      card("Licensed partners", "Use approved partners where applicable."),
      card("Tracking", "Record transport and disposal milestones."),
      card("Sustainability", "Reduce avoidable waste and improve handling."),
    ], 2),
  });
}

function brandAppendixPage() {
  return pageShell({
    kicker: "Corporate Standards",
    title: "Service, document and presentation standards",
    subtitle: "The standards below keep the profile and future publications aligned.",
    body: cards([
      card("Service standards", "Respectful communication, visible ownership and documented closure."),
      card("Document standards", "Clear titles, stable footers and disciplined tables."),
      card("Presentation standards", "Strong hierarchy, minimal clutter and executive readability."),
      card("Letterhead standards", "Wordmark, contact block and controlled brand accent usage."),
    ], 2),
  });
}

function corporateInfoPage() {
  return pageShell({
    kicker: "Corporate Information",
    title: "Contact, document control and reference fields",
    subtitle: "This page provides the practical contact structure without over-designing it.",
    body: `<div class="grid cols-2">
      <div class="panel">
        ${bulletList([
          "Company: Torque Empire (Pty) Ltd",
          "Address: configurable corporate address",
          "Telephone: configurable contact number",
          "Email: configurable corporate email",
          "Website: configurable website",
          "Social media: configurable platform handles",
          "QR code placeholder for digital access",
        ])}
      </div>
      <div class="panel">
        <div class="summary-grid">
          <div class="summary-box"><strong>Document class</strong><span>Confidential executive profile</span></div>
          <div class="summary-box"><strong>Issue</strong><span>Executive Edition 2026</span></div>
          <div class="summary-box"><strong>Usage</strong><span>Government and enterprise engagement</span></div>
          <div class="summary-box"><strong>Reference</strong><span>Configurable by issue</span></div>
        </div>
      </div>
    </div>`,
  });
}

function accessPage() {
  return pageShell({
    kicker: "Corporate Information",
    title: "Digital access and public contact points",
    subtitle: "The publication includes configurable fields so future issues can be updated without redesign.",
    body: `<div class="grid cols-2">
      <div class="panel">
        <h3>Access points</h3>
        ${bulletList([
          "Website placeholder",
          "QR code placeholder",
          "Social media placeholders",
          "Corporate email placeholder",
        ])}
      </div>
      <div class="panel">
        <div class="summary-grid">
          <div class="summary-box"><strong>QR code</strong><span>Placeholder</span></div>
          <div class="summary-box"><strong>Website</strong><span>Placeholder</span></div>
          <div class="summary-box"><strong>Social</strong><span>Placeholder</span></div>
          <div class="summary-box"><strong>Email</strong><span>Placeholder</span></div>
        </div>
      </div>
    </div>`,
  });
}

function closingPage() {
  return pageShell({
    kicker: "Back Cover",
    title: "Torque Empire (Pty) Ltd",
    subtitle: slogan,
    dark: true,
    body: `<div class="panel" style="background:#07111f; border-color:#ffffff24"><img src="../Corporate Photography Placeholders/back-cover-placeholder.svg" alt="Back cover placeholder" style="width:100%;display:block;border-radius:18px;opacity:.92" /></div>`,
    footerLeft: preparedBy,
  });
}

function brandGuidePages() {
  return [
    coverPage({
      kicker: "Brand Guidelines",
      title: "Executive Brand Guidelines",
      subtitle: "A practical standard for the Torque Empire executive publication system.",
      meta: [
        { label: "Colours", value: "Navy, steel grey, white and corporate red" },
        { label: "Typography", value: "Executive sans-serif hierarchy" },
        { label: "Usage", value: "Documents, decks and official publications" },
        { label: "Prepared by", value: preparedBy },
      ],
      image: assets.coverHero,
    }),
    pageShell({
      kicker: "Colours and Typography",
      title: "Core brand system",
      subtitle: "The publication system should feel consistent across government, investor and enterprise settings.",
      body: `<div class="summary-grid">
        <div class="summary-box"><strong>Navy</strong><span>${navy}</span></div>
        <div class="summary-box"><strong>Steel Grey</strong><span>${steel}</span></div>
        <div class="summary-box"><strong>Corporate Red</strong><span>${red}</span></div>
        <div class="summary-box"><strong>White</strong><span>${white}</span></div>
      </div>
      <div class="spacer"></div>
      <div class="panel"><h3>Typography</h3><p>Use a clean executive sans-serif hierarchy with strong title weight, measured body copy and restrained capitalisation.</p></div>`,
    }),
    pageShell({
      kicker: "Logo Usage",
      title: "Wordmark discipline",
      subtitle: "Use the Torque Empire wordmark with clear space and no unapproved distortion.",
      body: `<div class="grid cols-2">
        <div class="panel"><img src="../SVG Assets/torque-empire-wordmark.svg" alt="Torque Empire wordmark" style="width:100%;display:block" /></div>
        <div class="panel"><h3>Rules</h3>${bulletList(["Keep the wordmark clear of clutter", "Do not stretch, recolour or crop", "Use on white, navy or pale backgrounds only", "Keep the red rule consistent"])} </div>
      </div>`,
    }),
    pageShell({
      kicker: "Photography",
      title: "Photography style",
      subtitle: "Use premium, real-world photography with business clarity and no generic stock feeling.",
      body: cards([
        card("People", "Boardrooms, founder portraits and leadership meetings."),
        card("Operations", "Field work, vehicles, logistics and service delivery."),
        card("Technology", "Dashboards, control rooms, devices and secure workflow settings."),
        card("Environment", "Collection, transport, storage and sustainability contexts."),
      ], 2),
    }),
    pageShell({
      kicker: "Iconography",
      title: "Single icon family",
      subtitle: "All icons should share the same stroke weight, colour and geometry discipline.",
      body: `<div class="grid cols-4">
        ${[
          assets.procurementIcon,
          assets.technologyIcon,
          assets.hygieneIcon,
          assets.telecomIcon,
          assets.governanceIcon,
          assets.complianceIcon,
          assets.hseIcon,
          assets.aiIcon,
        ].map((src) => `<div class="panel"><img src="${path.relative(brandDir, src).replace(/\\/g, "/")}" alt="" style="width:100%;display:block;border-radius:18px" /></div>`).join("")}
      </div>`,
    }),
    pageShell({
      kicker: "Document Standards",
      title: "Document and presentation standards",
      subtitle: "Every publication should use the same tone, spacing, hierarchy and footer logic.",
      body: cards([
        card("Documents", "Title, subtitle, clear sections, controlled footers and disciplined tables."),
        card("Presentations", "Large whitespace, concise slides, strong hierarchy and minimal clutter."),
        card("Letterhead", "Wordmark, contact block and controlled use of red accent."),
        card("Photography placeholders", "Use premium SVG placeholders only until approved images are available."),
      ], 2),
    }),
    pageShell({
      kicker: "Closing",
      title: "Brand standard summary",
      subtitle: "The system is intentionally restrained so the work reads as executive and credible.",
      body: `<div class="note"><p>The Torque Empire brand should read as disciplined, practical and calm. The design language must support trust, governance and long-term partnership.</p></div>`,
    }),
  ];
}

function buildCorporatePdfPages() {
  return [
    pageCover(),
    pageFounder(),
    whoWeArePage(),
    corporateTimelinePage(),
    divisionsOverviewPage(),
    divisionPage({
      title: "Procurement Division",
      kicker: "Division 1",
      subtitle: "Tender management, contractor onboarding and supplier compliance support.",
      icon: assets.procurementIcon,
      asset: assets.fieldOperations,
      overview: "The procurement division supports structured sourcing and tender activity with a focus on verification, governance and bid support.",
      capabilities: ["Tender management", "Supplier compliance", "Contractor onboarding", "Document verification", "AI tender intelligence", "BOQ and QS intelligence"],
      services: ["Bid support", "Supplier due diligence", "Compliance pack preparation", "Document control", "Tender review assistance"],
      industries: ["Government", "Construction", "Mining", "Healthcare", "Manufacturing", "Automotive finance"],
      roadmap: "Expand into intelligent bid support, digital compliance onboarding and more automated document verification.",
    }),
    divisionPage({
      title: "Technology Division",
      kicker: "Division 2",
      subtitle: "AI platform, enterprise software, OCR and workflow automation.",
      icon: assets.technologyIcon,
      asset: assets.technologyRoom,
      overview: "The technology division provides practical software and platform capability for workflow, dashboards and data control.",
      capabilities: ["AI platform", "Enterprise software", "OCR", "Document verification", "Fraud intelligence", "Dashboards", "Cloud infrastructure", "Cyber security"],
      services: ["Workflow automation", "Enterprise reporting", "Systems integration support", "Document intelligence", "Secure platform delivery"],
      industries: ["Dealers", "Procurement teams", "Government operations", "Enterprise clients", "Finance and compliance teams"],
      roadmap: "Broaden into governed AI expansion, role-based analytics and client portal capability.",
    }),
    hygieneDetailPage(),
    pageShell({
      kicker: "Hygiene Division",
      title: "Waste handling, tracking and environmental care",
      subtitle: "The hygiene section is deliberately detailed because compliance and chain of custody matter most in this division.",
      body: `<div class="grid cols-2">
        <div class="panel">
          <h3>Core services</h3>
          ${bulletList([
            "Sanitary waste collection",
            "Hazardous waste transportation",
            "Waste handling and storage",
            "Collection scheduling",
            "PPE and health and safety",
            "Risk management",
            "Incident reporting",
            "Government permit applications",
          ])}
        </div>
        <div class="panel">
          <h3>Compliance controls</h3>
          ${bulletList([
            "Waste manifest control",
            "Chain of custody",
            "Quality assurance",
            "Digital reporting",
            "Electronic manifests",
            "Electronic signatures",
            "Future GPS tracking",
            "Future client portal",
          ])}
        </div>
      </div>
      <div class="grid cols-2" style="margin-top:5mm">
        <div class="panel">
          <img src="../SVG Assets/compliance-flow.svg" alt="Chain of custody workflow" style="width:100%;display:block;border-radius:18px" />
          <h3 style="margin-top:4mm">Chain of custody</h3>
          <p>Waste manifest control, handover traceability and controlled records remain visible at every step.</p>
        </div>
        <div class="panel">
          <img src="../SVG Assets/waste-flow.svg" alt="Operational process diagram" style="width:100%;display:block;border-radius:18px" />
          <h3 style="margin-top:4mm">Operational process</h3>
          <p>Collection, transport, storage, tracking and disposal are shown as one managed sequence.</p>
        </div>
        <div class="panel">
          <h3>Compliance callout</h3>
          ${bulletList(["Waste manifest control", "Chain of custody", "Digital reporting", "Electronic signatures"]) }
        </div>
        <div class="panel">
          <img src="../SVG Assets/environmental-cycle.svg" alt="Environmental stewardship" style="width:100%;display:block;border-radius:18px" />
          <h3 style="margin-top:4mm">Environmental stewardship</h3>
          <p>Protect people, records and the environment while maintaining operational discipline.</p>
        </div>
      </div>`,
    }),
    pageShell({
      kicker: "Hygiene Division",
      title: "Operational discipline and future disposal capability",
      subtitle: "The roadmap is intentionally conservative: control first, expansion second.",
      body: `<div class="grid cols-2">
        <div class="panel"><img src="../SVG Assets/waste-flow.svg" alt="Waste flow diagram" style="width:100%;display:block;border-radius:18px" /></div>
        <div class="panel">
          <h3>Future roadmap</h3>
          ${bulletList([
            "Future disposal facility",
            "Future GPS tracking",
            "Digital reporting standards",
            "Electronic signatures",
            "Future client portal",
          ])}
          <div class="spacer"></div>
          <h3>Environmental responsibility</h3>
          <p>Every operational step should protect people, records and the environment. The division must be ready for government and municipal scrutiny.</p>
        </div>
      </div>
      <div class="summary-grid" style="margin-top:5mm">
        <div class="summary-box"><strong>Future disposal facility</strong><span>Control first, expansion second</span></div>
        <div class="summary-box"><strong>Future GPS tracking</strong><span>Route visibility and traceability</span></div>
        <div class="summary-box"><strong>Electronic manifests</strong><span>Digital records and accountability</span></div>
        <div class="summary-box"><strong>Future client portal</strong><span>Controlled access and visibility</span></div>
      </div>`,
    }),
    telecomPage(),
    pageShell({
      kicker: "Telecommunications Division",
      title: "Civil works, fibre and network deployment",
      subtitle: "The service model is practical and maintenance-oriented.",
      body: cards([
        card("Civil infrastructure", "Trenching, supports, site preparation and practical build services."),
        card("Fibre", "Rollout and deployment support across controlled work areas."),
        card("Network deployment", "Installation, testing and operational activation."),
        card("Maintenance", "Scheduled maintenance and service continuity."),
      ], 2),
    }),
    governancePage(),
    compliancePage(),
    hsePage(),
    techAdvantagePage(),
    pageShell({
      kicker: "Technology Advantage",
      title: "AI workflow and enterprise reporting in one operating model",
      subtitle: "The AI workflow is framed as a controlled support layer, not an unchecked automation claim.",
      body: `<div class="grid cols-2">
        <div class="panel"><img src="../SVG Assets/ai-workflow.svg" alt="AI workflow" style="width:100%;display:block;border-radius:18px" /></div>
        <div class="panel"><img src="../Corporate Icons/ai.svg" alt="" style="width:74px;height:74px;display:block;margin-bottom:3mm" />${bulletList(["OCR", "Document verification", "Fraud intelligence", "Dashboards", "Workflow automation", "Enterprise reporting", "Cloud infrastructure", "Cyber security"])} </div>
      </div>`,
    }),
    industriesPage(),
    pageShell({
      kicker: "Industries We Serve",
      title: "Public and private sector operating environments",
      subtitle: "The publication is intended for sectors that need evidence, control and scale.",
      body: `<div class="grid cols-2">
        <div class="panel">${bulletList(["Government", "Municipalities", "Healthcare", "Commercial", "Industrial", "Automotive", "Construction", "Mining"])}</div>
        <div class="panel"><img src="../SVG Assets/national-expansion-map.svg" alt="National expansion map" style="width:100%;display:block;border-radius:18px" /></div>
      </div>`,
    }),
    whyTorquePage(),
    environmentalPage(),
    futureVisionPage(),
    procurementOperationsPage(),
    technologyControlsPage(),
    hygieneOperationsPage(),
    telecomOperationsPage(),
    governanceFrameworkPage(),
    complianceStatusPage(),
    hseResponsePage(),
    industriesMatrixPage(),
    evidencePage(),
    sustainabilityPage2(),
    brandAppendixPage(),
    corporateInfoPage(),
    accessPage(),
    closingPage(),
  ];
}

function buildCorporateBrandPages() {
  return brandGuidePages();
}

function pageDataForDeck() {
  return [
    { kind: "cover", title: "Torque Empire (Pty) Ltd", subtitle: slogan, image: assets.coverHero, kicker: "Executive Corporate Profile" },
    { kind: "cards", kicker: "Founder", title: "Purpose and responsibility", subtitle: "Written from the perspective of Chadwin Wesley Karanie.", cards: [card("Purpose", "Build disciplined, useful and accountable solutions."), card("Responsibility", "Support people, communities and regulated operations."), card("Integrity", "Do not promise more than can be proven."), card("Long-term partnerships", "Create stable operating relationships.")], cols: 2 },
    { kind: "cards", kicker: "Who We Are", title: "Company overview", subtitle: "A multi-division enterprise with a shared governance standard.", cards: [card("History", "Founded in 2024 and shaped through growth in procurement, technology and services."), card("Vision", "Trusted South African enterprise partner."), card("Mission", "Provide practical services and systems that improve control and value."), card("Values", "Integrity, accountability, service discipline and environmental responsibility.")], cols: 2 },
    { kind: "imageCards", kicker: "Timeline", title: "Corporate timeline", subtitle: "Controlled growth with clear milestones.", image: assets.timeline, cards: [card("2024", "Company established"), card("2025", "Procurement growth and technology development"), card("2026", "AI platform, Roar Cars, hygiene division and compliance"), card("Future", "National expansion and enterprise partnerships")], cols: 2 },
    { kind: "imageCards", kicker: "Structure", title: "Our four divisions", subtitle: "Shared governance and shared brand discipline.", image: assets.structure, cards: [card("Procurement", "Tender management and supplier compliance"), card("Technology", "AI platform and workflow systems"), card("Hygiene", "Waste handling and environmental care"), card("Telecommunications", "Civil works and network deployment")], cols: 2 },
    { kind: "split", kicker: "Procurement", title: "Tender management and supplier compliance", subtitle: "Built for government, construction, mining and enterprise procurement.", image: assets.fieldOperations, bullets: ["Tender management", "Contractor onboarding", "Supplier compliance", "Document verification", "AI tender intelligence", "Bid support"] },
    { kind: "split", kicker: "Procurement", title: "Services and roadmap", subtitle: "The division supports controlled bidding and future digital onboarding.", image: assets.procurementIcon, bullets: ["BOQ intelligence", "QS intelligence", "Bid support", "Supplier due diligence", "Digital compliance onboarding", "Automated tender tracking"] },
    { kind: "split", kicker: "Technology", title: "AI platform and enterprise software", subtitle: "Technology is practical, governed and supportable.", image: assets.technologyRoom, bullets: ["AI platform", "OCR", "Document verification", "Fraud intelligence", "Dashboards", "Workflow automation"] },
    { kind: "split", kicker: "Technology", title: "Architecture and workflow", subtitle: "The technical stack is organised around control and reporting.", image: assets.technologyArchitecture, bullets: ["Cloud infrastructure", "Cyber security", "Enterprise reporting", "Role-based access", "Secure workflow", "Integration support"] },
    { kind: "split", kicker: "Hygiene", title: "Waste collection and transport", subtitle: "The strongest operational compliance section in the profile.", image: assets.wasteFlow, bullets: ["Sanitary waste collection", "Hazardous waste transportation", "Waste handling and storage", "Collection scheduling", "PPE and HSE", "Incident reporting"] },
    { kind: "split", kicker: "Hygiene", title: "Tracking and chain of custody", subtitle: "Chain of custody and permit control are central to this division.", image: assets.complianceFlow, bullets: ["Waste manifest control", "Chain of custody", "Quality assurance", "Digital reporting", "Electronic signatures", "Future client portal"] },
    { kind: "split", kicker: "Hygiene", title: "Future disposal capability", subtitle: "Expansion is sequenced after control.", image: assets.environmentalCycle, bullets: ["Future disposal facility", "Future GPS tracking", "Electronic manifests", "Incident reporting", "Environmental responsibility", "Government permit applications"] },
    { kind: "split", kicker: "Telecommunications", title: "Civil infrastructure and network deployment", subtitle: "A practical implementation and maintenance capability.", image: assets.expansionMap, bullets: ["Civil infrastructure", "Fibre", "Network deployment", "Maintenance", "Rollout support", "Service continuity"] },
    { kind: "cards", kicker: "Governance", title: "Board, leadership and quality assurance", subtitle: "Decision making is documented and risk aware.", cards: [card("Board", "Clear authority and visible ownership."), card("Leadership", "Lead with clarity and practical discipline."), card("Risk management", "Track, escalate and close risks with evidence."), card("Quality", "Review outputs before release.")], cols: 2 },
    { kind: "split", kicker: "Compliance", title: "Approvals and controls", subtitle: "Application in progress is clearly marked where required.", image: assets.complianceFlow, bullets: ["COIDA", "Waste transport registration", "Disposal permit - Application in progress", "Environmental management", "POPIA", "Document control"] },
    { kind: "split", kicker: "HSE", title: "Safety culture and stewardship", subtitle: "Protect people, records and the environment.", image: assets.hseProcess, bullets: ["Safety culture", "PPE", "Safe transport", "Emergency response", "Spill management", "Environmental stewardship"] },
    { kind: "cards", kicker: "Technology Advantage", title: "AI, automation, cloud and reporting", subtitle: "Operational utility is the point.", cards: [card("AI", "Verification and prioritisation support."), card("Automation", "Repeatable workflow and less manual effort."), card("Cloud", "Managed infrastructure and control."), card("Reporting", "Clear progress and risk visibility."), card("Analytics", "Trends and decisions."), card("Innovation", "Only after the base model is stable.")], cols: 3 },
    { kind: "split", kicker: "AI Workflow", title: "From capture to decision support", subtitle: "AI is used as a controlled assistance layer.", image: assets.aiWorkflow, bullets: ["Capture", "Extract", "Validate", "Score", "Review", "Decide"] },
    { kind: "cards", kicker: "Industries", title: "Industries we serve", subtitle: "One executive standard across multiple sectors.", cards: [card("Government", "National, provincial and local government."), card("Municipalities", "Service delivery and infrastructure."), card("Healthcare", "Facilities needing control and care."), card("Automotive", "Dealers, finance and digital workflow."), card("Construction", "Tendering and site operations."), card("Mining", "HSE-intensive operating contexts.")], cols: 3 },
    { kind: "quote", kicker: "Why Torque Empire", title: "Evidence-based and operationally grounded", subtitle: "Torque Empire is positioned as a practical enterprise partner that can combine governance, delivery discipline and long-term support.", quote: "The case is built around the quality of the operating model, not marketing claims." },
    { kind: "split", kicker: "Environmental Commitment", title: "Responsible waste handling and community stewardship", subtitle: "Environmental responsibility is a business obligation.", image: assets.sustainability, bullets: ["Responsible waste handling", "Chain of custody", "Licensed disposal partners where applicable", "Compliance", "Sustainability", "Community responsibility"] },
    { kind: "split", kicker: "Future Vision", title: "National growth and employment creation", subtitle: "Measured expansion with long-term partnership discipline.", image: assets.expansionMap, bullets: ["National growth", "Technology leadership", "Employment creation", "AI capability", "Environmental services", "Long-term partnerships"] },
    { kind: "cards", kicker: "Corporate Information", title: "Contact and document control", subtitle: "Configurable fields remain isolated to the contact section.", cards: [card("Company", "Torque Empire (Pty) Ltd"), card("Address", "Configurable corporate address"), card("Telephone", "Configurable contact number"), card("Email", "Configurable corporate email"), card("Website", "Configurable website"), card("Social media", "Configurable platform handles")], cols: 2 },
    { kind: "cards", kicker: "Access", title: "Digital access and public contact points", subtitle: "The publication includes configurable fields for future issues.", cards: [card("QR code", "Placeholder"), card("Website", "Placeholder"), card("Social", "Placeholder"), card("Email", "Placeholder")], cols: 2 },
    { kind: "cards", kicker: "Brand Standards", title: "Service, document and presentation standards", subtitle: "The standards section keeps future publications aligned.", cards: [card("Service standards", "Respectful communication and documented closure."), card("Document standards", "Clear titles and disciplined tables."), card("Presentation standards", "Strong hierarchy and minimal clutter."), card("Letterhead standards", "Wordmark, contact block and controlled brand accent usage.")], cols: 2 },
    { kind: "cards", kicker: "Visual System", title: "Photography and iconography standards", subtitle: "Use one line-icon family and premium placeholders.", cards: [card("Photography", "Real-world, approved images only."), card("Placeholders", "Premium SVG placeholders until assets are approved."), card("Icons", "Consistent stroke weight and colour."), card("Diagrams", "Clear enterprise structure and control visuals.")], cols: 2 },
    { kind: "cards", kicker: "Governance Appendix", title: "Quality assurance and control", subtitle: "Control points are documented and visible.", cards: [card("Board", "Approvals and documented ownership."), card("Risk", "Track, escalate and close issues."), card("Quality", "Review before release."), card("Improvement", "Use evidence to raise the standard.")], cols: 2 },
    { kind: "cards", kicker: "Compliance Appendix", title: "Current status and in-progress items", subtitle: "Approvals are labelled accurately.", cards: [card("Active", "COIDA, POPIA and environmental management."), card("Active", "Training, quality management and document control."), card("In progress", "Disposal permit application."), card("In progress", "Any additional approvals required.")], cols: 2 },
    { kind: "cards", kicker: "Operating Standard", title: "Service, support and handover expectations", subtitle: "The model should be reusable across future clients.", cards: [card("Service", "Clear communication and visible ownership."), card("Support", "Defined response routes and reporting."), card("Handover", "Documented closure and continuity."), card("Reuse", "Configurable fields only for future clients.")], cols: 2 },
    { kind: "cover", title: "Torque Empire (Pty) Ltd", subtitle: slogan, kicker: "Executive Corporate Profile", image: assets.backCover },
  ];
}

function renderDeckSlide(slide, spec, index) {
  const dark = spec.kind === "cover" || spec.kind === "quote";
  slide.background.fill = dark ? navy : white;
  slide.shapes.add({ geometry: "rect", position: { left: 0, top: 0, width: 1280, height: 720 }, fill: dark ? navy : white, line: { width: 0, fill: dark ? navy : white } });
  slide.shapes.add({ geometry: "rect", position: { left: 0, top: 0, width: 26, height: 720 }, fill: red, line: { width: 0, fill: red } });

  if (spec.kind === "cover") {
    slide.images.add({ blob: spec.imageBlob, fit: "cover", alt: "Cover image" }).position = { left: 0, top: 0, width: 1280, height: 720 };
    slide.shapes.add({ geometry: "rect", position: { left: 0, top: 0, width: 1280, height: 720 }, fill: "#07111fe6", line: { width: 0, fill: "#07111fe6" } });
    addText(slide, "Torque Empire", 70, 54, 300, 24, { size: 18, color: "#9fb0c4", bold: true, typeface: "Arial" });
    addText(slide, "Executive Corporate Profile", 70, 120, 470, 32, { size: 23, color: red, bold: true, typeface: "Arial" });
    addText(slide, "Torque Empire (Pty) Ltd", 70, 170, 640, 100, { size: 52, color: white, bold: true });
    addText(slide, spec.subtitle, 70, 300, 610, 60, { size: 26, color: "#d7dee8", typeface: "Arial" });
    addText(slide, slogan, 70, 360, 500, 34, { size: 20, color: "#d7dee8", typeface: "Arial" });
    addFooter(slide, index + 1, true);
    return;
  }

  addText(slide, spec.kicker, 60, 52, 320, 20, { size: 15, color: red, bold: true, typeface: "Arial" });
  addText(slide, spec.title, 60, 84, 610, 72, { size: 36, color: dark ? white : navy, bold: true });
  addText(slide, spec.subtitle, 60, 170, 560, 68, { size: 20, color: dark ? "#d7dee8" : steel, typeface: "Arial" });

  if (spec.kind === "quote") {
    addText(slide, spec.quote, 70, 282, 540, 150, { size: 28, color: dark ? white : navy, bold: true });
    if (spec.imageBlob) {
      slide.images.add({ blob: spec.imageBlob, fit: "cover", alt: "Visual" }).position = { left: 720, top: 110, width: 490, height: 500 };
      slide.shapes.add({ geometry: "roundRect", position: { left: 720, top: 110, width: 490, height: 500 }, fill: "#ffffff10", line: { width: 1, fill: "#ffffff28" } });
    }
  } else if (spec.kind === "cards") {
    let x = 60;
    let y = 246;
    const cols = spec.cols || 2;
    const cardW = cols === 2 ? 540 : 330;
    const cardH = cols === 2 ? 148 : 140;
    spec.cards.forEach((c, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      x = 60 + col * (cardW + 22);
      y = 246 + row * (cardH + 18);
      addShape(slide, x, y, cardW, cardH, dark ? "#ffffff0d" : "#ffffff", true, dark ? "#ffffff20" : line);
      addText(slide, c.title, x + 18, y + 16, cardW - 36, 24, { size: 18, color: dark ? white : navy, bold: true, typeface: "Arial" });
      addText(slide, c.text, x + 18, y + 48, cardW - 36, cardH - 54, { size: 16, color: dark ? "#d7dee8" : text, typeface: "Arial" });
    });
  } else if (spec.kind === "imageCards" || spec.kind === "split") {
    slide.images.add({ blob: spec.imageBlob, fit: "cover", alt: "Supporting visual" }).position = { left: 710, top: 184, width: 510, height: 450 };
    slide.shapes.add({ geometry: "roundRect", position: { left: 710, top: 184, width: 510, height: 450 }, fill: "#ffffff08", line: { width: 1, fill: "#ffffff24" } });
    if (spec.cards) {
      let x = 60;
      let y = 246;
      const cols = spec.cols || 2;
      const cardW = 280;
      const cardH = 150;
      spec.cards.forEach((c, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        x = 60 + col * (cardW + 18);
        y = 246 + row * (cardH + 16);
        addShape(slide, x, y, cardW, cardH, dark ? "#ffffff0d" : "#ffffff", true, dark ? "#ffffff20" : line);
        addText(slide, c.title, x + 16, y + 16, cardW - 32, 22, { size: 16, color: dark ? white : navy, bold: true, typeface: "Arial" });
        addText(slide, c.text, x + 16, y + 48, cardW - 32, cardH - 54, { size: 14, color: dark ? "#d7dee8" : text, typeface: "Arial" });
      });
    }
    if (spec.bullets) {
      addShape(slide, 60, 246, 590, 360, dark ? "#ffffff0d" : "#ffffff", true, dark ? "#ffffff20" : line);
      addText(slide, "", 0, 0, 0, 0);
      spec.bullets.forEach((bullet, i) => {
        const y = 284 + i * 42;
        addShape(slide, 80, y + 6, 10, 10, i % 2 ? blue : red, true);
        addText(slide, bullet, 105, y, 500, 24, { size: 16, color: dark ? white : navy, typeface: "Arial" });
      });
    }
  } else if (spec.kind === "table") {
    addShape(slide, 60, 242, 1160, 390, dark ? "#ffffff0d" : "#ffffff", true, dark ? "#ffffff20" : line);
    const headers = spec.table.headers;
    const rows = spec.table.rows;
    const colW = spec.table.widths || [260, 900];
    const startX = 86;
    const rowH = 40;
    headers.forEach((h, i) => {
      const x = startX + (i === 0 ? 0 : colW[0]);
      addText(slide, h, x, 260, colW[i], 24, { size: 14, color: dark ? white : navy, bold: true, typeface: "Arial" });
    });
    rows.forEach((row, r) => {
      const y = 306 + r * rowH;
      addText(slide, row[0], 86, y, colW[0] - 20, 28, { size: 15, color: dark ? white : text, typeface: "Arial" });
      addText(slide, row[1], 86 + colW[0], y, colW[1] - 20, 28, { size: 15, color: dark ? white : text, typeface: "Arial" });
    });
  }

  if (spec.image && !spec.imageBlob) {
    slide.images.add({ blob: spec.imageBlob, fit: "cover", alt: "Asset" }).position = { left: 740, top: 198, width: 460, height: 420 };
  }

  addFooter(slide, index + 1, dark);
}

function addShape(slide, left, top, width, height, fill, radius = true, lineFill = fill) {
  return slide.shapes.add({
    geometry: radius ? "roundRect" : "rect",
    position: { left, top, width, height },
    fill,
    line: { width: 1, fill: lineFill },
  });
}

function addText(slide, text, left, top, width, height, opts = {}) {
  const shape = slide.shapes.add({
    geometry: "rect",
    position: { left, top, width, height },
    fill: opts.fill ?? "#FFFFFF00",
    line: { width: 0, fill: "#FFFFFF00" },
  });
  shape.text = text;
  shape.text.typeface = opts.typeface ?? "Arial";
  shape.text.fontSize = opts.size ?? 22;
  shape.text.color = opts.color ?? navy;
  shape.text.bold = Boolean(opts.bold);
  shape.text.alignment = opts.align ?? "left";
  shape.text.verticalAlignment = opts.valign ?? "top";
  shape.text.insets = opts.insets ?? { left: 0, right: 0, top: 0, bottom: 0 };
  shape.text.autoFit = "shrinkText";
  return shape;
}

function addFooter(slide, n, dark = false) {
  addText(slide, `${preparedBy} | Confidential`, 60, 676, 420, 20, { size: 13, color: dark ? "#aebbd0" : slate, typeface: "Arial" });
  addText(slide, String(n).padStart(2, "0"), 1170, 676, 42, 20, { size: 13, color: dark ? "#aebbd0" : slate, typeface: "Arial", align: "right" });
}

async function buildPptx() {
  const { Presentation, PresentationFile } = await import("file:///C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs");
  const deck = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  deck.theme.colorScheme = {
    name: "Torque Empire Corporate",
    themeColors: { accent1: red, accent2: blue, bg1: white, bg2: navy, tx1: navy, tx2: white },
  };

  const specData = pageDataForDeck();
  const loaded = {};
  for (const [key, file] of Object.entries(assets)) {
    loaded[key] = await fs.readFile(file);
  }
  for (const spec of specData) {
    if (spec.image) spec.imageBlob = loaded[Object.keys(assets).find((k) => assets[k] === spec.image) ? Object.keys(assets).find((k) => assets[k] === spec.image) : null];
    if (spec.image && !spec.imageBlob) spec.imageBlob = await fs.readFile(spec.image);
  }

  for (let i = 0; i < specData.length; i += 1) {
    const spec = specData[i];
    const slide = deck.slides.add();
    if (spec.kind === "cover") {
      spec.imageBlob = await fs.readFile(spec.image);
    }
    if (spec.kind === "imageCards" || spec.kind === "split") {
      spec.imageBlob = await fs.readFile(spec.image);
    }
    renderDeckSlide(slide, spec, i);
    if (spec.kind === "cover") {
      slide.speakerNotes.setText(`${spec.title} cover slide for the executive corporate profile.`);
    } else {
      slide.speakerNotes.setText(`${spec.title} slide for the Torque Empire corporate profile.`);
    }
  }

  const pptx = await PresentationFile.exportPptx(deck);
  const pptxPath = path.join(corporateDir, `${CORPORATE_PROFILE_TITLE}.pptx`);
  await pptx.save(pptxPath);
  await patchPptxMetadata(pptxPath, {
    title: CORPORATE_PROFILE_TITLE,
    subject: "Executive corporate profile",
    creatorName: creator,
    slideCount: specData.length,
  });
}

async function buildHtmlPdf() {
  const pages = buildCorporatePdfPages();
  const html = await inlineSvgImages(
    buildHtmlDoc(CORPORATE_PROFILE_TITLE, pages, pathToFileURL(`${corporateDir}${path.sep}`).href),
    pathToFileURL(`${corporateDir}${path.sep}`).href,
  );
  const htmlPath = path.join(corporateDir, `${CORPORATE_PROFILE_TITLE}.html`);
  const pdfPath = path.join(corporateDir, `${CORPORATE_PROFILE_TITLE}.pdf`);
  await writeText(htmlPath, html);
  await renderPdf(pdfPath, html, {
    title: CORPORATE_PROFILE_PDF_TITLE,
    subject: "Executive corporate profile",
    keywords: ["Torque Empire", "Corporate Profile", "Executive Edition 2026", "Government", "Enterprise"],
    reference: "TE-CP-2026",
  });
}

async function buildBrandGuide() {
  const html = await inlineSvgImages(
    buildHtmlDoc(BRAND_GUIDE_TITLE, buildCorporateBrandPages(), pathToFileURL(`${brandDir}${path.sep}`).href),
    pathToFileURL(`${brandDir}${path.sep}`).href,
  );
  const pdfPath = path.join(brandDir, `${BRAND_GUIDE_TITLE}.pdf`);
  await renderPdf(pdfPath, html, {
    title: BRAND_GUIDE_TITLE,
    subject: "Brand guidelines",
    keywords: ["Torque Empire", "Brand", "Guidelines", "Executive"],
    reference: "TE-BRAND-2026",
  });
}

async function verifyRelease() {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const JSZip = (await import("jszip")).default;
  const terms = ["Draft", "Internal Release", "Executive Review", "Board Review", "Version 2.1", "v2.1", "v3.0", "unsupported", "generic AI imagery"];
  const pdfs = [
    path.join(corporateDir, `${CORPORATE_PROFILE_TITLE}.pdf`),
    path.join(brandDir, `${BRAND_GUIDE_TITLE}.pdf`),
  ];
  const hits = [];
  for (const file of pdfs) {
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await fs.readFile(file)), disableWorker: true }).promise;
    let textContent = "";
    for (let i = 1; i <= doc.numPages; i += 1) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      textContent += content.items.map((item) => item.str).join(" ");
    }
    for (const term of terms) if (textContent.includes(term)) hits.push(`${path.basename(file)} contains ${term}`);
  }

  const deckZip = await JSZip.loadAsync(await fs.readFile(path.join(corporateDir, `${CORPORATE_PROFILE_TITLE}.pptx`)));
  let pptxText = "";
  for (const name of Object.keys(deckZip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))) {
    pptxText += await deckZip.file(name).async("string");
  }
  for (const term of terms) if (pptxText.includes(term)) hits.push(`pptx contains ${term}`);
  return hits;
}

async function main() {
  await ensureDir(outputRoot);
  await ensureDir(corporateDir);
  await ensureDir(brandDir);
  await ensureDir(photoDir);
  await ensureDir(svgDir);
  await ensureDir(iconDir);

  await writeText(path.join(outputRoot, "README.txt"), "Torque Empire corporate profile publication set.");
  await buildAssets();
  await buildHtmlPdf();
  await buildBrandGuide();
  await buildPptx();
  const hits = await verifyRelease();
  if (hits.length) throw new Error(hits.join("; "));
  console.log("Torque Empire corporate profile generated");
}

try {
  await main();
} finally {
  await browser.close();
}
