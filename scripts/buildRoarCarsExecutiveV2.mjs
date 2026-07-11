import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const root = process.cwd();
const distDir = path.join(root, "dist");
const assetDir = path.join(root, "assets", "executive");
const signatureAssetPath = path.join(root, "assets", "corporate", "signatures", "Chadwin Karanie - Executive Signature.png");
const signatureAssetDataUrl = `data:image/png;base64,${(await fs.readFile(signatureAssetPath)).toString("base64")}`;
const styleDir = path.join(root, "styles");
const distBaseHref = pathToFileURL(`${distDir}${path.sep}`).href;

const navy = "#07111f";
const charcoal = "#2b2f33";
const steel = "#40515e";
const white = "#ffffff";
const pale = "#f4f6f8";
const blue = "#1f6feb";
const red = "#c1121f";
const line = "#d9dee5";

await fs.mkdir(distDir, { recursive: true });
await fs.mkdir(assetDir, { recursive: true });
await fs.mkdir(styleDir, { recursive: true });

function svgShell(title, subtitle, body = "") {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000" role="img" aria-label="${title}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${navy}"/>
      <stop offset="0.58" stop-color="#152232"/>
      <stop offset="1" stop-color="${charcoal}"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="1000" fill="url(#bg)"/>
  <rect x="90" y="84" width="1420" height="832" rx="34" fill="#ffffff" fill-opacity="0.055" stroke="#ffffff" stroke-opacity="0.12"/>
  <rect x="126" y="132" width="86" height="8" fill="${red}"/>
  <text x="126" y="205" fill="${white}" font-family="Arial, sans-serif" font-size="54" font-weight="700">${title}</text>
  <text x="126" y="260" fill="#cfd8e3" font-family="Arial, sans-serif" font-size="26">${subtitle}</text>
  ${body}
</svg>`;
}

function metricCard(x, y, w, h, title, value, accent = blue) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="#0b1320" stroke="#223044"/>
  <rect x="${x}" y="${y}" width="7" height="${h}" rx="3" fill="${accent}"/>
  <text x="${x + 22}" y="${y + 34}" fill="#94a3b8" font-family="Arial" font-size="18" font-weight="700">${title}</text>
  <text x="${x + 22}" y="${y + 78}" fill="#ffffff" font-family="Arial" font-size="36" font-weight="800">${value}</text>`;
}

function panel(x, y, w, h, title) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="#ffffff" fill-opacity="0.075" stroke="#ffffff" stroke-opacity="0.14"/>
  <text x="${x + 22}" y="${y + 38}" fill="#ffffff" font-family="Arial" font-size="22" font-weight="800">${title}</text>`;
}

function barSeries(x, y, values, color = blue) {
  return values.map((v, i) => `<rect x="${x + i * 34}" y="${y + 112 - v}" width="18" height="${v}" rx="5" fill="${i % 3 === 0 ? red : color}" opacity="${i % 2 ? .72 : .95}"/>`).join("");
}

function dashboardShell(title, subtitle, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000" role="img" aria-label="${title}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#07111f"/>
      <stop offset="0.62" stop-color="#101d2d"/>
      <stop offset="1" stop-color="#26313c"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="125%">
      <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#000000" flood-opacity=".28"/>
    </filter>
  </defs>
  <rect width="1600" height="1000" fill="url(#bg)"/>
  <rect x="82" y="76" width="1436" height="848" rx="34" fill="#07111f" stroke="#233246" filter="url(#shadow)"/>
  <rect x="82" y="76" width="1436" height="78" rx="34" fill="#0b1320"/>
  <rect x="82" y="139" width="1436" height="15" fill="#0b1320"/>
  <rect x="116" y="102" width="78" height="8" rx="4" fill="${red}"/>
  <text x="116" y="137" fill="#ffffff" font-family="Arial" font-size="34" font-weight="800">${title}</text>
  <text x="1180" y="134" fill="#94a3b8" font-family="Arial" font-size="18">${subtitle}</text>
  ${body}
</svg>`;
}

function workflowShell(title, subtitle) {
  return svgShell(title, subtitle, `
    <defs>
      <marker id="workflowArrow" markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto">
        <path d="M0,0 L0,6 L8,3 z" fill="${red}"/>
      </marker>
    </defs>
    ${[
      ["Customer", 120],
      ["Application", 320],
      ["OCR", 520],
      ["Verification", 720],
      ["Risk Engine", 920],
      ["Staff Review", 1120],
      ["Decision", 1320],
    ].map(([label, x]) => `<rect x="${x}" y="430" width="170" height="74" rx="16" fill="#0b1320" stroke="${label === "Risk Engine" ? blue : red}"/><text x="${x + 85}" y="476" text-anchor="middle" fill="${white}" font-family="Arial" font-size="22" font-weight="800">${label}</text>`).join("")}
    ${[290, 490, 690, 890, 1090, 1290].map((x) => `<path d="M${x} 467 H${x + 30}" stroke="${red}" stroke-width="7" marker-end="url(#workflowArrow)"/>`).join("")}
    <rect x="120" y="610" width="1370" height="150" rx="20" fill="#ffffff" fill-opacity="0.05" stroke="#ffffff" stroke-opacity="0.14"/>
    ${[
      "Audit Trail",
      "Reporting",
    ].map((label, i) => `<rect x="${520 + i * 250}" y="650" width="210" height="58" rx="14" fill="#ffffff" fill-opacity="0.08" stroke="${i ? blue : red}"/><text x="${625 + i * 250}" y="687" text-anchor="middle" fill="${white}" font-family="Arial" font-size="22" font-weight="800">${label}</text>`).join("")}
    <path d="M140 685 H500" stroke="${red}" stroke-width="7" marker-end="url(#workflowArrow)"/>
    <path d="M980 685 H1140" stroke="${red}" stroke-width="7" marker-end="url(#workflowArrow)"/>
    <text x="140" y="635" fill="#cfd8e3" font-family="Arial" font-size="22">Customer</text>
    <text x="200" y="635" fill="#cfd8e3" font-family="Arial" font-size="22">↓</text>
    <text x="240" y="635" fill="#cfd8e3" font-family="Arial" font-size="22">Application</text>
    <text x="345" y="635" fill="#cfd8e3" font-family="Arial" font-size="22">↓</text>
    <text x="385" y="635" fill="#cfd8e3" font-family="Arial" font-size="22">OCR</text>
    <text x="445" y="635" fill="#cfd8e3" font-family="Arial" font-size="22">↓</text>
    <text x="485" y="635" fill="#cfd8e3" font-family="Arial" font-size="22">Verification</text>
    <text x="612" y="635" fill="#cfd8e3" font-family="Arial" font-size="22">↓</text>
    <text x="652" y="635" fill="#cfd8e3" font-family="Arial" font-size="22">Risk Engine</text>
    <text x="792" y="635" fill="#cfd8e3" font-family="Arial" font-size="22">↓</text>
    <text x="832" y="635" fill="#cfd8e3" font-family="Arial" font-size="22">Staff Review</text>
    <text x="975" y="635" fill="#cfd8e3" font-family="Arial" font-size="22">↓</text>
    <text x="1015" y="635" fill="#cfd8e3" font-family="Arial" font-size="22">Decision</text>
    <text x="1110" y="635" fill="#cfd8e3" font-family="Arial" font-size="22">↓</text>
    <text x="1150" y="635" fill="#cfd8e3" font-family="Arial" font-size="22">Audit Trail</text>
    <text x="1290" y="635" fill="#cfd8e3" font-family="Arial" font-size="22">↓</text>
    <text x="1330" y="635" fill="#cfd8e3" font-family="Arial" font-size="22">Reporting</text>
  `);
}

