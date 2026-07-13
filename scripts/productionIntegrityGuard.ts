import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

type Violation = {
  file: string;
  line: number;
  reason: string;
};

const ROOT = process.cwd();
const PRODUCTION_ROOTS = ["src/app", "src/components", "src/lib", "src/server", "src/context", "src/hooks", "src/types"];
const ALLOWED_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"]);
const IGNORE_SEGMENTS = [
  "/__tests__/",
  "/_tests_/",
  "/fixtures/",
  "/fixture/",
  "/test/",
  "/tests/",
  "/generated/",
  "/tmp/",
  "/scripts/",
];

const BAN_PATTERNS = [
  { token: /\bmock\b/i, reason: "mock dataset marker" },
  { token: /\bdemo\b/i, reason: "demo dataset marker" },
  { token: /\bsample\b/i, reason: "sample dataset marker" },
  { token: /\bfake\b/i, reason: "fake dataset marker" },
  { token: /\bpresentation[- ]only\b/i, reason: "presentation-only dataset marker" },
];

function runGit(args: string[]): string {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" });
}

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function isProductionCandidate(file: string): boolean {
  const normalized = file.replace(/\\/g, "/");
  if (!ALLOWED_EXTENSIONS.has(path.extname(normalized).toLowerCase())) return false;
  return PRODUCTION_ROOTS.some((root) => normalized.startsWith(`${root}/`));
}

function isIgnored(file: string): boolean {
  const normalized = file.replace(/\\/g, "/");
  return IGNORE_SEGMENTS.some((segment) => normalized.includes(segment));
}

function getChangedFiles(): string[] {
  const tracked = splitLines(runGit(["diff", "--name-only", "--diff-filter=ACMRTUXB", "HEAD", "--", ...PRODUCTION_ROOTS]));
  const untracked = splitLines(runGit(["ls-files", "--others", "--exclude-standard", "--", ...PRODUCTION_ROOTS]));
  return [...new Set([...tracked, ...untracked])].filter((file) => isProductionCandidate(file) && !isIgnored(file));
}

function scanFile(file: string): Violation[] {
  const fullPath = path.join(ROOT, file);
  const source = fs.readFileSync(fullPath, "utf8");
  const lines = source.split(/\r?\n/);
  const violations: Violation[] = [];

  for (const pattern of BAN_PATTERNS) {
    for (let index = 0; index < lines.length; index += 1) {
      if (pattern.token.test(lines[index])) {
        violations.push({ file, line: index + 1, reason: pattern.reason });
      }
    }
  }

  const hasBannedTerm = BAN_PATTERNS.some((pattern) => pattern.token.test(source));
  const hasHardcodedArrayLiteral = /(?:export\s+)?const\s+[A-Za-z0-9_$]+\s*=\s*\[[\s\S]*?\]/m.test(source);

  if (hasBannedTerm && hasHardcodedArrayLiteral) {
    const firstArrayLine = lines.findIndex((line) => /(?:export\s+)?const\s+[A-Za-z0-9_$]+\s*=\s*\[/.test(line));
    violations.push({
      file,
      line: firstArrayLine >= 0 ? firstArrayLine + 1 : 1,
      reason: "hardcoded array dataset in production code",
    });
  }

  return violations;
}

function main() {
  const files = getChangedFiles();
  const violations = files.flatMap(scanFile);

  if (violations.length === 0) {
    console.log("production-integrity: PASS");
    return;
  }

  console.error("production-integrity: FAILED");
  for (const violation of violations) {
    console.error(` - ${violation.file}:${violation.line} - ${violation.reason}`);
  }
  process.exit(1);
}

main();
