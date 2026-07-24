import fs from "node:fs";
import path from "node:path";
import {
  ContractorIdentityResolutionError,
  prepareContractorManualIdentityResolutionProposal,
  stableStringifyContractorIdentityResolution,
  type ContractorManualIdentityResolutionInput,
} from "../src/lib/contractors/contractorIdentityResolution";
import type {
  ContractorDecisionAuditReport,
  ContractorDecisionAuditSnapshot,
} from "../src/lib/contractors/contractorDecisionAudit";

type CliOptions = {
  contractorId: string | null;
  snapshot: string | null;
  audit: string | null;
  verifiedBusinessIdentityEvidence: string | null;
  approvedLegalBusinessName: string | null;
  approvedTradingName: string | null;
  approvedCsdSupplierNumber: string | null;
  reviewerIdentity: string | null;
  reviewerRole: string | null;
  reason: string | null;
  reviewedAt: string | null;
  expectedBeforeStateFingerprint: string | null;
  evidenceSourcesReviewed: string[];
  output: string | null;
  dryRun: boolean;
  apply: boolean;
  production: boolean;
  help: boolean;
  proposedCanonicalContractorReference: string | null;
  proposedForbiddenAuthorityFields: Record<string, unknown>;
};

export const CONTRACTOR_IDENTITY_RESOLUTION_USAGE = `Usage: npx tsx scripts/prepareContractorIdentityResolution.ts \\
  --contractor-id=<id> \\
  --snapshot=<reports/contractors/snapshot.json> \\
  --audit=<reports/contractors/audit.json> \\
  --verified-business-identity-evidence=<reports/contractors/verified-business-identity-evidence.json> \\
  --approved-legal-business-name=<verified legal name> \\
  --reviewer-identity=<reviewer> \\
  --reviewer-role=<role> \\
  --reason=<manual review reason> \\
  --evidence-sources-reviewed=<comma-separated sources> \\
  --expected-before-state-fingerprint=<sha256>

Required:
  --contractor-id
  --snapshot
  --audit
  --approved-legal-business-name
  --reviewer-identity
  --reviewer-role
  --reason
  --evidence-sources-reviewed
  --expected-before-state-fingerprint

Optional:
  --approved-trading-name
  --output=<reports/contractors/proposal.json>

Notes:
  This command is dry-run only and writes local JSON proposals under reports/contractors only.
  reviewedAt is generated at runtime as a UTC ISO-8601 timestamp.
  Different execution times may change proposal metadata, while the source fingerprint and substantive proposed identity fields remain stable.`;

function value(arg: string, prefix: string): string | null {
  return arg.startsWith(prefix) ? arg.slice(prefix.length).trim() || null : null;
}

function parseJsonObject(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("--proposed-authority-fields must be a JSON object.");
  }
  return parsed as Record<string, unknown>;
}