const diagramAssets = {
  "architecture.svg": svgShell("Enterprise Architecture", "Portal | API | Workflow | Intelligence | Data | Infrastructure | Security", `
    ${[["Customer Portal",150,315],["Dealer Portal",465,315],["Staff Portal",780,315],["Administration",1095,315]].map(([t,x,y])=>`<rect x="${x}" y="${y}" width="250" height="74" rx="14" fill="#0b1320" stroke="${red}"/><text x="${x+24}" y="${y+46}" fill="${white}" font-family="Arial" font-size="24" font-weight="800">${t}</text>`).join("")}
    <path d="M800 405 V462" stroke="${blue}" stroke-width="8" stroke-linecap="round" marker-end="url(#arrow)"/>
    <defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="${blue}"/></marker></defs>
    <rect x="590" y="460" width="420" height="72" rx="16" fill="${red}"/><text x="800" y="506" text-anchor="middle" fill="${white}" font-family="Arial" font-size="28" font-weight="800">API Gateway</text>
    ${[["Authentication",150,580],["Role Management",420,580],["Workflow Engine",690,580],["Notification Engine",960,580],["Document Verification",1230,580],["OCR Engine",285,700],["AI Intelligence",555,700],["Audit Engine",825,700],["Application Database",1095,700]].map(([t,x,y],i)=>`<rect x="${x}" y="${y}" width="220" height="72" rx="14" fill="#ffffff" fill-opacity="0.09" stroke="${i%2?blue:red}" stroke-opacity=".9"/><text x="${x+18}" y="${y+44}" fill="${white}" font-family="Arial" font-size="21" font-weight="700">${t}</text>`).join("")}
    ${[["Document Vault",190,820],["Audit Logs",465,820],["Analytics",740,820],["Ubuntu VPS",1015,820],["Encrypted Backups",1290,820]].map(([t,x,y],i)=>`<rect x="${x}" y="${y}" width="215" height="58" rx="12" fill="#0b1320" stroke="${i<3?blue:red}"/><text x="${x+18}" y="${y+37}" fill="${white}" font-family="Arial" font-size="19" font-weight="700">${t}</text>`).join("")}
    <text x="126" y="930" fill="#cfd8e3" font-family="Arial" font-size="22">Monitoring | Firewall | Security controls operate across every layer</text>
  `),
  "roadmap.svg": svgShell("Project Roadmap", "Discovery | Migration | Security | Testing | Go Live | Support | Future AI", `
    ${["Discovery","Migration","Security","Testing","Go Live","Support","Future AI"].map((t,i)=>{
      const x = 125 + i*195;
      return `<circle cx="${x}" cy="520" r="54" fill="${i<5?red:blue}"/><text x="${x}" y="530" text-anchor="middle" fill="${white}" font-family="Arial" font-size="24" font-weight="700">${i+1}</text><text x="${x}" y="625" text-anchor="middle" fill="${white}" font-family="Arial" font-size="24">${t}</text>`;
    }).join("")}
    <line x1="125" y1="520" x2="1295" y2="520" stroke="#ffffff" stroke-opacity="0.38" stroke-width="10"/>
  `),
  "security.svg": svgShell("Defence in Depth", "Layered protection from internet entry to monitoring and recovery", `
    <defs><marker id="secArrow" markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="${blue}"/></marker></defs>
    ${["Internet","Web Firewall","Reverse Proxy","Application Layer","Authentication","AI Verification","Encrypted Database","Immutable Audit Logs","Encrypted Backup","24/7 Monitoring"].map((t,i)=>{
      const x = 280 + (i%2)*560; const y = 310 + Math.floor(i/2)*108;
      return `<rect x="${x}" y="${y}" width="430" height="68" rx="15" fill="${i%2?`#ffffff`:red}" fill-opacity="${i % 2 ? .09 : 1}" stroke="${i%2?blue:red}" stroke-opacity=".9"/><text x="${x+28}" y="${y+43}" fill="${white}" font-family="Arial" font-size="25" font-weight="800">${t}</text>${i<9?`<path d="M${x+430} ${y+34} C${x+500} ${y+34}, ${280 + ((i+1)%2)*560 - 70} ${310 + Math.floor((i+1)/2)*108 + 34}, ${280 + ((i+1)%2)*560 - 8} ${310 + Math.floor((i+1)/2)*108 + 34}" fill="none" stroke="${blue}" stroke-width="5" marker-end="url(#secArrow)" opacity=".75"/>`:``}`;
    }).join("")}
  `),
  "dashboard-mockup.svg": dashboardShell("Executive Dashboard", "Executive issue | live operating view", `
    ${metricCard(118,190,204,106,"Applications Today","42",blue)}
    ${metricCard(342,190,204,106,"Pending Review","18",red)}
    ${metricCard(566,190,204,106,"Approved","27",blue)}
    ${metricCard(790,190,204,106,"Declined","06",red)}
    ${metricCard(1014,190,204,106,"AI Risk Alerts","09",red)}
    ${metricCard(1238,190,204,106,"Avg Processing","2.4h",blue)}
    ${panel(118,330,610,245,"Monthly Pipeline")}${barSeries(162,415,[54,68,82,74,96,88,112,102,126,118,138,130])}
    ${panel(758,330,326,245,"Dealer Performance")}${["North","Central","South","Digital"].map((t,i)=>`<text x="790" y="${418+i*38}" fill="#cbd5e1" font-family="Arial" font-size="19">${t}</text><rect x="900" y="${400+i*38}" width="${118+i*34}" height="17" rx="8" fill="${i%2?red:blue}"/>`).join("")}
    ${panel(1114,330,328,245,"Compliance Status")}<circle cx="1278" cy="457" r="62" fill="none" stroke="#20304a" stroke-width="22"/><circle cx="1278" cy="457" r="62" fill="none" stroke="${blue}" stroke-width="22" stroke-dasharray="310 390" transform="rotate(-90 1278 457)"/><text x="1278" y="468" text-anchor="middle" fill="#ffffff" font-family="Arial" font-size="34" font-weight="800">88%</text>
    ${panel(118,610,610,230,"Recent Activity Feed")}${["Application RC-1042 moved to verification","Dealer review completed for applicant queue","Risk alert escalated for document mismatch","Support check completed: all services online"].map((t,i)=>`<circle cx="154" cy="${676+i*43}" r="7" fill="${i===2?red:blue}"/><text x="176" y="${683+i*43}" fill="#d8e0ea" font-family="Arial" font-size="19">${t}</text>`).join("")}
    ${panel(758,610,684,230,"System Health")}<text x="802" y="690" fill="#ffffff" font-family="Arial" font-size="34" font-weight="800">Operational</text><text x="802" y="736" fill="#94a3b8" font-family="Arial" font-size="22">Hosting, backups, monitoring and SSL checks active</text>${["API","Database","Vault","Monitoring"].map((t,i)=>`<rect x="${805+i*150}" y="782" width="118" height="34" rx="17" fill="#0f2f23" stroke="#1f8f57"/><text x="${864+i*150}" y="805" text-anchor="middle" fill="#d7fbe8" font-family="Arial" font-size="16" font-weight="700">${t}</text>`).join("")}
  `),
  "dealer-dashboard.svg": dashboardShell("Dealer Workspace", "Inventory | applications | customer follow-up", `
    ${metricCard(118,190,260,105,"Current Inventory","126",blue)}
    ${metricCard(404,190,260,105,"Applications Submitted","38",blue)}
    ${metricCard(690,190,260,105,"Finance Status","71%",red)}
    ${metricCard(976,190,260,105,"Outstanding Docs","14",red)}
    ${panel(118,335,585,250,"Current Inventory")}${["2024 Toyota Hilux","2023 VW Polo","2022 Ford Ranger","2024 Suzuki Swift"].map((t,i)=>`<text x="152" y="${408+i*42}" fill="#ffffff" font-family="Arial" font-size="20" font-weight="700">${t}</text><text x="510" y="${408+i*42}" fill="#94a3b8" font-family="Arial" font-size="18">Finance active</text>`).join("")}
    ${panel(736,335,706,250,"Customer Messages")}${["Proof of address requested","Applicant selected alternate vehicle","Dealer follow-up due today","Lender response received"].map((t,i)=>`<rect x="772" y="${386+i*45}" width="620" height="32" rx="9" fill="#ffffff" fill-opacity="${i % 2 ? .06 : .1}"/><text x="790" y="${409+i*45}" fill="#d8e0ea" font-family="Arial" font-size="18">${t}</text>`).join("")}
    ${panel(118,620,605,220,"Performance KPIs")}${barSeries(164,690,[46,70,62,88,94,78,102,112],blue)}
    ${panel(756,620,686,220,"Finance Status")}${["Submitted","Documents pending","Verification","Dealer review","Lender decision"].map((t,i)=>`<text x="790" y="${685+i*31}" fill="#d8e0ea" font-family="Arial" font-size="18">${t}</text><rect x="1010" y="${669+i*31}" width="${290-i*34}" height="14" rx="7" fill="${i===1?red:blue}"/>`).join("")}
  `),
  "verification-dashboard.svg": dashboardShell("Document Verification", "AI-assisted review with human approval", `
    ${panel(118,190,340,250,"Applicant Profile")}<text x="150" y="262" fill="#ffffff" font-family="Arial" font-size="27" font-weight="800">Applicant RC-1042</text><text x="150" y="307" fill="#94a3b8" font-family="Arial" font-size="19">Vehicle finance application</text><text x="150" y="352" fill="#d8e0ea" font-family="Arial" font-size="18">ID | Payslip | Bank statement</text>
    ${panel(488,190,305,250,"OCR Confidence")}<circle cx="640" cy="322" r="76" fill="none" stroke="#20304a" stroke-width="24"/><circle cx="640" cy="322" r="76" fill="none" stroke="${blue}" stroke-width="24" stroke-dasharray="402 478" transform="rotate(-90 640 322)"/><text x="640" y="335" text-anchor="middle" fill="#ffffff" font-family="Arial" font-size="39" font-weight="800">91%</text>
    ${panel(823,190,300,250,"Identity Match")}<text x="858" y="318" fill="#ffffff" font-family="Arial" font-size="44" font-weight="800">Match</text><text x="858" y="366" fill="#94a3b8" font-family="Arial" font-size="19">ID and application aligned</text>
    ${panel(1153,190,289,250,"Risk Score")}<text x="1190" y="318" fill="${red}" font-family="Arial" font-size="46" font-weight="900">Medium</text><text x="1190" y="366" fill="#94a3b8" font-family="Arial" font-size="19">Human review required</text>
    ${panel(118,475,435,365,"Tamper Detection")}${["Metadata consistency","Image alteration","Duplicate document","Cross-document mismatch"].map((t,i)=>`<text x="154" y="${552+i*45}" fill="#d8e0ea" font-family="Arial" font-size="20">${t}</text><rect x="420" y="${534+i*45}" width="82" height="24" rx="12" fill="${i===1?red:blue}"/><text x="461" y="${552+i*45}" text-anchor="middle" fill="#ffffff" font-family="Arial" font-size="14" font-weight="800">${i===1?"FLAG":"OK"}</text>`).join("")}
    ${panel(585,475,390,365,"AI Recommendation")}<text x="625" y="565" fill="#ffffff" font-family="Arial" font-size="34" font-weight="800">Review</text><text x="625" y="613" fill="#94a3b8" font-family="Arial" font-size="21">AI supports decision-making.</text><text x="625" y="654" fill="#d8e0ea" font-family="Arial" font-size="19">Human approval remains required.</text><rect x="625" y="704" width="265" height="44" rx="22" fill="#102f45" stroke="${blue}"/><text x="758" y="733" text-anchor="middle" fill="#d7efff" font-family="Arial" font-size="18" font-weight="800">Human Review Status: Open</text>
    ${panel(1005,475,437,365,"Timeline & Audit Log")}${["Uploaded","OCR complete","Identity checked","Risk flagged","Reviewer assigned"].map((t,i)=>`<circle cx="1048" cy="${548+i*45}" r="9" fill="${i===3?red:blue}"/><text x="1072" y="${555+i*45}" fill="#d8e0ea" font-family="Arial" font-size="19">${t}</text>`).join("")}
  `),
  "fraud-dashboard.svg": svgShell("Fraud Risk Dashboard", "Risk indicators, cross-validation and review flags", `
    ${["Fake payslips","Altered IDs","Bank statements","Duplicates","Metadata","Behaviour"].map((t,i)=>{
      const x = 160 + (i%3)*430; const y = 360 + Math.floor(i/3)*190;
      return `<rect x="${x}" y="${y}" width="350" height="130" rx="20" fill="#ffffff" fill-opacity="0.1" stroke="${i<2?red:blue}" stroke-opacity="0.85"/><text x="${x+24}" y="${y+76}" fill="${white}" font-family="Arial" font-size="28" font-weight="700">${t}</text>`;
    }).join("")}
  `),
  "timeline-dashboard.svg": svgShell("Timeline Dashboard", "Customer journey and verification events", `
    <line x1="220" y1="560" x2="1370" y2="560" stroke="#ffffff" stroke-opacity="0.35" stroke-width="8"/>
    ${["Apply","Upload","OCR","Verify","Review","Decision"].map((t,i)=>{
      const x = 220 + i*230;
      return `<circle cx="${x}" cy="560" r="42" fill="${i<3?blue:red}"/><text x="${x}" y="650" text-anchor="middle" fill="${white}" font-family="Arial" font-size="26">${t}</text>`;
    }).join("")}
  `),
  "operations-dashboard.svg": dashboardShell("Operations Dashboard", "Processing | review queue | staff activity", `
    ${metricCard(118,190,248,106,"Daily Processing","84",blue)}
    ${metricCard(392,190,248,106,"Verification Queue","22",red)}
    ${metricCard(666,190,248,106,"Manual Reviews","11",red)}
    ${metricCard(940,190,248,106,"Fraud Alerts","07",red)}
    ${metricCard(1214,190,228,106,"Processing Time","2.4h",blue)}
    ${panel(118,335,640,245,"Daily Processing")}${barSeries(165,421,[40,66,72,58,90,106,86,120,112,128],blue)}
    ${panel(790,335,652,245,"Staff Activity")}${["Verification","Dealer support","Escalations","Resolved"].map((t,i)=>`<text x="830" y="${420+i*40}" fill="#d8e0ea" font-family="Arial" font-size="20">${t}</text><rect x="1030" y="${403+i*40}" width="${230+i*52}" height="17" rx="8" fill="${i===2?red:blue}"/>`).join("")}
    ${panel(118,620,1324,220,"Queue Prioritisation")} ${["High risk review","Missing documents","Lender response","Dealer follow-up","Ready for handover"].map((t,i)=>`<rect x="${154+i*250}" y="700" width="210" height="54" rx="14" fill="#0b1320" stroke="${i<2?red:blue}"/><text x="${259+i*250}" y="734" text-anchor="middle" fill="#ffffff" font-family="Arial" font-size="17" font-weight="800">${t}</text>`).join("")}
  `),
  "executive-analytics.svg": dashboardShell("Executive Analytics", "Trends | ratios | ranking | performance", `
    ${panel(118,190,490,265,"Application Trends")}${barSeries(165,295,[50,70,80,64,94,118,110,132,144,126],blue)}
    ${panel(638,190,385,265,"Approval Ratios")}<circle cx="830" cy="328" r="78" fill="none" stroke="#20304a" stroke-width="26"/><circle cx="830" cy="328" r="78" fill="none" stroke="${blue}" stroke-width="26" stroke-dasharray="352 490" transform="rotate(-90 830 328)"/><text x="830" y="340" text-anchor="middle" fill="#ffffff" font-family="Arial" font-size="39" font-weight="800">72%</text>
    ${panel(1053,190,389,265,"Fraud Indicators")}${["Metadata","Duplicate","Mismatch","Behaviour"].map((t,i)=>`<text x="1090" y="${276+i*40}" fill="#d8e0ea" font-family="Arial" font-size="19">${t}</text><rect x="1250" y="${259+i*40}" width="${96+i*28}" height="16" rx="8" fill="${i<2?red:blue}"/>`).join("")}
    ${panel(118,490,430,350,"Monthly Growth")}<path d="M165 755 L220 725 L275 735 L330 680 L385 650 L440 612 L502 585" fill="none" stroke="${blue}" stroke-width="8" stroke-linecap="round"/><circle cx="502" cy="585" r="12" fill="${red}"/>
    ${panel(580,490,385,350,"Dealer Rankings")}${["North","Digital","Central","South","Partner"].map((t,i)=>`<text x="620" y="${574+i*42}" fill="#ffffff" font-family="Arial" font-size="19" font-weight="700">${i+1}. ${t}</text><text x="860" y="${574+i*42}" fill="#94a3b8" font-family="Arial" font-size="18">${92-i*7}%</text>`).join("")}
    ${panel(997,490,445,350,"Operational Performance")}<text x="1040" y="585" fill="#ffffff" font-family="Arial" font-size="38" font-weight="900">Stable</text><text x="1040" y="638" fill="#94a3b8" font-family="Arial" font-size="21">Application flow, review throughput and support controls are visible to leadership.</text>
  `),
  "customer-journey-v3.svg": svgShell("Customer Journey", "Discover | Engage | Apply | Verify | Approve | Deliver", `
    <defs><marker id="journeyArrow" markerWidth="11" markerHeight="11" refX="8" refY="3.5" orient="auto"><path d="M0,0 L0,7 L9,3.5 z" fill="${red}"/></marker></defs>
    ${[
      ["Discover",["Vehicle visibility across website","and digital channels"],`<circle cx="0" cy="0" r="26"/><path d="M18 18 L42 42"/>`],
      ["Engage",["Customer enquiry and","vehicle selection"],`<path d="M-30 -20 h60 a16 16 0 0 1 16 16 v22 a16 16 0 0 1 -16 16 h-20 l-22 18 v-18 h-18 a16 16 0 0 1 -16 -16 v-22 a16 16 0 0 1 16 -16z"/>`],
      ["Apply",["Finance application and secure","document submission"],`<path d="M-22 -38 h34 l28 28 v48 h-62z"/><path d="M12 -38 v28 h28"/><path d="M-8 8 h30 M-8 26 h30"/>`],
      ["Verify",["AI-assisted verification and","fraud screening"],`<path d="M0 -42 l42 18 v30 c0 28 -18 46 -42 58 c-24 -12 -42 -30 -42 -58 v-30z"/><path d="M-18 2 l14 14 l26 -32"/>`],
      ["Approve",["Dealer review and","lender decision"],`<circle cx="0" cy="0" r="42"/><path d="M-20 0 l14 16 l30 -34"/>`],
      ["Deliver",["Vehicle handover and ongoing","customer support"],`<path d="M-48 0 h18 l14 -22 h52 l22 22 h18 v28 h-124z"/><circle cx="-26" cy="32" r="10"/><circle cx="44" cy="32" r="10"/><path d="M-4 -22 v22 h42"/>`]
    ].map(([t,d,icon],i)=>{
      const x = 130 + (i%3)*445; const y = i<3?340:650;
      return `<rect x="${x}" y="${y}" width="345" height="150" rx="18" fill="#0b1320" stroke="#223044"/><rect x="${x}" y="${y}" width="8" height="150" rx="4" fill="${red}"/><g transform="translate(${x+287} ${y+74}) scale(.58)" fill="none" stroke="#d7dee8" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" opacity=".95">${icon}</g><text x="${x+32}" y="${y+60}" fill="${white}" font-family="Arial" font-size="30" font-weight="900">${i+1}. ${t}</text><text x="${x+32}" y="${y+100}" fill="#cbd5e1" font-family="Arial" font-size="18">${d[0]}</text><text x="${x+32}" y="${y+124}" fill="#cbd5e1" font-family="Arial" font-size="18">${d[1]}</text>`;
    }).join("")}
    <path d="M475 415 H555" stroke="${red}" stroke-width="7" marker-end="url(#journeyArrow)"/><path d="M920 415 H1000" stroke="${red}" stroke-width="7" marker-end="url(#journeyArrow)"/><path d="M1192 492 C1192 562 575 590 575 650" fill="none" stroke="${red}" stroke-width="7" marker-end="url(#journeyArrow)" opacity=".85"/><path d="M475 725 H555" stroke="${red}" stroke-width="7" marker-end="url(#journeyArrow)"/><path d="M920 725 H1000" stroke="${red}" stroke-width="7" marker-end="url(#journeyArrow)"/>
  `),
  "workflow.svg": workflowShell("Platform Workflow", "Customer | Application | OCR | Verification | Risk Engine | Staff Review | Decision | Audit Trail | Reporting"),
  "ai-engine.svg": svgShell("AI Engine", "OCR | verification | confidence scoring | risk intelligence", `
    <circle cx="800" cy="560" r="210" fill="#ffffff" fill-opacity="0.08" stroke="${blue}" stroke-width="10"/>
    <circle cx="800" cy="560" r="110" fill="#ffffff" fill-opacity="0.1" stroke="${red}" stroke-width="6"/>
    <text x="800" y="575" text-anchor="middle" fill="${white}" font-family="Arial" font-size="48" font-weight="700">AI</text>
    ${["OCR","Identity","Risk","Audit"].map((t,i)=>`<text x="${360+i*290}" y="850" fill="#cfd8e3" font-family="Arial" font-size="30">${t}</text>`).join("")}
  `),
  "document-verification.svg": svgShell("Document Verification", "OCR, identity consistency, tamper checks and audit trail", `
    <rect x="270" y="320" width="390" height="530" rx="18" fill="#ffffff" fill-opacity="0.12"/>
    <rect x="330" y="410" width="270" height="18" fill="#ffffff" fill-opacity="0.5"/>
    <rect x="330" y="470" width="230" height="18" fill="#ffffff" fill-opacity="0.36"/>
    <rect x="330" y="530" width="285" height="18" fill="#ffffff" fill-opacity="0.36"/>
    <path d="M885 590 l78 78 l175 -210" fill="none" stroke="${blue}" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>
  `),
};

for (const [name, content] of Object.entries(diagramAssets)) {
  await fs.writeFile(path.join(assetDir, name), content, "utf8");
}

const css = `
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; background: #dfe4ea; color: ${navy}; font-family: Arial, Helvetica, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 18mm; background: ${white}; page-break-after: always; position: relative; overflow: hidden; }
.page:last-child { page-break-after: auto; }
.dark { background: ${navy}; color: ${white}; }
.hero { padding: 0; background: ${navy}; color: ${white}; }
.hero .plate { position: absolute; inset: 0; background: linear-gradient(135deg, rgba(7,17,31,.96), rgba(21,34,50,.78)), url("../assets/executive/dashboard-mockup.svg") center/cover; }
.hero-inner { position: relative; min-height: 297mm; padding: 24mm 20mm; display: flex; flex-direction: column; justify-content: space-between; }
.kicker { color: ${red}; text-transform: uppercase; letter-spacing: 2.4px; font-size: 9pt; font-weight: 800; margin-bottom: 8mm; }
h1,h2,h3 { margin: 0; line-height: 1.06; }
h1 { font-size: 39pt; max-width: 160mm; }
h2 { font-size: 25pt; max-width: 170mm; }
h3 { font-size: 13pt; }
p { font-size: 10.5pt; line-height: 1.55; margin: 0; color: #23313f; }
.dark p, .hero p { color: rgba(255,255,255,.84); }
.lead { font-size: 14pt; line-height: 1.45; max-width: 160mm; }
.rule { width: 24mm; height: 1.5mm; background: ${blue}; margin: 7mm 0; }
.red { color: ${red}; }
.blue { color: ${blue}; }
.grid { display: grid; gap: 6mm; }
.two { grid-template-columns: 1fr 1fr; }
.three { grid-template-columns: repeat(3,1fr); }
.four { grid-template-columns: repeat(4,1fr); }
.card { border: 1px solid ${line}; border-radius: 5mm; padding: 6mm; background: ${white}; min-height: 34mm; }
.dark .card { background: rgba(255,255,255,.075); border-color: rgba(255,255,255,.16); }
.card p { margin-top: 3mm; }
.mt { margin-top: 9mm; }
.xl { margin-top: 16mm; }
.footer { position: absolute; left: 18mm; right: 18mm; bottom: 9mm; border-top: 1px solid ${line}; padding-top: 3mm; display: flex; justify-content: space-between; color: #738193; font-size: 8pt; }
.dark .footer { border-color: rgba(255,255,255,.2); color: rgba(255,255,255,.6); }
.asset { width: 100%; border-radius: 5mm; border: 1px solid ${line}; display:block; }
.split { display:grid; grid-template-columns: .9fr 1.1fr; gap: 9mm; align-items:center; }
.comparison { display:grid; grid-template-columns: 1fr 1fr; gap:7mm; }
.big-num { font-size: 26pt; font-weight: 800; color: ${blue}; }
.heat { display:grid; grid-template-columns: repeat(3,1fr); gap:5mm; }
.risk { border-left: 1.8mm solid ${red}; background:${pale}; padding:5mm; border-radius:3mm; min-height:26mm; }
.roadmap { display:grid; grid-template-columns: repeat(4,1fr); border:1px solid ${line}; border-radius:5mm; overflow:hidden; }
.phase { padding:6mm; min-height:72mm; border-right:1px solid ${line}; }
.phase:last-child { border-right:0; }
.badge { width:13mm; height:13mm; border-radius:50%; background:${navy}; color:white; display:grid; place-items:center; font-weight:800; margin-bottom:4mm; }
.signature { display:grid; grid-template-columns:1fr 1fr; gap:9mm; margin-top:9mm; }
.signature-mark { display:flex; flex-direction:column; justify-content:flex-end; min-height:18mm; }
.signature-mark img { display:block; width:auto; max-width:56mm; max-height:16mm; object-fit:contain; }
.signature-name { margin-top:2.5mm; font-size:9pt; font-weight:700; color:${navy}; }
.line { border-bottom:1px solid #9aa6b2; height:12mm; }
.check { display:grid; gap:3.5mm; margin-top:9mm; }
.box { width:5mm; height:5mm; border:1px solid ${steel}; display:inline-block; margin-right:3mm; vertical-align:-1mm; }
.doc-control { display:grid; grid-template-columns: repeat(2, 1fr); gap:3.5mm 7mm; max-width:115mm; }
.doc-control div { border-top:1px solid rgba(255,255,255,.28); padding-top:2.4mm; }
.doc-control strong { display:block; color:#ffffff; font-size:8pt; text-transform:uppercase; letter-spacing:1.2px; margin-bottom:1mm; }
.doc-control span { color:rgba(255,255,255,.84); font-size:10pt; }
.matrix { width:100%; border-collapse:collapse; margin-top:7mm; font-size:8.7pt; }
.matrix th { background:${navy}; color:${white}; text-align:left; padding:3mm; font-size:8pt; text-transform:uppercase; letter-spacing:.8px; }
.matrix td { border:1px solid ${line}; padding:3mm; vertical-align:top; line-height:1.35; color:#23313f; }
.dark .matrix th { background:rgba(255,255,255,.12); }
.dark .matrix td { border-color:rgba(255,255,255,.16); color:rgba(255,255,255,.86); }
.mini { font-size:9.2pt; line-height:1.45; }
.icon { color:${blue}; font-weight:900; margin-right:2mm; }
.flow { display:grid; grid-template-columns: repeat(4,1fr); gap:4mm; margin-top:7mm; }
.flow .card { min-height:29mm; padding:4.5mm; }
.note { border-left:1.8mm solid ${blue}; padding:4mm 5mm; background:${pale}; margin-top:7mm; border-radius:3mm; }
.dark .note { background:rgba(255,255,255,.08); }
.journey { display:grid; grid-template-columns: 1fr 9mm 1fr 9mm 1fr; gap:4.5mm; align-items:stretch; margin-top:9mm; }
.journey-card { position:relative; background:#0b1320; border-radius:9px; padding:7mm 5.5mm 6mm; min-height:49mm; border:1px solid rgba(255,255,255,.08); box-shadow:0 6px 18px rgba(7,17,31,.18); overflow:visible; }
.journey-card::before { content:""; position:absolute; left:0; top:0; bottom:0; width:1.7mm; background:${red}; }
.journey-card.turn::after { content:"\\21B4"; position:absolute; right:5mm; bottom:-10mm; color:${red}; font-size:17pt; font-weight:800; }
.journey-card h3 { color:${white}; font-size:15pt; margin-bottom:3mm; }
.journey-card p { color:#cbd5e1; font-size:10.2pt; line-height:1.42; }
.journey-arrow { display:grid; place-items:center; color:${red}; font-size:19pt; font-weight:800; min-height:49mm; }
`;
await fs.writeFile(path.join(styleDir, "executive-board.css"), css, "utf8");

const issueDate = "1 July 2026";
const documentReference = "TE-RC-EXEC-3.0";
const clientReleaseTitle = "Torque Empire - Roar Cars SA Technology Transformation Strategy";
const clientReleasePdfTitle = "Torque Empire – Roar Cars SA Technology Transformation Strategy";
const clientReleaseSubject = "Executive Technology Transformation Strategy";
const clientReleaseAuthor = "Torque Empire (Pty) Ltd";
const clientReleaseCompany = "Torque Empire (Pty) Ltd";
const clientReleaseKeywords = "Roar Cars SA, Technology Transformation, AI, Vehicle Finance, Executive Strategy, Digital Transformation";
const clientReleaseCreator = "Torque Empire Executive Publications";

function cards(items) {
  return items.map(([title, text, icon = ""]) => `<div class="card"><h3>${icon ? `<span class="icon">${icon}</span>` : ""}${title}</h3><p>${text}</p></div>`).join("");
}

function table(headers, rows) {
  return `<table class="matrix"><thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const capabilityRows = [
  ["Technology Strategy", "Business-aligned technology roadmap and investment sequencing.", "Governance", "Decision rights, reporting cadence, risk control and executive oversight."],
  ["Enterprise Architecture", "Separation of experience, application, intelligence, security and infrastructure layers.", "Cloud Infrastructure", "Hosting, deployment, backup and operating environment design."],
  ["AI Engineering", "OCR, extraction, validation, confidence scoring and human review workflows.", "Cyber Security", "Layered controls, access governance, monitoring and secure operating practices."],
  ["Managed Services", "Monitoring, patch management, incident response and monthly service reporting.", "Executive Reporting", "Board-level visibility across performance, risk, adoption and delivery progress."],
  ["Digital Transformation", "Modernisation of customer, dealer and operational journeys.", "Delivery Management", "Quality gates, acceptance criteria and controlled transition to support."]
];

const riskRows = [
  ["Downtime", "Medium", "Customer application interruption, dealer workflow disruption and loss of management visibility.", "Controlled release windows, rollback plan, monitoring, backups and incident response ownership."],
  ["Security", "Medium", "Exposure of customer documents, administrative misuse or reduced trust in the finance workflow.", "Firewall controls, SSL, role-based access, least privilege, audit logging and security review."],
  ["Data Integrity", "Medium", "Incomplete application records, inconsistent document status or unreliable management reporting.", "Validation rules, controlled migrations, audit trail, backup verification and reconciliation checks."],
  ["User Adoption", "Medium", "Staff and dealer teams may revert to manual workarounds if workflows are unclear.", "UAT ownership, role-based training, dashboard clarity and change communication."],
  ["Hosting Failure", "Medium", "Service unavailability affecting customer applications and operational continuity.", "Managed hosting configuration, health monitoring, backup recovery process and support escalation."],
  ["Support Dependency", "Medium", "Key-person reliance and slow issue resolution after launch.", "Documented runbooks, monthly reporting, incident process and defined SLA model."]
];

const aiFlow = ["OCR", "Extraction", "Validation", "Cross-reference", "Identity Matching", "Tamper Detection", "Confidence Score", "Human Review", "Audit Trail"];

const pages = [
  `<section class="page hero"><div class="plate"></div><div class="hero-inner"><div><div class="kicker">Executive Issue | Confidential</div><div class="rule"></div><h1>Roar Cars SA Technology Transformation Strategy</h1><p class="lead mt">Definitive executive board strategy for a secure, managed and AI-ready dealership platform.</p></div><div><p>Prepared for Roar Cars SA</p><p>Prepared by Torque Empire (Pty) Ltd</p><p>Technology Transformation Strategy</p><div class="doc-control mt"><div><strong>Classification</strong><span>Confidential</span></div><div><strong>Prepared for</strong><span>Roar Cars SA</span></div><div><strong>Prepared by</strong><span>Torque Empire (Pty) Ltd</span></div><div><strong>Issue Date</strong><span>${issueDate}</span></div><div><strong>Document Reference</strong><span>TE-RC-EXEC</span></div></div></div></div></section>`,
  `<section class="page"><div class="kicker">Executive Summary</div><h2>Roar Cars has a digital foundation with strategic value. The next step is controlled transformation.</h2><p class="lead mt">Roar Cars operates in a market where customer trust, finance readiness and dealer responsiveness are directly affected by the reliability of the digital journey. The current platform already provides useful business capability, but the environment now requires stronger production control, clearer governance, improved security and a managed support model before it becomes a deeper operating dependency. Torque Empire proposes a controlled transformation that stabilises the current production environment, separates the platform into enterprise layers, formalises support and prepares the finance workflow for governed AI document verification. The expected strategic outcome is a secure, supportable and intelligence-ready dealership platform that gives leadership clearer visibility, improves operational discipline and creates a practical foundation for future digital growth without unsupported financial claims.</p><div class="grid three mt">${cards([["Business Outcomes","Protect the customer journey, strengthen finance workflow confidence and create leadership visibility."],["Technology Outcomes","Stabilise infrastructure, improve security posture, introduce governed architecture and prepare for AI."],["Strategic Outcomes","Reduce operational uncertainty, improve supportability and create a path toward scalable intelligence."]])}</div><div class="footer"><span>Executive Summary</span><span>2</span></div></section>`,
  `<section class="page dark"><div class="kicker">About Torque Empire</div><h2>Torque Empire provides board-level technology transformation capability.</h2><p class="lead mt">Torque Empire combines executive advisory, enterprise architecture, cloud infrastructure, AI engineering, cyber security and managed services into one delivery model. The operating focus is practical: convert fragmented technology into governed platforms that leadership can understand, operate and improve over time.</p>${table(["Capability", "Executive Value", "Capability", "Executive Value"], capabilityRows)}<div class="footer"><span>Torque Empire</span><span>3</span></div></section>`,
  `<section class="page"><div class="kicker">Current Business Position</div><h2>Roar Cars operates where customer trust, finance readiness and digital responsiveness matter.</h2><p class="lead mt">The digital customer journey should connect vehicle visibility, enquiry, finance application, verification, dealer review and handover into one controlled operating flow.</p><img class="asset mt" src="../assets/executive/customer-journey-v3.svg" alt="Premium customer journey timeline"><div class="footer"><span>Business Position</span><span>4</span></div></section>`,
  `<section class="page"><div class="kicker">Technical Assessment</div><h2>Torque Empire completed an independent technical assessment of the current production environment.</h2><p class="lead mt">The assessment reviewed the deployed application surface, hosting model, data and upload handling, security controls, operational documentation and support readiness. The findings indicate a platform with useful business capability that should now be strengthened through production-grade controls rather than treated as a simple website deployment.</p><div class="grid four mt">${cards([["Architecture","Frontend, backend, data handling and upload workflows require clearer separation and operating ownership."],["Infrastructure","VPS deployment should be hardened with service management, backup discipline, monitoring and rollback control."],["Security","Secrets, admin access, upload exposure and audit controls require formal production governance."],["Maintainability","Documentation, runbooks, release control and support model should be formalised before expanded reliance."]])}</div><img class="asset mt" src="../assets/executive/security.svg" alt="Security architecture diagram"><div class="footer"><span>Technical Assessment</span><span>5</span></div></section>`,
  `<section class="page"><div class="kicker">Business Risks</div><h2>Risk must be converted into ownership, controls and management visibility.</h2>${table(["Risk", "Likelihood", "Business Impact", "Mitigation"], riskRows)}<div class="footer"><span>Risk Register</span><span>6</span></div></section>`,
  `<section class="page"><div class="kicker">Current Platform Analysis</div><h2>Production readiness requires unique controls across the full operating surface.</h2><div class="grid four mt">${cards([["Infrastructure","Application services need predictable deployment, restart, backup and rollback processes."],["Hosting","Hosting should be monitored for availability, capacity, certificate health and recovery readiness."],["Security","Administrative access, uploads, secrets and audit records require least-privilege operating discipline."],["Performance","User experience should be reviewed across inventory browsing, form submission and document upload paths."],["Support","A named support model should define triage, ownership, response paths and recurring reporting."],["Scalability","Architecture should allow future dealer, customer and verification growth without tight coupling."],["Disaster Recovery","Backups must be recoverable, documented and aligned to acceptable operational interruption."],["Documentation","Runbooks, architecture notes and release records should make the platform maintainable beyond individual contributors."]])}</div><div class="footer"><span>Platform Analysis</span><span>7</span></div></section>`,
  `<section class="page dark"><div class="kicker">Before vs After</div><h2>From useful digital presence to managed dealership platform.</h2><div class="comparison mt"><div class="card"><h3>Current</h3><p>Customer-facing website, finance application forms, uploads, local data handling, admin functions and email flows that need stronger operating controls.</p></div><div class="card"><h3>Future</h3><p>Secure enterprise architecture, role-based access, monitored operations, dashboards, AI-assisted verification, audit trail and managed support.</p></div></div><div class="grid three mt">${cards([["Control","Clear ownership across application, infrastructure, security, data and support.", "+"],["Visibility","Executive and operational dashboards for applications, risk, verification status and platform health.", "+"],["Continuity","Managed backups, monitoring and incident response for customer-facing workflows.", "+"]])}</div><div class="footer"><span>Before vs After</span><span>8</span></div></section>`,
  `<section class="page"><div class="kicker">Enterprise Solution</div><h2>A platform model that supports customers, dealers, finance workflows, AI verification and managed operations.</h2><p class="lead mt">The proposed platform separates customer experience, dealer workflow, application services, authentication, AI intelligence, data, monitoring and cloud infrastructure. This separation improves governance because each layer has a clearer purpose, control owner, risk profile and support requirement. It also allows Roar Cars to improve one layer without destabilising the whole operating model.</p><img class="asset mt" src="../assets/executive/architecture.svg" alt="Platform architecture diagram"><div class="footer"><span>Enterprise Solution</span><span>9</span></div></section>`,
  `<section class="page"><div class="kicker">Platform Workflow</div><h2>Customer to reporting workflow with controlled review and audit trail.</h2><img class="asset mt" src="../assets/executive/workflow.svg" alt="Platform workflow diagram"><div class="grid two mt">${cards([["Operational Flow","Customer, application, OCR, verification, risk engine, staff review, decision, audit trail and reporting are connected in sequence."],["Governance Value","The workflow shows where human review, traceability and reporting remain in control."]])}</div><div class="footer"><span>Platform Workflow</span><span>10</span></div></section>`,
  `<section class="page"><div class="kicker">Security Architecture</div><h2>Defence in Depth protects customer trust and operating continuity.</h2><p class="lead mt">Security should operate as layered control rather than a single shield. Each layer reduces the likelihood or impact of failure in the adjacent layer, creating accountable protection from internet entry through application processing, data storage, backup and monitoring.</p><img class="asset mt" src="../assets/executive/security.svg" alt="Layered Defence in Depth model"><div class="footer"><span>Security</span><span>11</span></div></section>`,
  `<section class="page dark"><div class="kicker">AI Document Verification</div><h2>Document intelligence supports the future vehicle finance review workflow.</h2><p class="lead mt">The proposed workflow converts uploaded documents into structured evidence for review. AI supports decision-making by extracting, validating and scoring information; humans remain responsible for final approvals and customer or finance decisions.</p><div class="flow">${cards(aiFlow.map(step => [step, step === "Human Review" ? "Reviewer confirms evidence, resolves exceptions and records the final decision." : step === "Audit Trail" ? "Every review event is retained for traceability and governance." : "Structured document evidence is produced for controlled review."]))}</div><img class="asset mt" src="../assets/executive/document-verification.svg" alt="Document verification diagram"><div class="footer"><span>AI Verification</span><span>12</span></div></section>`,
  `<section class="page"><div class="kicker">Fraud Detection</div><h2>Fraud intelligence can improve review evidence without replacing judgement.</h2><div class="grid two mt"><div><p class="lead">Future fraud capability can analyse document metadata, duplicate submissions, behaviour anomalies, cross-document mismatches and inconsistent identity signals. The purpose is to highlight risk indicators, improve reviewer focus and strengthen the evidence base for vehicle finance workflows. It does not promise fraud elimination or application outcomes.</p><div class="grid two mt">${cards([["Metadata Analysis","Review file properties, creation patterns and document consistency signals."],["Duplicate Detection","Identify repeated documents, re-used evidence and suspicious resubmissions."],["Behaviour Anomalies","Highlight unusual submission timing, repeated corrections or inconsistent journeys."],["Risk Scoring","Combine signals into explainable review flags for human assessment."]])}</div></div><img class="asset" src="../assets/executive/fraud-dashboard.svg" alt="Fraud dashboard"></div><div class="footer"><span>Fraud Detection</span><span>13</span></div></section>`,
  `<section class="page"><div class="kicker">Executive Dashboard</div><h2>Board-level visibility across platform health, application flow, risk and operations.</h2><img class="asset mt" src="../assets/executive/dashboard-mockup.svg" alt="Production-style executive dashboard"><div class="grid three mt">${cards([["Executive KPIs","Applications today, pending review, approvals, declines, AI risk alerts and average processing time."],["Management Visibility","Monthly pipeline, dealer performance, recent activity and compliance status."],["System Assurance","System health indicators connect operations, support and governance reporting."]])}</div><div class="footer"><span>Executive Dashboard</span><span>14</span></div></section>`,
  `<section class="page"><div class="kicker">Document Verification</div><h2>Structured application review with identity matching, AI recommendation and auditability.</h2><img class="asset mt" src="../assets/executive/verification-dashboard.svg" alt="Production-style document verification dashboard"><div class="grid three mt">${cards([["Applicant Evidence","Applicant profile, OCR confidence, identity match and tamper detection are visible together."],["Risk Control","Risk score and AI recommendation support human reviewer judgement."],["Auditability","Timeline and audit log preserve review traceability."]])}</div><div class="footer"><span>Document Verification</span><span>15</span></div></section>`,
  `<section class="page"><div class="kicker">Dealer Workspace</div><h2>Dealer workflow visibility across inventory, applications, finance status and customer follow-up.</h2><img class="asset mt" src="../assets/executive/dealer-dashboard.svg" alt="Production-style dealer workspace dashboard"><div class="grid three mt">${cards([["Inventory Context","Current inventory connects directly to finance activity and customer interest."],["Workflow Queue","Applications, outstanding documents and finance status are visible in one workspace."],["Dealer Discipline","Messages, KPIs and follow-up activity support consistent dealer execution."]])}</div><div class="footer"><span>Dealer Workspace</span><span>16</span></div></section>`,
  `<section class="page"><div class="kicker">Operations Dashboard</div><h2>Operational control across daily processing, verification queues, manual reviews and alerts.</h2><img class="asset mt" src="../assets/executive/operations-dashboard.svg" alt="Production-style operations dashboard"><div class="grid three mt">${cards([["Processing Control","Daily processing, verification queue and average processing time are monitored."],["Review Discipline","Manual reviews and fraud alerts are prioritised for operational action."],["Staff Activity","Staff activity and queue status support workload management."]])}</div><div class="footer"><span>Operations Dashboard</span><span>17</span></div></section>`,
  `<section class="page"><div class="kicker">Executive Analytics</div><h2>Analytics view for application trends, approval ratios, fraud indicators and dealer performance.</h2><img class="asset mt" src="../assets/executive/executive-analytics.svg" alt="Production-style executive analytics dashboard"><div class="grid three mt">${cards([["Trend Visibility","Application trends, monthly growth and approval ratios are presented for leadership review."],["Risk Intelligence","Fraud indicators help focus governance attention on patterns requiring review."],["Performance View","Dealer rankings and operational performance support continuous improvement."]])}</div><div class="footer"><span>Executive Analytics</span><span>18</span></div></section>`,
  `<section class="page"><div class="kicker">Project Delivery Roadmap</div><h2>Controlled delivery from discovery to support and future AI capability.</h2><img class="asset mt" src="../assets/executive/roadmap.svg" alt="Roadmap diagram">${table(["Phase", "Objectives", "Deliverables", "Quality Gate", "Acceptance Criteria"], [["1. Discovery","Confirm scope, current-state controls and priority risks.","Assessment pack, issue log, delivery plan.","Executive scope approval.","Roar Cars confirms scope, owners and priority outcomes."],["2. Migration","Stabilise code, data, uploads and operating environment.","Controlled deployment, backup plan, migration checklist.","Technical readiness review.","Core journeys operate in target environment."],["3. Security","Harden access, SSL, firewall, secrets and audit controls.","Security checklist, access model, monitoring baseline.","Security sign-off.","No known critical control gaps before go-live."],["4. Testing","Validate customer, dealer, admin and verification workflows.","UAT scripts, defect log, release notes.","UAT approval.","Priority defects resolved or formally accepted."],["5. Go Live","Transition to production with rollback and support coverage.","Go-live runbook, incident path, launch report.","Go-live authority decision.","Approved launch window and support ownership."],["6. Support","Operate platform through managed services and reporting.","Monitoring, patching, incident response, monthly report.","Service review.","SLA and reporting cadence active."],["7. Future AI","Introduce governed OCR, verification and risk intelligence.","AI workflow, human review controls, audit trail.","AI governance review.","AI supports review with human final approval."]])}<div class="footer"><span>Roadmap</span><span>19</span></div></section>`,
  `<section class="page"><div class="kicker">Governance</div><h2>Transformation requires clear committees, decision ownership and escalation paths.</h2><div class="grid two mt">${cards([["Project Steering Committee","Executive sponsor, Roar Cars business owner, Torque Empire delivery lead and technical owner review progress, risks and decisions."],["Reporting Cadence","Weekly delivery status during active phases and monthly executive reporting once in managed service."],["Decision Ownership","Scope, go-live, access, risk acceptance and change approval remain explicit leadership decisions."],["Risk Escalation","Security, continuity, data integrity, scope or adoption risk is escalated with impact, options and recommendation."],["Change Management","Process changes are communicated to dealer, admin and verification users with role-specific guidance."],["Acceptance Discipline","Each phase closes only when agreed outputs, evidence and acceptance criteria are met."]])}</div><div class="footer"><span>Governance</span><span>20</span></div></section>`,
  `<section class="page dark"><div class="kicker">Support & Managed Services</div><h2>Managed services turn launch into ongoing operating accountability.</h2><div class="grid four mt">${cards([["Monitoring","Availability, certificate status, error signals and backup health are reviewed."],["Patch Management","Approved updates are scheduled, tested and documented before release."],["Incident Response","Triage, severity, ownership and escalation path are defined in advance."],["SLA","Response expectations are aligned to business priority and support scope."],["Monthly Reporting","Service activity, incidents, risks, improvements and decisions are summarised for leadership."],["Backups","Backup status and recovery process are documented and periodically checked."],["Access Review","Admin and support access are reviewed for least-privilege alignment."],["Continuous Improvement","Operational data informs the next improvement cycle."]])}</div><div class="footer"><span>Managed Services</span><span>21</span></div></section>`,
  `<section class="page"><div class="kicker">Intellectual Property</div><h2>Ownership and licensing principles should be clear from the start.</h2><div class="grid two mt">${cards([["Roar Cars Ownership","Roar Cars retains ownership of its data, brand assets, customer records, business-specific content and approved custom deliverables subject to the final agreement."],["Torque Empire Reusable IP","Torque Empire retains reusable frameworks, templates, methodologies, publishing systems, architecture patterns and accelerators developed independently of client-specific assets."],["AI Frameworks","AI verification methods, reusable prompts, risk scoring patterns and engineering accelerators may be licensed or embedded by agreement."],["Licensing Principles","Third-party platforms, hosting, AI models, libraries and managed services remain subject to their applicable licence terms and commercial approvals."]])}</div><div class="footer"><span>Intellectual Property</span><span>22</span></div></section>`,
  `<section class="page"><div class="kicker">Why Torque Empire</div><h2>Evidence-based partnership, grounded in completed assessment and practical capability.</h2><div class="grid four mt">${cards([["Technical Assessment Completed","Torque Empire has reviewed the current production environment and identified stabilisation priorities."],["Platform Stabilisation","The proposed approach moves the platform toward controlled hosting, backup, release and support practices."],["Enterprise Architecture","Layer separation improves governance, maintainability and future extensibility."],["AI Capability","Document verification and risk intelligence are positioned as governed decision support."],["Security Expertise","Security is addressed through layered controls, least privilege, auditability and monitoring."],["Executive Reporting","Dashboards and reports translate operational events into board-level visibility."],["Long-term Support","Managed services create accountability beyond go-live."],["Innovation Roadmap","Future AI capability is sequenced through governance, quality gates and human approval."]])}</div><div class="footer"><span>Why Torque Empire</span><span>23</span></div></section>`,
  `<section class="page"><div class="kicker">Conclusion</div><h2>Executive recommendation: appoint Torque Empire as strategic long-term technology partner.</h2><p class="lead mt">Roar Cars has a platform foundation worth strengthening. The recommended path is to stabilise production operations, protect the customer and dealer journey, formalise governance, improve security and build toward AI-assisted verification through a measured roadmap. Torque Empire is positioned to support Roar Cars beyond launch as a strategic technology partner with responsibility for architecture, delivery discipline, executive reporting, managed services and future innovation.</p><div class="grid three mt">${cards([["Transformation Vision","Secure, managed and AI-ready dealership capability."],["Operating Confidence","Clear governance, support, reporting and risk ownership."],["Strategic Partnership","Long-term technology leadership aligned to Roar Cars' growth journey."]])}</div><div class="footer"><span>Conclusion</span><span>24</span></div></section>`,
  `<section class="page"><div class="kicker">Approval Page</div><h2>Prepared by Torque Empire (Pty) Ltd for Roar Cars SA Board of Directors, Attention: Mr Lawrence Banks.</h2><div class="grid two mt"><div class="card"><h3>Prepared By</h3><div class="signature-mark mt"><img src="${signatureAssetDataUrl}" alt="Chadwin Karanie executive signature"></div><div class="signature-name">Torque Empire (Pty) Ltd</div></div><div class="card"><h3>Prepared For</h3><p>Roar Cars SA<br>Board of Directors</p><p class="mt">Attention: Mr Lawrence Banks</p></div></div><div class="signature"><div><p>Name</p><div class="line"></div></div><div><p>Date</p><div class="line"></div></div></div><div class="footer"><span>Signature Page</span><span>25</span></div></section>`
];

const html = `<!doctype html><html><head><meta charset="utf-8"><base href="${distBaseHref}"><title>${clientReleaseTitle}</title><meta name="author" content="${clientReleaseAuthor}"><meta name="description" content="${clientReleaseSubject}"><meta name="keywords" content="${clientReleaseKeywords}"><meta name="company" content="${clientReleaseCompany}"><meta name="creator" content="${clientReleaseCreator}"><link rel="stylesheet" href="../styles/executive-board.css"></head><body>${pages.join("\n")}</body></html>`;
const clientHtmlPath = path.join(distDir, "Torque Empire - Roar Cars SA Technology Transformation Strategy.html");
const clientPdfPath = path.join(distDir, "Torque Empire - Roar Cars SA Technology Transformation Strategy.pdf");
await fs.writeFile(clientHtmlPath, html, "utf8");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1240, height: 1754 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(clientHtmlPath).href, { waitUntil: "networkidle" });
await page.pdf({
  path: clientPdfPath,
  format: "A4",
  printBackground: true,
  preferCSSPageSize: true,
  margin: { top: "0", right: "0", bottom: "0", left: "0" },
});
await browser.close();

const { PDFDocument, PDFName, PDFString } = await import("pdf-lib");
const pdfBytes = await fs.readFile(clientPdfPath);
const pdfDoc = await PDFDocument.load(pdfBytes);
pdfDoc.setTitle(clientReleasePdfTitle);
pdfDoc.setSubject(clientReleaseSubject);
pdfDoc.setAuthor(clientReleaseAuthor);
pdfDoc.setKeywords(clientReleaseKeywords.split(", "));
pdfDoc.setCreator(clientReleaseCreator);
pdfDoc.setProducer(clientReleaseCreator);
const infoDict = pdfDoc.context.lookup(pdfDoc.context.trailerInfo.Info);
infoDict.set(PDFName.of("Company"), PDFString.of(clientReleaseCompany));
infoDict.set(PDFName.of("DocumentReference"), PDFString.of("TE-RC-EXEC"));
infoDict.set(PDFName.of("InternalVersion"), PDFString.of("2.1"));
await fs.writeFile(clientPdfPath, await pdfDoc.save());

const {
  Presentation,
  PresentationFile,
} = await import("file:///C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs");

const deck = Presentation.create({ slideSize: { width: 1280, height: 720 } });
deck.theme.colorScheme = {
  name: "Torque Empire Executive",
  themeColors: {
    accent1: blue,
    accent2: red,
    bg1: white,
    bg2: navy,
    tx1: navy,
    tx2: white,
  },
};

const slides = [
  ["Roar Cars SA Technology Transformation Strategy", "Confidential executive board presentation prepared for Roar Cars SA.", ["Executive Issue", "Confidential", "Prepared for Roar Cars SA", "Prepared by Torque Empire (Pty) Ltd"], "Business value: frames the proposal as an executive decision document. Technical value: introduces the managed platform and AI-ready operating model. Commercial value: positions Torque Empire as the long-term transformation partner."],
  ["Executive Summary", "Roar Cars has a valuable digital foundation that now needs controlled transformation.", ["Customer trust, finance readiness and dealer responsiveness depend on the digital journey", "Stabilise production, improve governance and prepare for governed AI verification", "Create a secure, supportable and intelligence-ready dealership platform"], "Lead with the business challenge and why action is required now. Avoid financial promises; focus on control, visibility and readiness."],
  ["About Torque Empire", "Torque Empire provides board-level technology transformation capability.", ["Technology strategy and enterprise architecture", "Cloud infrastructure, cyber security and managed services", "AI engineering, governance and executive reporting"], "Present Torque Empire as a practical transformation partner with integrated strategy, engineering, governance and support capability."],
  ["Customer Journey", "The six-stage journey connects discovery, engagement, finance application, verification, approval and delivery.", ["Premium journey timeline", "Vehicle finance and document submission flow", "AI-assisted verification with human review"], "Business value: clarifies the end-to-end customer and dealer journey. Technical value: shows where workflow, document security and AI verification fit. Commercial value: helps stakeholders see how platform maturity supports finance responsiveness.", "customer-journey-v3.svg"],
  ["Technical Assessment", "Torque Empire completed an independent technical assessment of the current production environment.", ["Architecture, hosting, data handling and uploads reviewed", "Security, access, audit and support readiness assessed", "Findings point to production-grade controls, not a redesign"], "State clearly that the assessment was independent and current-state focused. Keep the tone factual and constructive."],
  ["Business Risk Register", "Risk must be converted into ownership, controls and management visibility.", ["Downtime and hosting failure", "Security and data integrity", "User adoption and support dependency"], "Summarise the risk register: likelihood is not a prediction, it is a management view. Emphasise mitigations and ownership."],
  ["Current Platform Analysis", "Production readiness depends on the full operating surface.", ["Infrastructure and hosting", "Security and performance", "Support, scalability, disaster recovery and documentation"], "Explain that each area needs a different control, not generic remediation. This is the enterprise-readiness view."],
  ["Before vs After", "The direction is from useful digital presence to managed dealership platform.", ["Current: forms, uploads, admin functions and email flows requiring stronger control", "Future: secure architecture, role access, monitoring, dashboards and audit trail", "Benefit: clearer ownership, visibility and continuity"], "Keep the comparison fair. Show maturity progression, not criticism of the existing platform."],
  ["Enterprise Architecture", "The future-state design separates portals, API, workflow, intelligence, data and infrastructure.", ["Customer, dealer, staff and administration portals", "API gateway, authentication, workflow, OCR, AI and audit engines", "Database, vault, analytics, Ubuntu VPS, backups, monitoring and firewall"], "Business value: shows governance-ready separation of responsibilities. Technical value: clarifies platform layers and control points. Commercial value: supports maintainability and future scaling without redesign.", "architecture.svg"],
  ["Security Architecture", "Defence in Depth protects customer trust and operating continuity.", ["Internet, web firewall, reverse proxy and application layer", "Authentication, AI verification and encrypted database", "Immutable audit logs, encrypted backup and 24/7 monitoring"], "Business value: security becomes visible to leadership. Technical value: layered controls reduce single-point dependency. Commercial value: reinforces trust with customers, dealers and finance stakeholders.", "security.svg"],
  ["AI Document Verification", "Document intelligence supports the future vehicle finance review workflow.", ["OCR, extraction, validation and cross-reference", "Identity matching, tamper detection and confidence scoring", "Human review remains responsible for final approvals and audit trail"], "Make the governance point explicit: AI supports decision-making; humans remain responsible for final approvals."],
  ["Fraud Detection", "Fraud intelligence can improve review evidence without replacing judgement.", ["Metadata analysis and duplicate detection", "Behaviour anomalies and cross-document comparison", "Risk scoring for explainable human review flags"], "Avoid certainty language. Say fraud capability can reduce blind spots and improve the quality of review evidence."],
  ["Executive Dashboard", "Leadership needs visibility into platform health, application flow, risk and operations.", ["Applications today, pending review, approved and declined", "AI risk alerts, average processing time and monthly pipeline", "Dealer performance, compliance status, activity feed and system health"], "Business value: gives leadership decision-ready operational visibility. Technical value: consolidates platform, workflow and compliance signals. Commercial value: supports confident governance discussions with board and finance stakeholders.", "dashboard-mockup.svg"],
  ["Document Verification", "Verification teams need structured evidence, confidence scoring and reviewer control.", ["Applicant profile, OCR confidence and identity match", "Tamper detection, risk score and AI recommendation", "Human review status, timeline and audit log"], "Business value: makes document review more transparent. Technical value: shows how OCR, risk scoring and audit evidence combine. Commercial value: strengthens finance workflow confidence without replacing human approval.", "verification-dashboard.svg"],
  ["Dealer Workspace", "Dealers need a practical workspace for inventory, applications and customer follow-up.", ["Current inventory and applications submitted", "Finance status and outstanding documents", "Customer messages and performance KPIs"], "Business value: improves dealer workflow clarity. Technical value: centralises application and document status. Commercial value: supports adoption by making daily dealer activity easier to manage.", "dealer-dashboard.svg"],
  ["Operations Dashboard", "Operations teams need visibility across processing, queues, reviews, alerts and staff activity.", ["Daily processing and verification queue", "Manual reviews, fraud alerts and processing time", "Staff activity and queue prioritisation"], "Business value: turns operations into a managed workflow. Technical value: exposes throughput, exceptions and queue health. Commercial value: supports accountable service management.", "operations-dashboard.svg"],
  ["Executive Analytics", "Executives need trend, ratio, fraud, growth, ranking and performance visibility.", ["Application trends and approval ratios", "Fraud indicators and monthly growth", "Dealer rankings and operational performance"], "Business value: provides strategic visibility beyond daily workflow. Technical value: connects operational data to analytics. Commercial value: supports board reporting and continuous improvement.", "executive-analytics.svg"],
  ["Project Delivery Roadmap", "Delivery should move through controlled stages with quality gates and acceptance criteria.", ["Objectives and deliverables per phase", "Quality gate before phase closure", "Acceptance criteria owned by Roar Cars and Torque Empire"], "Describe the roadmap as a risk-managed delivery model from discovery to support and future AI."],
  ["Governance", "Transformation requires clear committees, reporting cadence and decision ownership.", ["Project Steering Committee", "Weekly delivery reporting and monthly executive reporting", "Risk escalation, change management and acceptance discipline"], "Make governance practical: name the decisions that leadership must own - scope, access, risk acceptance and go-live."],
  ["Support and Managed Services", "Launch must transition into accountable operations.", ["Monitoring, patch management and incident response", "SLA model and monthly reporting", "Continuous improvement based on operational evidence"], "Explain that support is part of the operating model, not an afterthought after launch."],
  ["Intellectual Property", "Ownership and licensing principles should be clear from the start.", ["Roar Cars owns data, brand assets and business-specific records", "Torque Empire retains reusable frameworks, methods and accelerators", "AI frameworks and third-party services follow agreed licensing principles"], "Keep this clear and non-legalistic. The goal is commercial clarity before delivery expands."],
  ["Why Torque Empire", "The partnership case is evidence-based and grounded in completed work.", ["Technical assessment completed", "Platform stabilisation path and enterprise architecture", "AI capability, security expertise, executive reporting and long-term support"], "This is the proof slide. Stay evidence-based and avoid broad marketing language."],
  ["Executive Recommendation", "Proceed with controlled transformation and appoint Torque Empire as strategic long-term technology partner.", ["Stabilise production operations", "Protect the customer and dealer journey", "Govern the environment and build toward AI-ready dealership capability"], "Close with the recommendation. Position Torque Empire as the long-term strategic technology partner for architecture, support and innovation."],
];

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
  shape.text.typeface = opts.typeface ?? "Poppins";
  shape.text.fontSize = opts.size ?? 28;
  shape.text.color = opts.color ?? navy;
  shape.text.bold = Boolean(opts.bold);
  shape.text.alignment = opts.align ?? "left";
  shape.text.verticalAlignment = opts.valign ?? "top";
  shape.text.insets = opts.insets ?? { left: 0, right: 0, top: 0, bottom: 0 };
  shape.text.autoFit = "shrinkText";
  return shape;
}

function addFooter(slide, n) {
  addText(slide, "Torque Empire (Pty) Ltd | Confidential", 70, 670, 450, 22, { size: 14, color: "#8fa0b4", typeface: "Lato" });
  addText(slide, String(n).padStart(2, "0"), 1160, 670, 50, 22, { size: 14, color: "#8fa0b4", typeface: "Lato", align: "right" });
}

async function readImageBlob(imagePath) {
  const bytes = await fs.readFile(imagePath);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function addMiniDiagram(slide, index) {
  const startX = 690;
  const startY = 225;
  const labels = index === 10
    ? ["Customers", "Dealers", "API", "AI", "Data", "Cloud"]
    : index === 12
      ? ["OCR", "ID", "Tamper", "Score", "Audit", "Review"]
      : index === 17
        ? ["Discover", "Migrate", "Secure", "Test", "Go Live", "Support"]
        : ["Assess", "Architect", "Engineer", "Deploy", "Operate", "Improve"];
  labels.forEach((label, i) => {
    const x = startX + (i % 2) * 220;
    const y = startY + Math.floor(i / 2) * 115;
    addShape(slide, x, y, 180, 68, "#ffffff12", true, "#ffffff30");
    addText(slide, label, x + 16, y + 21, 148, 24, { size: 19, color: white, bold: true, typeface: "Lato" });
  });
}

for (const [[title, message, bullets, notes, visualAsset], idx] of slides.map((slide, index) => [slide, index])) {
  const slide = deck.slides.add();
  slide.background.fill = idx === 0 || idx === 2 || idx === 12 || idx === 20 ? navy : white;
  const dark = slide.background.fill === navy;
  addShape(slide, 0, 0, 1280, 720, dark ? navy : white, false);
  addShape(slide, 0, 0, 28, 720, idx % 5 === 0 ? red : blue, false);
  if (idx === 0) {
    addShape(slide, 760, 0, 520, 720, "#101d2d", false);
    addShape(slide, 830, 125, 330, 250, "#ffffff10", true, "#ffffff20");
    addShape(slide, 885, 190, 220, 95, "#1f6feb55", true, "#1f6feb");
    addShape(slide, 910, 310, 170, 22, red, true, red);
    addText(slide, "Executive Issue | Confidential", 75, 70, 470, 28, { size: 17, color: "#b8c3d1", typeface: "Lato" });
    addText(slide, title, 75, 160, 650, 150, { size: 48, color: white, bold: true });
    addText(slide, message, 75, 340, 580, 72, { size: 24, color: "#d7dee8", typeface: "Lato" });
    addText(slide, bullets.join("\n"), 75, 465, 560, 105, { size: 22, color: white, typeface: "Lato" });
    addText(slide, `Prepared for Roar Cars SA | ${issueDate}`, 75, 620, 560, 26, { size: 17, color: "#b8c3d1", typeface: "Lato" });
  } else {
    addText(slide, "Roar Cars SA | Strategic Technology Transformation", 72, 44, 620, 22, { size: 15, color: dark ? "#aebbd0" : "#6d7c8b", typeface: "Lato" });
    addText(slide, title, 72, 92, 650, 82, { size: 39, color: dark ? white : navy, bold: true });
    addText(slide, message, 72, 190, 560, 74, { size: 22, color: dark ? "#dce4ee" : steel, typeface: "Lato" });
    bullets.slice(0, 6).forEach((bullet, i) => {
      const y = 310 + i * 48;
      addShape(slide, 78, y + 6, 14, 14, i % 2 ? blue : red, true);
      addText(slide, bullet, 110, y, 500, 30, { size: 22, color: dark ? white : navy, typeface: "Lato" });
    });
    if (visualAsset) {
      addShape(slide, 640, 142, 575, 420, dark ? "#ffffff0f" : "#f3f6fa", true, dark ? "#ffffff24" : line);
      const image = slide.images.add({
        blob: await readImageBlob(path.join(assetDir, visualAsset)),
        fit: "contain",
        alt: title,
      });
      image.position = { left: 655, top: 158, width: 545, height: 388 };
    } else if ([5, 8, 9, 11, 16].includes(idx)) {
      addMiniDiagram(slide, idx);
    } else {
      addShape(slide, 715, 170, 430, 330, dark ? "#ffffff0f" : "#f3f6fa", true, dark ? "#ffffff24" : line);
      addShape(slide, 750, 215, 160, 28, blue, true, blue);
      addShape(slide, 750, 268, 300, 18, dark ? "#ffffff50" : "#c9d3df", true, dark ? "#ffffff50" : "#c9d3df");
      addShape(slide, 750, 310, 255, 18, dark ? "#ffffff36" : "#d9dee5", true, dark ? "#ffffff36" : "#d9dee5");
      addShape(slide, 750, 380, 340, 74, "#1f6feb20", true, blue);
      addText(slide, idx === 14 ? "Executive View" : idx === 15 ? "Dealer Workspace" : idx === 16 ? "Verification Control" : "Boardroom View", 770, 400, 260, 28, { size: 22, color: dark ? white : navy, bold: true, typeface: "Lato" });
      if (idx === slides.length - 1) {
        addShape(slide, 740, 450, 380, 128, dark ? "#ffffff0c" : "#ffffff", true, dark ? "#ffffff20" : line);
        const signature = slide.images.add({
          blob: await readImageBlob(signatureAssetPath),
          fit: "contain",
          alt: "Chadwin Karanie executive signature",
        });
        signature.position = { left: 770, top: 472, width: 250, height: 62 };
        addText(slide, "Torque Empire (Pty) Ltd", 770, 544, 250, 22, { size: 17, color: dark ? white : navy, bold: true, typeface: "Lato" });
        addText(slide, "Authorised Signatory", 770, 568, 250, 18, { size: 12, color: dark ? "#dce4ee" : steel, typeface: "Lato" });
      }
    }
    addFooter(slide, idx + 1);
  }
  slide.speakerNotes.setText(notes);
}

const pptx = await PresentationFile.exportPptx(deck);
const clientPptxPath = path.join(distDir, "Torque Empire - Roar Cars SA Executive Board Presentation.pptx");
await pptx.save(clientPptxPath);

const JSZip = (await import("jszip")).default;
const pptxZip = await JSZip.loadAsync(await fs.readFile(clientPptxPath));
const coreXml = await pptxZip.file("docProps/core.xml").async("string");
const pptxTitle = "Torque Empire - Roar Cars SA Executive Board Presentation";
const pptxCoreXml = coreXml
  .replace(/<dc:title>.*?<\/dc:title>/s, `<dc:title>${xmlEscape(pptxTitle)}</dc:title>`)
  .replace(/<dc:creator>.*?<\/dc:creator>/s, `<dc:creator>${xmlEscape(clientReleaseAuthor)}</dc:creator>`)
  .replace(/<lastModifiedBy>.*?<\/lastModifiedBy>/s, `<lastModifiedBy>${xmlEscape(clientReleaseAuthor)}</lastModifiedBy>`)
  .replace(/<\/coreProperties>/, `<dc:subject>${xmlEscape(clientReleaseSubject)}</dc:subject><cp:keywords xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties">${xmlEscape(clientReleaseKeywords)}</cp:keywords></coreProperties>`);
pptxZip.file("docProps/core.xml", pptxCoreXml);
const appXml = await pptxZip.file("docProps/app.xml").async("string");
const pptxAppXml = appXml
  .replace(/<ap:Application>.*?<\/ap:Application>/s, `<ap:Application>${xmlEscape(clientReleaseCreator)}</ap:Application>`)
  .replace(/<ap:Slides>.*?<\/ap:Slides>/s, `<ap:Slides>${deck.slides.count}</ap:Slides>`)
  .replace(/<ap:Notes>.*?<\/ap:Notes>/s, `<ap:Notes>${deck.slides.count}</ap:Notes>`);
pptxZip.file("docProps/app.xml", pptxAppXml);
await fs.writeFile(clientPptxPath, await pptxZip.generateAsync({ type: "nodebuffer" }));

console.log("HTML/PDF/SVG/CSS/PPTX assets generated");
