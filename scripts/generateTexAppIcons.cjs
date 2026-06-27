const fs = require("node:fs");
const path = require("node:path");
const { createCanvas } = require("@napi-rs/canvas");

const ROOT = process.cwd();
const ICON_DIR = path.join(ROOT, "public", "icons");
const NAVY = "#071426";
const MIDNIGHT = "#0b1f3a";
const GOLD = "#d8a83f";
const GOLD_LIGHT = "#f6d77a";
const GOLD_DARK = "#9b6a16";

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

function drawIcon(size, maskable = false) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const scale = size / 512;
  const pad = maskable ? 0 : 24 * scale;
  const radius = (maskable ? 112 : 92) * scale;

  ctx.clearRect(0, 0, size, size);

  const bg = ctx.createLinearGradient(0, 0, size, size);
  bg.addColorStop(0, MIDNIGHT);
  bg.addColorStop(0.52, NAVY);
  bg.addColorStop(1, "#030914");
  ctx.fillStyle = bg;
  roundedRect(ctx, pad, pad, size - pad * 2, size - pad * 2, radius);
  ctx.fill();

  ctx.save();
  roundedRect(ctx, pad, pad, size - pad * 2, size - pad * 2, radius);
  ctx.clip();

  const glow = ctx.createRadialGradient(size * 0.5, size * 0.18, 0, size * 0.5, size * 0.22, size * 0.55);
  glow.addColorStop(0, "rgba(246, 215, 122, 0.2)");
  glow.addColorStop(0.45, "rgba(216, 168, 63, 0.08)");
  glow.addColorStop(1, "rgba(216, 168, 63, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = "rgba(246, 215, 122, 0.26)";
  ctx.lineWidth = 5 * scale;
  roundedRect(ctx, pad + 10 * scale, pad + 10 * scale, size - (pad + 10 * scale) * 2, size - (pad + 10 * scale) * 2, radius - 18 * scale);
  ctx.stroke();

  ctx.restore();

  const emblem = ctx.createLinearGradient(size * 0.32, size * 0.12, size * 0.7, size * 0.78);
  emblem.addColorStop(0, GOLD_LIGHT);
  emblem.addColorStop(0.42, GOLD);
  emblem.addColorStop(1, GOLD_DARK);

  ctx.save();
  ctx.translate(size * 0.5, size * 0.52);
  ctx.scale(scale, scale);

  ctx.shadowColor = "rgba(0, 0, 0, 0.34)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 9;

  ctx.strokeStyle = emblem;
  ctx.fillStyle = "rgba(216, 168, 63, 0.09)";
  ctx.lineWidth = 20;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(0, -178);
  ctx.bezierCurveTo(96, -158, 134, -108, 126, -28);
  ctx.bezierCurveTo(116, 82, 54, 154, 0, 188);
  ctx.bezierCurveTo(-54, 154, -116, 82, -126, -28);
  ctx.bezierCurveTo(-134, -108, -96, -158, 0, -178);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.fillStyle = emblem;
  ctx.beginPath();
  ctx.moveTo(-86, -204);
  ctx.lineTo(-42, -166);
  ctx.lineTo(0, -214);
  ctx.lineTo(42, -166);
  ctx.lineTo(86, -204);
  ctx.lineTo(70, -138);
  ctx.lineTo(-70, -138);
  ctx.closePath();
  ctx.fill();

  ctx.fillRect(-72, -124, 144, 26);

  ctx.beginPath();
  ctx.moveTo(-94, -82);
  ctx.lineTo(94, -82);
  ctx.lineTo(76, -32);
  ctx.lineTo(28, -32);
  ctx.lineTo(28, 116);
  ctx.lineTo(0, 142);
  ctx.lineTo(-28, 116);
  ctx.lineTo(-28, -32);
  ctx.lineTo(-76, -32);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = GOLD_LIGHT;
  ctx.lineWidth = 13;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-82, 40);
  ctx.lineTo(-44, 64);
  ctx.lineTo(-82, 88);
  ctx.moveTo(82, 40);
  ctx.lineTo(44, 64);
  ctx.lineTo(82, 88);
  ctx.stroke();

  ctx.strokeStyle = "rgba(246, 215, 122, 0.76)";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(-82, -82);
  ctx.lineTo(82, -82);
  ctx.stroke();

  ctx.restore();

  return canvas.toBuffer("image/png");
}