export function parseContractorIdentityResolutionArgs(argv = process.argv.slice(2)): CliOptions {
  const options: CliOptions = {
    contractorId: null,
    snapshot: null,
    audit: null,
    verifiedBusinessIdentityEvidence: null,
    approvedLegalBusinessName: null,
    approvedTradingName: null,
    approvedCsdSupplierNumber: null,
    reviewerIdentity: null,
    reviewerRole: null,
    reason: null,
    reviewedAt: null,
    expectedBeforeStateFingerprint: null,
    evidenceSourcesReviewed: [],
    output: null,
    dryRun: true,
    apply: false,
    production: false,
    help: false,
    proposedCanonicalContractorReference: null,
    proposedForbiddenAuthorityFields: {},
  };

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--apply") options.apply = true;
    else if (arg === "--production") options.production = true;
    else if (arg.startsWith("--contractor-id=")) options.contractorId = value(arg, "--contractor-id=");
    else if (arg.startsWith("--snapshot=")) options.snapshot = value(arg, "--snapshot=");
    else if (arg.startsWith("--audit=")) options.audit = value(arg, "--audit=");
    else if (arg.startsWith("--verified-business-identity-evidence=")) options.verifiedBusinessIdentityEvidence = value(arg, "--verified-business-identity-evidence=");
    else if (arg.startsWith("--approved-legal-business-name=")) options.approvedLegalBusinessName = value(arg, "--approved-legal-business-name=");
    else if (arg.startsWith("--approved-trading-name=")) options.approvedTradingName = value(arg, "--approved-trading-name=");
    else if (arg.startsWith("--approved-csd-supplier-number=")) options.approvedCsdSupplierNumber = value(arg, "--approved-csd-supplier-number=");
    else if (arg.startsWith("--reviewer-identity=")) options.reviewerIdentity = value(arg, "--reviewer-identity=");
    else if (arg.startsWith("--reviewer-role=")) options.reviewerRole = value(arg, "--reviewer-role=");
    else if (arg.startsWith("--reason=")) options.reason = value(arg, "--reason=");
    else if (arg.startsWith("--reviewed-at=")) options.reviewedAt = value(arg, "--reviewed-at=") ?? "";
    else if (arg.startsWith("--expected-before-state-fingerprint=")) options.expectedBeforeStateFingerprint = value(arg, "--expected-before-state-fingerprint=");
    else if (arg.startsWith("--evidence-sources-reviewed=")) {
      options.evidenceSourcesReviewed = (value(arg, "--evidence-sources-reviewed=") ?? "").split(",").map((item) => item.trim()).filter(Boolean);
    } else if (arg.startsWith("--output=")) options.output = value(arg, "--output=");
    else if (arg.startsWith("--proposed-canonical-contractor-reference=")) options.proposedCanonicalContractorReference = value(arg, "--proposed-canonical-contractor-reference=");
    else if (arg.startsWith("--proposed-authority-fields=")) options.proposedForbiddenAuthorityFields = parseJsonObject(value(arg, "--proposed-authority-fields="));
  }

  return options;
}

