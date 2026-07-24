import fs from "node:fs";
import {
  ContractorBusinessIdentityEvidenceError,
  prepareVerifiedContractorBusinessIdentityEvidence,
  resolveSafeEvidenceOutputPath,
  stableStringifyBusinessIdentityEvidence,
  writeBusinessIdentityEvidenceIdempotently,
  TORQUE_EMPIRE_CONTRACTOR_ID,
  TORQUE_EMPIRE_CONTRACTOR_NAME,
  TORQUE_EMPIRE_PRIMARY_SHA256,
  TORQUE_EMPIRE_SUPPORTING_SHA256,
  TORQUE_EMPIRE_REGISTRATION_NUMBER,
} from "../src/lib/contractors/contractorBusinessIdentityEvidence";

const usage = `Usage: npx tsx scripts/prepareVerifiedContractorBusinessEvidence.ts \
  --contractor-id=z0yX8cyt38hkfa60UEyNTOiX2812 \
  --contractor-name="Torque Empire" \
  --primary=<evidence/contractors/z0yX8cyt38hkfa60UEyNTOiX2812/file.pdf> \
  --supporting=<evidence/contractors/z0yX8cyt38hkfa60UEyNTOiX2812/file.pdf> \
  --registration-number=2024/105084/07 \
  --output=reports/contractors/verified-business-identity-evidence-z0yX8cyt38hkfa60UEyNTOiX2812.json \
  --evidence-collector="Chadwin Wesley Karanie"`;

function get(argv: string[], name: string): string | null {
  const value = argv.find((arg) => arg.startsWith(`${name}=`));
  return value ? value.slice(name.length + 1).trim() || null : null;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help")) { console.log(usage); return; }
  if (argv.some((arg) => ["--apply", "--production", "--identity-resolution"].includes(arg))) throw new Error("This command is evidence preparation only; mutation and identity resolution are unavailable.");
  const contractorId = get(argv, "--contractor-id");
  const contractorName = get(argv, "--contractor-name");
  const primary = get(argv, "--primary");
  const supporting = get(argv, "--supporting");
  const registration = get(argv, "--registration-number");
  const output = get(argv, "--output");
  const collector = get(argv, "--evidence-collector");
  if (!contractorId || !contractorName || !primary || !supporting || !registration || !output || !collector) throw new Error(`All options are required.\n${usage}`);
  const safeOutput = resolveSafeEvidenceOutputPath(output);
  const evidence = await prepareVerifiedContractorBusinessIdentityEvidence({ cwd: process.cwd(), contractorDocumentId: contractorId, expectedContractorName: contractorName, primaryEvidencePath: primary, supportingEvidencePath: supporting, expectedRegistrationNumber: registration, expectedPrimarySHA256: TORQUE_EMPIRE_PRIMARY_SHA256, expectedSupportingSHA256: TORQUE_EMPIRE_SUPPORTING_SHA256, outputPath: safeOutput, evidenceCollector: collector });
  const content = `${stableStringifyBusinessIdentityEvidence(evidence)}\n`;
  const writeStatus = writeBusinessIdentityEvidenceIdempotently(safeOutput, content);
  console.log(JSON.stringify({ output: safeOutput, writeStatus, contractorDocumentId: evidence.contractorDocumentId, legalBusinessName: evidence.legalBusinessName, companyRegistrationNumber: evidence.companyRegistrationNumber, verificationStatus: evidence.verificationStatus, contractorIsolationStatus: evidence.contractorIsolationStatus, assignmentAllowed: false, firebaseReadOccurred: false, firebaseWriteOccurred: false, productionMutationOccurred: false }, null, 2));
}

main().catch((error) => { const safe = error instanceof ContractorBusinessIdentityEvidenceError ? { code: error.code, message: error.message } : { message: error instanceof Error ? error.message : String(error) }; console.error("[verified-business-identity-evidence] blocked", JSON.stringify(safe)); process.exitCode = 1; });
