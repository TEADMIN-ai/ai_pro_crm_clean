import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { auditContractorIdentityRecords } from "@/lib/contractors/contractorIdentityAudit";

type Snapshot = {
  contractors: Array<Record<string, unknown> & { id?: string }>;
  users?: Array<Record<string, unknown> & { id?: string }>;
  recommendations?: Array<Record<string, unknown> & { id?: string }>;
  assignments?: Array<Record<string, unknown> & { id?: string }>;
  allowlist?: string[];
};

function argValue(name: string): string | null {
  const prefix = `${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

if (process.argv.includes("--production") && !process.argv.includes("--confirm-production-readonly")) {
  throw new Error("Production contractor identity audit requires --confirm-production-readonly and an approved read-only snapshot source.");
}

const inputPath = argValue("--input");
if (!inputPath) {
  throw new Error("Usage: tsx scripts/auditContractorIdentity.ts --input=path/to/snapshot.json --json=reports/contractor-identity-audit.json --markdown=reports/contractor-identity-audit.md");
}

const snapshot = JSON.parse(readFileSync(resolve(inputPath), "utf8")) as Snapshot;
const report = auditContractorIdentityRecords(snapshot);

const jsonPath = argValue("--json");
if (jsonPath) {
  mkdirSync(dirname(resolve(jsonPath)), { recursive: true });
  writeFileSync(resolve(jsonPath), JSON.stringify(report, null, 2));
}

const markdownPath = argValue("--markdown");
if (markdownPath) {
  mkdirSync(dirname(resolve(markdownPath)), { recursive: true });
  writeFileSync(resolve(markdownPath), report.humanReadable);
}

if (!jsonPath && !markdownPath) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
