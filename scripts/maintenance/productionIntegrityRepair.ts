import { loadEnvConfig } from "@next/env";
import { readFileSync } from "node:fs";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import {
  runIntegrityRepair,
  writeIntegrityRepairReports,
} from "@/lib/maintenance/integrityRepair";
import type { BrokenReferenceIssue, RepairMode } from "@/lib/maintenance/repairStrategies";

type CatalogFile = {
  catalog: BrokenReferenceIssue[];
};

const DEFAULT_CATALOG_PATH = "output/maintenance/broken-reference-catalog.json";
const DEFAULT_JSON_REPORT_PATH = "output/maintenance/production-repair-results.json";
const DEFAULT_MARKDOWN_REPORT_PATH = "output/maintenance/production-repair-results.md";

function argValue(name: string): string | null {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

function parseMode(): RepairMode {
  return process.argv.includes("--apply") ? "apply" : "dry-run";
}

async function main() {
  loadEnvConfig(process.cwd());

  const mode = parseMode();
  const catalogPath = argValue("--catalog") ?? DEFAULT_CATALOG_PATH;
  const jsonPath = argValue("--report") ?? DEFAULT_JSON_REPORT_PATH;
  const markdownPath = argValue("--markdown-report") ?? DEFAULT_MARKDOWN_REPORT_PATH;
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8")) as CatalogFile;

  const report = await runIntegrityRepair({
    db: getFirebaseAdmin(),
    issues: catalog.catalog,
    mode,
    sourceCatalog: catalogPath,
  });

  writeIntegrityRepairReports(report, jsonPath, markdownPath);

  console.log("[integrity-repair:summary]", {
    mode,
    sourceCatalog: catalogPath,
    report: jsonPath,
    markdownReport: markdownPath,
    verifiedRepaired: report.after.verifiedRepaired,
    remainingUnverified: report.after.remainingUnverified,
    manualReview: report.after.manualReview,
    failed: report.after.failed,
    dataIntegrityScore: report.after.dataIntegrityScore,
    referenceHealthScore: report.after.referenceHealthScore,
    productionReadinessScore: report.after.productionReadinessScore,
  });
}

void main().catch((error) => {
  console.error("[integrity-repair:fatal]", error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