function requireOption(valueToCheck: string | null, label: string): string {
  if (!valueToCheck) throw new Error(`Missing ${label}`);
  return valueToCheck;
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function decodePathInput(input: string): string {
  let decoded = input;
  for (let i = 0; i < 3; i += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }
  return decoded;
}

function containsTraversal(input: string): boolean {
  const decoded = decodePathInput(input).replace(/\\/g, "/");
  return decoded.split("/").some((segment) => segment === "..");
}

export function resolveSafeContractorIdentityOutputPath(output: string, cwd = process.cwd()): string {
  const decodedOutput = decodePathInput(output.trim());
  if (!decodedOutput) throw new Error("Missing --output=<reports/contractors/file.json>");
  if (containsTraversal(decodedOutput)) throw new Error("Output path traversal is not allowed.");
  if (path.extname(decodedOutput).toLowerCase() !== ".json") throw new Error("Output path must use a .json extension.");

  const approvedDir = path.resolve(cwd, "reports", "contractors");
  const resolvedOutput = path.resolve(cwd, decodedOutput);
  const relativeToApproved = path.relative(approvedDir, resolvedOutput);
  if (relativeToApproved === "" || relativeToApproved.startsWith("..") || path.isAbsolute(relativeToApproved)) {
    throw new Error("Output path must stay beneath reports/contractors.");
  }
  return resolvedOutput;
}

function deterministicOutputPath(contractorId: string, fingerprint: string): string {
  return path.join("reports", "contractors", `identity-resolution-${contractorId}-${fingerprint.slice(0, 12)}.json`);
}

function assertDryRunOnly(options: CliOptions): void {
  if (options.production || options.apply || !options.dryRun) {
    throw new Error("Refusing execution. This slice supports dry-run proposal preparation only; production apply mode is not available.");
  }
  if (options.reviewedAt !== null) {
    throw new Error("Refusing execution. --reviewed-at is not a normal CLI option; reviewedAt is generated at runtime in UTC.");
  }
}

function writeProposalIdempotently(output: string, content: string): { output: string; writeStatus: "created" | "existing_identical" } {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  if (fs.existsSync(output)) {
    const existing = fs.readFileSync(output, "utf8");
    if (existing === content) return { output, writeStatus: "existing_identical" };
    throw new Error("Refusing to overwrite existing proposal with different content.");
  }
  fs.writeFileSync(output, content, "utf8");
  return { output, writeStatus: "created" };
}

export function prepareContractorIdentityResolutionFromCli(options: CliOptions, clock: () => Date = () => new Date()) {
  assertDryRunOnly(options);
  const contractorId = requireOption(options.contractorId, "--contractor-id=<id>");
  const snapshotPath = requireOption(options.snapshot, "--snapshot=<path>");
  const auditPath = requireOption(options.audit, "--audit=<path>");
  const verifiedBusinessIdentityEvidencePath = requireOption(options.verifiedBusinessIdentityEvidence, "--verified-business-identity-evidence=<path>");
  const expectedBeforeStateFingerprint = requireOption(options.expectedBeforeStateFingerprint, "--expected-before-state-fingerprint=<sha256>");
  const reviewedAt = clock().toISOString();
  const input: ContractorManualIdentityResolutionInput = {
    contractorId,
    snapshot: readJsonFile<ContractorDecisionAuditSnapshot>(snapshotPath),
    auditReport: readJsonFile<ContractorDecisionAuditReport>(auditPath),
    verifiedBusinessIdentityEvidencePath,
    verifiedBusinessIdentityEvidence: readJsonFile(verifiedBusinessIdentityEvidencePath),
    sourceSnapshotPath: snapshotPath,
    sourceAuditPath: auditPath,
    approvedLegalBusinessName: requireOption(options.approvedLegalBusinessName, "--approved-legal-business-name=<name>"),
    approvedTradingName: options.approvedTradingName,
    approvedCsdSupplierNumber: options.approvedCsdSupplierNumber,
    reviewerIdentity: requireOption(options.reviewerIdentity, "--reviewer-identity=<id>"),
    reviewerRole: requireOption(options.reviewerRole, "--reviewer-role=<role>"),
    reason: requireOption(options.reason, "--reason=<reason>"),
    reviewedAt,
    expectedBeforeStateFingerprint,
    evidenceSourcesReviewed: options.evidenceSourcesReviewed,
    proposedForbiddenAuthorityFields: options.proposedForbiddenAuthorityFields,
    proposedCanonicalContractorReference: options.proposedCanonicalContractorReference,
  };
  const proposal = prepareContractorManualIdentityResolutionProposal(input);
  const output = resolveSafeContractorIdentityOutputPath(options.output ?? deterministicOutputPath(contractorId, proposal.beforeStateFingerprint));
  const writeResult = writeProposalIdempotently(output, `${stableStringifyContractorIdentityResolution(proposal)}\n`);
  return { proposal, ...writeResult };
}

async function main() {
  const options = parseContractorIdentityResolutionArgs();
  if (options.help) {
    console.log(CONTRACTOR_IDENTITY_RESOLUTION_USAGE);
    return;
  }
  const result = prepareContractorIdentityResolutionFromCli(options);
  console.log(JSON.stringify({
    output: result.output,
    writeStatus: result.writeStatus,
    productionWriteOccurred: false,
    firebaseWriteOccurred: false,
    mode: result.proposal.mode,
    contractorDocumentId: result.proposal.contractorDocumentId,
    expectedBeforeStateFingerprint: result.proposal.beforeStateFingerprint,
    computedBeforeStateFingerprint: result.proposal.beforeStateFingerprint,
    before: {
      identityStatus: result.proposal.beforeState.identityStatus,
      identityMatchStatus: result.proposal.beforeState.identityMatchStatus,
      identityResolved: result.proposal.beforeState.identityResolved,
      storedDisplayIdentity: result.proposal.beforeState.storedDisplayIdentity,
      historicalDecision: result.proposal.beforeState.historicalDecision,
    },
    proposedAfter: result.proposal.proposedAfterState,
  }, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    if (error instanceof ContractorIdentityResolutionError) {
      console.error("[contractor-identity-resolution] blocked", JSON.stringify({ code: error.code, message: error.message, evidence: error.evidence }, null, 2));
    } else {
      console.error("[contractor-identity-resolution] failed", error instanceof Error ? error.message : error);
    }
    process.exitCode = 1;
  });
}