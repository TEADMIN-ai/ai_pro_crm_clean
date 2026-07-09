const fs = require("node:fs");
const path = require("node:path");
const { createCanvas } = require("@napi-rs/canvas");

const ROOT = process.cwd();
const LOGO_DIR = path.join(ROOT, "assets", "corporate", "logo");
const BRAND_GUIDELINES_DIR = path.join(ROOT, "assets", "corporate", "brand-guidelines");
const PUBLIC_DIR = path.join(ROOT, "public");

const COLORS = {
  navy: "#07111f",
  blue: "#0b2f57",
  cobalt: "#1d4ed8",
  slate: "#475569",
  border: "#d9e2ec",
  surface: "#f4f7fb",
  white: "#ffffff",
  text: "#07111f",
  textMuted: "#5b6878",
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawMonogram(ctx, x, y, size, palette, variant = "primary") {
  const bg = ctx.createLinearGradient(x, y, x + size, y + size);
  if (variant === "light") {
    bg.addColorStop(0, "#ffffff");
    bg.addColorStop(1, "#f8fafc");
  } else {
    bg.addColorStop(0, palette.navy);
    bg.addColorStop(1, palette.blue);
  }

  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = bg;
  roundedRect(ctx, 0, 0, size, size, size * 0.22);
  ctx.fill();

  ctx.fillStyle = variant === "light" ? palette.blue : "rgba(255,255,255,0.18)";
  roundedRect(ctx, 0, 0, size, size, size * 0.22);
  ctx.lineWidth = size * 0.014;
  ctx.strokeStyle = variant === "light" ? palette.border : "rgba(255,255,255,0.16)";
  ctx.stroke();

  ctx.fillStyle = variant === "light" ? palette.navy : palette.white;
  ctx.font = `900 ${size * 0.34}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("TE", size * 0.5, size * 0.47);

  ctx.strokeStyle = variant === "light" ? palette.cobalt : "rgba(255,255,255,0.72)";
  ctx.lineWidth = Math.max(3, size * 0.025);
  ctx.beginPath();
  ctx.moveTo(size * 0.18, size * 0.72);
  ctx.lineTo(size * 0.82, size * 0.72);
  ctx.stroke();

  ctx.fillStyle = variant === "light" ? palette.textMuted : "rgba(255,255,255,0.8)";
  ctx.font = `700 ${size * 0.1}px Arial, Helvetica, sans-serif`;
  ctx.fillText("TEOS", size * 0.5, size * 0.8);
  ctx.restore();
}

function drawPrimaryLogo(ctx, width, height, variant = "primary") {
  const bg = variant === "dark" ? COLORS.navy : variant === "light" ? COLORS.white : "transparent";
  if (bg !== "transparent") {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
  } else {
    ctx.clearRect(0, 0, width, height);
  }

  const iconSize = Math.floor(height * 0.72);
  const iconX = Math.floor(height * 0.18);
  const iconY = Math.floor(height * 0.14);
  drawMonogram(ctx, iconX, iconY, iconSize, COLORS, variant === "dark" ? "dark" : "primary");

  const textX = iconX + iconSize + Math.floor(height * 0.18);
  const wordmarkColor = variant === "dark" ? COLORS.white : COLORS.navy;
  const subtitleColor = variant === "dark" ? "rgba(255,255,255,0.72)" : COLORS.textMuted;

  ctx.fillStyle = wordmarkColor;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = `900 ${Math.floor(height * 0.27)}px Arial, Helvetica, sans-serif`;
  ctx.fillText("Torque Empire", textX, Math.floor(height * 0.53));

  ctx.fillStyle = variant === "dark" ? COLORS.cobalt : COLORS.cobalt;
  ctx.fillRect(textX, Math.floor(height * 0.61), Math.floor(width * 0.25), Math.max(4, Math.floor(height * 0.016)));

  ctx.fillStyle = subtitleColor;
  ctx.font = `700 ${Math.floor(height * 0.105)}px Arial, Helvetica, sans-serif`;
  ctx.fillText("TEOS Platform", textX, Math.floor(height * 0.8));
}

function writePng(fileName, width, height, variant = "primary") {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  drawPrimaryLogo(ctx, width, height, variant);
  fs.writeFileSync(path.join(LOGO_DIR, fileName), canvas.toBuffer("image/png"));
}

function svgPrimary(variant = "primary") {
  const wordmarkFill = variant === "dark" ? COLORS.white : COLORS.navy;
  const subtitleFill = variant === "dark" ? "rgba(255,255,255,0.72)" : COLORS.textMuted;
  const bg = variant === "dark" ? COLORS.navy : "transparent";
  const iconVariant = variant === "light" ? "light" : "primary";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 420" role="img" aria-label="Torque Empire TEOS logo">
  <defs>
    <linearGradient id="monogramBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${iconVariant === "light" ? "#ffffff" : COLORS.navy}"/>
      <stop offset="1" stop-color="${iconVariant === "light" ? "#f8fafc" : COLORS.blue}"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="420" fill="${bg}" fill-opacity="${variant === "dark" ? "1" : "0"}"/>
  <g transform="translate(56 60)">
    <rect width="300" height="300" rx="66" fill="url(#monogramBg)"/>
    <rect x="0" y="0" width="300" height="300" rx="66" fill="none" stroke="${iconVariant === "light" ? COLORS.border : "rgba(255,255,255,0.16)"}" stroke-width="6"/>
    <text x="150" y="157" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="110" font-weight="900" fill="${iconVariant === "light" ? COLORS.navy : COLORS.white}">TE</text>
    <rect x="55" y="216" width="190" height="10" rx="5" fill="${COLORS.cobalt}"/>
    <text x="150" y="248" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700" fill="${iconVariant === "light" ? COLORS.textMuted : "rgba(255,255,255,0.8)"}">TEOS</text>
  </g>
  <text x="420" y="182" font-family="Arial, Helvetica, sans-serif" font-size="86" font-weight="900" fill="${wordmarkFill}">Torque Empire</text>
  <rect x="420" y="210" width="280" height="8" rx="4" fill="${COLORS.cobalt}"/>
  <text x="420" y="286" font-family="Arial, Helvetica, sans-serif" font-size="38" font-weight="700" fill="${subtitleFill}">TEOS Platform</text>
</svg>`;
}

function svgMonogram() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Torque Empire TEOS monogram">
  <defs>
    <linearGradient id="monoBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${COLORS.navy}"/>
      <stop offset="1" stop-color="${COLORS.blue}"/>
    </linearGradient>
  </defs>
  <rect x="24" y="24" width="464" height="464" rx="104" fill="url(#monoBg)"/>
  <rect x="24" y="24" width="464" height="464" rx="104" fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="6"/>
  <text x="256" y="276" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="176" font-weight="900" fill="${COLORS.white}">TE</text>
  <rect x="112" y="354" width="288" height="14" rx="7" fill="${COLORS.cobalt}"/>
  <text x="256" y="408" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="48" font-weight="700" fill="rgba(255,255,255,0.8)">TEOS</text>
</svg>`;
}

function makeIco(entries) {
  const headerSize = 6 + entries.length * 16;
  const totalSize = headerSize + entries.reduce((sum, entry) => sum + entry.buffer.length, 0);
  const ico = Buffer.alloc(totalSize);
  ico.writeUInt16LE(0, 0);
  ico.writeUInt16LE(1, 2);
  ico.writeUInt16LE(entries.length, 4);

  let imageOffset = headerSize;
  entries.forEach((entry, index) => {
    const offset = 6 + index * 16;
    ico.writeUInt8(entry.size >= 256 ? 0 : entry.size, offset);
    ico.writeUInt8(entry.size >= 256 ? 0 : entry.size, offset + 1);
    ico.writeUInt8(0, offset + 2);
    ico.writeUInt8(0, offset + 3);
    ico.writeUInt16LE(1, offset + 4);
    ico.writeUInt16LE(32, offset + 6);
    ico.writeUInt32LE(entry.buffer.length, offset + 8);
    ico.writeUInt32LE(imageOffset, offset + 12);
    entry.buffer.copy(ico, imageOffset);
    imageOffset += entry.buffer.length;
  });

  return ico;
}

ensureDir(LOGO_DIR);
ensureDir(BRAND_GUIDELINES_DIR);

fs.writeFileSync(path.join(LOGO_DIR, "torque-empire-primary.svg"), svgPrimary("primary"), "utf8");
fs.writeFileSync(path.join(LOGO_DIR, "torque-empire-dark.png"), "");
fs.writeFileSync(path.join(LOGO_DIR, "torque-empire-light.png"), "");
fs.writeFileSync(path.join(LOGO_DIR, "torque-empire-primary.png"), "");
fs.writeFileSync(path.join(LOGO_DIR, "favicon.png"), "");
fs.writeFileSync(path.join(LOGO_DIR, "torque-empire-monogram.svg"), svgMonogram(), "utf8");

writePng("torque-empire-primary.png", 1600, 420, "primary");
writePng("torque-empire-dark.png", 1600, 420, "dark");
writePng("torque-empire-light.png", 1600, 420, "light");
writePng("favicon.png", 512, 512, "primary");

fs.writeFileSync(
  path.join(BRAND_GUIDELINES_DIR, "README.md"),
  `# Torque Empire Corporate Brand Guidelines

This folder contains the canonical Torque Empire branding assets used across TEOS.

## Approved Assets
- logo/torque-empire-primary.svg
- logo/torque-empire-primary.png
- logo/torque-empire-dark.png
- logo/torque-empire-light.png
- logo/torque-empire-monogram.svg
- logo/favicon.png

## Usage
- Use the primary logo on light surfaces.
- Use the light variant on dark surfaces.
- Use the monogram for compact UI, favicons and small badges.
- Do not recreate alternate logos or recolored copies.
`,
  "utf8",
);

fs.writeFileSync(
  path.join(LOGO_DIR, "README.md"),
  `# Torque Empire Logo Assets

Canonical logo assets for TEOS and commercial documents.

Generated from the corporate brand definition using the repository brand asset generator.
`,
  "utf8",
);

const png16 = createCanvas(16, 16);
const png32 = createCanvas(32, 32);
const png48 = createCanvas(48, 48);
const png64 = createCanvas(64, 64);
const png128 = createCanvas(128, 128);
const png256 = createCanvas(256, 256);
const png512 = createCanvas(512, 512);

drawMonogram(png16.getContext("2d"), 0, 0, 16, COLORS, "primary");
drawMonogram(png32.getContext("2d"), 0, 0, 32, COLORS, "primary");
drawMonogram(png48.getContext("2d"), 0, 0, 48, COLORS, "primary");
drawMonogram(png64.getContext("2d"), 0, 0, 64, COLORS, "primary");
drawMonogram(png128.getContext("2d"), 0, 0, 128, COLORS, "primary");
drawMonogram(png256.getContext("2d"), 0, 0, 256, COLORS, "primary");
drawMonogram(png512.getContext("2d"), 0, 0, 512, COLORS, "primary");

fs.writeFileSync(
  path.join(PUBLIC_DIR, "favicon.ico"),
  makeIco([
    { size: 16, buffer: png16.toBuffer("image/png") },
    { size: 32, buffer: png32.toBuffer("image/png") },
    { size: 48, buffer: png48.toBuffer("image/png") },
    { size: 64, buffer: png64.toBuffer("image/png") },
  ]),
);

console.log(`[brand-assets] generated corporate logo assets in ${path.relative(ROOT, LOGO_DIR)}`);