function svgSource() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Torque Empire Executive Experience icon">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${MIDNIGHT}"/>
      <stop offset="0.52" stop-color="${NAVY}"/>
      <stop offset="1" stop-color="#030914"/>
    </linearGradient>
    <linearGradient id="gold" x1="160" y1="70" x2="360" y2="410">
      <stop offset="0" stop-color="${GOLD_LIGHT}"/>
      <stop offset="0.42" stop-color="${GOLD}"/>
      <stop offset="1" stop-color="${GOLD_DARK}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="18%" r="60%">
      <stop offset="0" stop-color="${GOLD_LIGHT}" stop-opacity="0.2"/>
      <stop offset="0.45" stop-color="${GOLD}" stop-opacity="0.08"/>
      <stop offset="1" stop-color="${GOLD}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect x="24" y="24" width="464" height="464" rx="92" fill="url(#bg)"/>
  <rect x="24" y="24" width="464" height="464" rx="92" fill="url(#glow)"/>
  <rect x="34" y="34" width="444" height="444" rx="74" fill="none" stroke="${GOLD_LIGHT}" stroke-opacity="0.26" stroke-width="5"/>
  <g transform="translate(256 266)" fill="url(#gold)" stroke-linejoin="round">
    <path d="M0-178c96 20 134 70 126 150C116 82 54 154 0 188-54 154-116 82-126-28c-8-80 30-130 126-150z" fill="${GOLD}" fill-opacity="0.09" stroke="url(#gold)" stroke-width="20"/>
    <path d="M-86-204l44 38 42-48 42 48 44-38-16 66H-70z"/>
    <rect x="-72" y="-124" width="144" height="26"/>
    <path d="M-94-82H94L76-32H28v148L0 142l-28-26V-32h-48z"/>
    <path d="M-82 40l38 24-38 24M82 40L44 64l38 24" fill="none" stroke="${GOLD_LIGHT}" stroke-width="13" stroke-linecap="round"/>
    <path d="M-82-82H82" stroke="${GOLD_LIGHT}" stroke-opacity="0.76" stroke-width="8" stroke-linecap="round"/>
  </g>
</svg>
`;
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

function writeAsset(name, buffer) {
  fs.writeFileSync(path.join(ICON_DIR, name), buffer);
}

ensureDir(ICON_DIR);
fs.writeFileSync(path.join(ICON_DIR, "torque-empire-icon.svg"), svgSource(), "utf8");

const png16 = drawIcon(16);
const png32 = drawIcon(32);
const png48 = drawIcon(48);
const png64 = drawIcon(64);
const png180 = drawIcon(180);
const png192 = drawIcon(192);
const png512 = drawIcon(512);
const mask192 = drawIcon(192, true);
const mask512 = drawIcon(512, true);

writeAsset("favicon-16.png", png16);
writeAsset("favicon-32.png", png32);
writeAsset("apple-touch-icon.png", png180);
writeAsset("icon-192.png", png192);
writeAsset("icon-512.png", png512);
writeAsset("maskable-icon-192.png", mask192);
writeAsset("maskable-icon-512.png", mask512);
fs.writeFileSync(path.join(ROOT, "public", "favicon.ico"), makeIco([
  { size: 16, buffer: png16 },
  { size: 32, buffer: png32 },
  { size: 48, buffer: png48 },
  { size: 64, buffer: png64 },
]));

console.log(`[tex-icons] generated app icons in ${path.relative(ROOT, ICON_DIR)}`);
