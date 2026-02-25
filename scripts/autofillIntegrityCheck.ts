import fs from "node:fs";
import path from "node:path";

type Violation = {
  file: string;
  reason: string;
};

const root = process.cwd();

const requiredFiles = [
  "src/lib/pdfs/templates/sbdSchema.ts",
  "src/lib/autofill/buildCompanyProfile.ts",
  "src/lib/pdfs/empirePdfFill.ts",
  "src/app/api/tender-pack/generate/route.ts",
  "src/lib/routes.ts",
];

function ensureRequiredFiles(): Violation[] {
  return requiredFiles
    .filter((relPath) => !fs.existsSync(path.join(root, relPath)))
    .map((relPath) => ({ file: relPath, reason: "Required Phase 8 file is missing" }));
}

function ensureRouteConstant(): Violation[] {
  const routesPath = path.join(root, "src/lib/routes.ts");
  const source = fs.readFileSync(routesPath, "utf8");
  if (!source.includes("TENDER_PACK_GENERATE: \"/api/tender-pack/generate\"")) {
    return [{ file: "src/lib/routes.ts", reason: "Missing API_ROUTES.TENDER_PACK_GENERATE constant" }];
  }
  return [];
}

function walk(dir: string, all: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, all);
      continue;
    }

    if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) continue;
    const rel = path.relative(root, fullPath).replace(/\\/g, "/");
    all.push(rel);
  }
  return all;
}

function shouldIgnore(file: string): boolean {
  if (!file.startsWith("src/")) return true;
  if (file.startsWith("src/app/api/")) return true;
  if (file.includes("/__tests__/")) return true;
  if (file.endsWith(".test.ts") || file.endsWith(".test.tsx")) return true;
  return false;
}

function checkHardcodedApiFetches(): Violation[] {
  const files = walk(path.join(root, "src"));
  const violations: Violation[] = [];
  const pattern = /fetch\(\s*(["'`])\/api\//g;

  for (const file of files) {
    if (shouldIgnore(file)) continue;
    const source = fs.readFileSync(path.join(root, file), "utf8");
    if (pattern.test(source)) {
      violations.push({
        file,
        reason: "Hardcoded '/api/*' fetch detected outside API files; use API_ROUTES",
      });
    }
  }

  return violations;
}

function main() {
  const violations = [
    ...ensureRequiredFiles(),
    ...ensureRouteConstant(),
    ...checkHardcodedApiFetches(),
  ];

  if (violations.length > 0) {
    console.error("autofill-integrity: FAILED");
    for (const violation of violations) {
      console.error(` - ${violation.file}: ${violation.reason}`);
    }
    process.exit(1);
  }

  console.log("autofill-integrity: PASS");
}

main();
