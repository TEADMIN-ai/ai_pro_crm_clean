import fs from "node:fs";
import path from "node:path";

type Violation = {
  file: string;
  reason: string;
};

const root = process.cwd();
const srcRoot = path.join(root, "src");

const allowedExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

function isIgnoredFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  if (!normalized.startsWith("src/")) return true;
  if (normalized.startsWith("src/app/api/")) return true;
  if (normalized.includes("/__tests__/")) return true;
  if (normalized.includes("/_tests_/")) return true;
  if (normalized.endsWith(".test.ts") || normalized.endsWith(".test.tsx")) return true;
  return false;
}

function walk(dir: string, all: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, all);
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (!allowedExtensions.has(ext)) continue;

    const rel = path.relative(root, fullPath).replace(/\\/g, "/");
    if (isIgnoredFile(rel)) continue;

    all.push(rel);
  }

  return all;
}

function checkFile(file: string): Violation[] {
  const fullPath = path.join(root, file);
  const source = fs.readFileSync(fullPath, "utf8");
  const violations: Violation[] = [];

  if (source.includes("/dashboard/upload")) {
    violations.push({ file, reason: "Deprecated route '/dashboard/upload' is referenced" });
  }

  if (source.includes("/api/contractor/")) {
    violations.push({ file, reason: "Singular '/api/contractor/' route reference found" });
  }

  const singularDocumentsPattern = /\/api\/contractor\/[^\s"'`]+\/documents/g;
  if (singularDocumentsPattern.test(source)) {
    violations.push({
      file,
      reason: "Singular '/api/contractor/:id/documents' reference found",
    });
  }

  const hardcodedApiFetch = /fetch\(\s*(["'`])\/api\//g;
  if (hardcodedApiFetch.test(source)) {
    violations.push({
      file,
      reason: "Hardcoded '/api/*' fetch detected. Use API_ROUTES.",
    });
  }

  return violations;
}

function main() {
  if (!fs.existsSync(srcRoot)) {
    console.error("route-integrity: src directory not found");
    process.exit(1);
  }

  const files = walk(srcRoot);
  const violations = files.flatMap(checkFile);

  if (violations.length > 0) {
    console.error("route-integrity: FAILED");
    for (const violation of violations) {
      console.error(` - ${violation.file}: ${violation.reason}`);
    }
    process.exit(1);
  }

  console.log("route-integrity: PASS");
}

main();
