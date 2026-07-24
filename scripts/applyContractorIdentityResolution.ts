import fs from "node:fs";
import {
  ALLOWLIST_CONFIRMATION,
  ALLOWLISTED_CONTRACTOR_ID,
  CONTRACTOR_IDENTITY_APPLY_LOGIC_VERSION,
  PRODUCTION_CONFIRMATION,
  REVIEWER_CONFIRMATION,
  applyContractorIdentityResolution,
  prepareContractorIdentityResolutionApplyPlan,
  resolveSafeApplyReportPath,
  writeApplyPlanIdempotently,
} from "../src/lib/contractors/contractorIdentityResolutionApply";
import type { ContractorManualIdentityResolutionProposal } from "../src/lib/contractors/contractorIdentityResolution";
import type { VerifiedBusinessIdentityEvidenceForApply } from "../src/lib/contractors/contractorIdentityResolutionApply";
import type { ContractorDecisionAuditReport, ContractorDecisionAuditSnapshot } from "../src/lib/contractors/contractorDecisionAudit";

type Options = {
  contractorId: string | null;
  proposal: string | null;
  snapshot: string | null;
  audit: string | null;
  evidence: string | null;
  expectedFingerprint: string | null;
  productionConfirmation: string | null;
  allowlistConfirmation: string | null;
  reviewerConfirmation: string | null;
  rollbackOutput: string | null;
  auditOutput: string | null;
  output: string | null;
  apply: boolean;
  production: boolean;
  dryRun: boolean;
  help: boolean;
};

export const CONTRACTOR_IDENTITY_APPLY_USAGE = `Usage: node --import tsx scripts/applyContractorIdentityResolution.ts \
  --contractor-id=${ALLOWLISTED_CONTRACTOR_ID} \
  --proposal=<approved proposal path> \
  --snapshot=<approved snapshot path> \
  --audit=<approved audit path> \
  --verified-business-identity-evidence=<approved evidence path> \
  --expected-before-state-fingerprint=<approved sha256> \
  [--output=reports/contractors/identity-apply-plan.json]

Required for a future production apply only:
  --apply --production
  --production-confirmation=${PRODUCTION_CONFIRMATION}
  --allowlist-confirmation=${ALLOWLIST_CONFIRMATION}
  --reviewer-confirmation=${REVIEWER_CONFIRMATION}
  --rollback-output=reports/contractors/rollback/<operation-id>.json
  --audit-output=reports/contractors/<operation-id>-audit.json

This task supports local DRY_RUN_PLAN_ONLY execution only. Do not execute --apply.
The dry-run path reads local reports only and performs no Firebase access.`;

function value(arg: string, prefix: string): string | null { return arg.startsWith(prefix) ? arg.slice(prefix.length).trim() || null : null; }

export function parseContractorIdentityApplyArgs(argv = process.argv.slice(2)): Options {
  const options: Options = { contractorId: null, proposal: null, snapshot: null, audit: null, evidence: null, expectedFingerprint: null, productionConfirmation: null, allowlistConfirmation: null, reviewerConfirmation: null, rollbackOutput: null, auditOutput: null, output: null, apply: false, production: false, dryRun: true, help: false };
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--apply") options.apply = true;
    else if (arg === "--production") options.production = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg.startsWith("--contractor-id=")) options.contractorId = value(arg, "--contractor-id=");
    else if (arg.startsWith("--proposal=")) options.proposal = value(arg, "--proposal=");
    else if (arg.startsWith("--snapshot=")) options.snapshot = value(arg, "--snapshot=");
    else if (arg.startsWith("--audit=")) options.audit = value(arg, "--audit=");
    else if (arg.startsWith("--verified-business-identity-evidence=")) options.evidence = value(arg, "--verified-business-identity-evidence=");
    else if (arg.startsWith("--expected-before-state-fingerprint=")) options.expectedFingerprint = value(arg, "--expected-before-state-fingerprint=");
    else if (arg.startsWith("--production-confirmation=")) options.productionConfirmation = value(arg, "--production-confirmation=");
    else if (arg.startsWith("--allowlist-confirmation=")) options.allowlistConfirmation = value(arg, "--allowlist-confirmation=");
    else if (arg.startsWith("--reviewer-confirmation=")) options.reviewerConfirmation = value(arg, "--reviewer-confirmation=");
    else if (arg.startsWith("--rollback-output=")) options.rollbackOutput = value(arg, "--rollback-output=");
    else if (arg.startsWith("--audit-output=")) options.auditOutput = value(arg, "--audit-output=");
    else if (arg.startsWith("--output=")) options.output = value(arg, "--output=");
  }
  return options;
}

function requireOption(valueToCheck: string | null, label: string): string {
  if (!valueToCheck) throw new Error(`Missing ${label}`);
  return valueToCheck;
}

function readJson<T>(filePath: string): T { return JSON.parse(fs.readFileSync(filePath, "utf8")) as T; }

function localInput(options: Options) {
  const contractorId = requireOption(options.contractorId, "--contractor-id");
  if (contractorId !== ALLOWLISTED_CONTRACTOR_ID) throw new Error("Only the explicitly allowlisted contractor is supported.");
  const proposalPath = requireOption(options.proposal, "--proposal");
  const snapshotPath = requireOption(options.snapshot, "--snapshot");
  const auditPath = requireOption(options.audit, "--audit");
  const evidencePath = requireOption(options.evidence, "--verified-business-identity-evidence");
  const expected = requireOption(options.expectedFingerprint, "--expected-before-state-fingerprint");
  return {
    contractorId,
    proposal: readJson<ContractorManualIdentityResolutionProposal>(proposalPath),
    snapshot: readJson<ContractorDecisionAuditSnapshot>(snapshotPath),
    auditReport: readJson<ContractorDecisionAuditReport>(auditPath),
    verifiedBusinessIdentityEvidence: readJson<VerifiedBusinessIdentityEvidenceForApply>(evidencePath),
    proposalPath,
    snapshotPath,
    auditPath,
    verifiedBusinessIdentityEvidencePath: evidencePath,
    expectedBeforeStateFingerprint: expected,
  } as const;
}

export function prepareLocalContractorIdentityApplyPlan(options: Options) {
  if (options.apply || options.production || !options.dryRun) throw new Error("Refusing production execution in this slice. Use the default local dry-run plan mode.");
  const input = localInput(options);
  const plan = prepareContractorIdentityResolutionApplyPlan(input);
  const output = resolveSafeApplyReportPath(options.output ?? `reports/contractors/contractor-identity-apply-plan-${input.contractorId}.json`);
  const writeStatus = writeApplyPlanIdempotently(output, plan);
  return { plan, output, writeStatus };
}

async function main() {
  const options = parseContractorIdentityApplyArgs();
  if (options.help) { console.log(CONTRACTOR_IDENTITY_APPLY_USAGE); return; }
  if (options.apply || options.production) {
    throw new Error("Production apply is intentionally not executable in this task. Prepare the plan only; do not use --apply or --production.");
  }
  const result = prepareLocalContractorIdentityApplyPlan(options);
  console.log(JSON.stringify({ output: result.output, writeStatus: result.writeStatus, mode: result.plan.mode, productionExecutionAllowed: false, firebaseReadOccurred: false, firebaseWriteOccurred: false, assignmentAllowed: false, logicVersion: CONTRACTOR_IDENTITY_APPLY_LOGIC_VERSION }, null, 2));
}

if (require.main === module) main().catch((error) => { console.error("[contractor-identity-apply] blocked", error instanceof Error ? error.message : error); process.exitCode = 1; });



