import fs from "node:fs";
import path from "node:path";
import {
  auditContractorDecisionSnapshot,
  validateContractorDecisionSnapshot,
} from "../src/lib/contractors/contractorDecisionAudit";

type AuditCliOptions = {
  input: string | null;
  json: string | null;
  markdown: string | null;
};

export function parseContractorDecisionAuditArgs(argv = process.argv.slice(2)): AuditCliOptions {
  const options: AuditCliOptions = {
    input: null,
    json: null,
    markdown: null,
  };
  for (const arg of argv) {
    if (arg.startsWith("--input=")) options.input = arg.slice("--input=".length);
    else if (arg.startsWith("--json=")) options.json = arg.slice("--json=".length);
    else if (arg.startsWith("--markdown=")) options.markdown = arg.slice("--markdown=".length);
  }
  return options;
}

function requireLocalPath(value: string | null, label: string): string {
  if (!value) throw new Error(`Missing ${label}`);
  return value;
}

function writeLocalFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

export function runContractorDecisionSnapshotAudit(options: AuditCliOptions) {
  const inputPath = requireLocalPath(options.input, "--input=<snapshot.json>");
  const jsonPath = requireLocalPath(options.json, "--json=<audit.json>");
  const markdownPath = requireLocalPath(options.markdown, "--markdown=<audit.md>");
  const snapshot = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  if (!validateContractorDecisionSnapshot(snapshot)) {
    throw new Error("Input snapshot does not match contractor decision audit snapshot schema.");
  }
  const report = auditContractorDecisionSnapshot(snapshot);
  writeLocalFile(jsonPath, `${JSON.stringify({ ...report, markdown: undefined }, null, 2)}\n`);
  writeLocalFile(markdownPath, `${report.markdown}\n`);
  return {
    json: jsonPath,
    markdown: markdownPath,
    summary: report.summary,
  };
}

async function main() {
  const result = runContractorDecisionSnapshotAudit(parseContractorDecisionAuditArgs());
  console.log(JSON.stringify({
    outputs: { json: result.json, markdown: result.markdown },
    totalContractorsReviewed: result.summary.totalContractorsReviewed,
    suspectContractors: result.summary.suspectContractors,
    countsBySeverity: result.summary.countsBySeverity,
  }, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error("[contractor-decision-snapshot-audit] failed", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
