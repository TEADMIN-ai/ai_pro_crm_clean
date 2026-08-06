import { readFileSync } from "node:fs";
import {
  buildWorkspaceRepairPlans,
  type WorkspaceRepairRecord,
  type WorkspaceRepairTarget,
} from "@/lib/contractors/contractorWorkspaceRepair";

function argument(name: string): string | null {
  const prefix = `--${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : null;
}

const inputPath = argument("input");
if (!inputPath) {
  throw new Error("Usage: npx tsx scripts/contractorWorkspaceRepair.ts --input=<local-json-file>");
}
if (process.argv.includes("--apply")) {
  throw new Error("This utility is dry-run only; production mutation requires a separately approved adapter");
}

const input = JSON.parse(readFileSync(inputPath, "utf8")) as {
  records?: WorkspaceRepairRecord[];
  targets?: WorkspaceRepairTarget[];
};
const plans = buildWorkspaceRepairPlans(input.records ?? [], input.targets ?? []);
console.log(JSON.stringify({
  mode: "DRY_RUN",
  planCount: plans.length,
  plans,
  rollbackManifest: plans.map((plan) => plan.rollback),
  productionWrites: 0,
  recomputationRequired: true,
}, null, 2));

