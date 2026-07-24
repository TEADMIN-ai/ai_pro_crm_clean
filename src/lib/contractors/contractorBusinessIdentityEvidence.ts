import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

import { PDFArray, PDFDocument, PDFName } from "pdf-lib";

export const CONTRACTOR_BUSINESS_IDENTITY_EVIDENCE_LOGIC_VERSION = "contractor-business-identity-evidence-v1";
export const TORQUE_EMPIRE_CONTRACTOR_ID = "z0yX8cyt38hkfa60UEyNTOiX2812";
export const TORQUE_EMPIRE_CONTRACTOR_NAME = "Torque Empire";
export const TORQUE_EMPIRE_REGISTRATION_NUMBER = "2024/105084/07";
export const TORQUE_EMPIRE_PRIMARY_SHA256 = "170AA775C2F97F2C68D976C098C71E08EA291D3C7E41300592BBDF36FFA787C4";
export const TORQUE_EMPIRE_SUPPORTING_SHA256 = "D35E6EE08179B83F90903DA5BF5F4B48E574462BB18E28FF61AB8370AE1AFC4A";

export type VerifiedBusinessIdentityEvidence = {
  contractorDocumentId: string;
  contractorName: string;
  evidenceType: "VERIFIED_CIPC_COR14_3_AND_SUPPORTING_CIPC_CERTIFICATE";
  legalBusinessName: "TORQUE EMPIRE (PTY) LTD";
  normalizedLegalBusinessName: "TORQUE EMPIRE PTY LTD";
  primaryRegisteredName: "TORQUE EMPIRE";
  legalSuffixBasis: string;
  companyRegistrationNumber: string;
  normalizedRegistrationNumber: string;
  primarySourceDocumentPath: string;
  primarySourceDocumentSHA256: string;
  supportingSourceDocumentPath: string;
  supportingSourceDocumentSHA256: string;
  exactSourceFields: {
    primary: Record<string, unknown>;
    supporting: Record<string, unknown>;
  };
  verificationStatus: "VERIFIED";
  verificationMethod: "LOCAL_PDF_CONTENT_STREAM_VERIFICATION";
  verifiedAt: string;
  evidenceCollector: string;
  logicVersion: string;
  contractorIsolationStatus: "VERIFIED";
  redactionSummary: Record<string, unknown>;
  evidenceLimitations: string[];
  controls: Record<string, unknown>;
};

export class ContractorBusinessIdentityEvidenceError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "ContractorBusinessIdentityEvidenceError";
  }
}

type PreparationInput = {
  cwd?: string;
  contractorDocumentId: string;
  expectedContractorName: string;
  primaryEvidencePath: string;
  supportingEvidencePath: string;
  expectedRegistrationNumber: string;
  expectedPrimarySHA256: string;
  expectedSupportingSHA256: string;
  outputPath: string;
  evidenceCollector: string;
  verifiedAt?: string;
};

type StreamEvidence = { objectReference: string; strings: string[] };

function fail(code: string, message: string): never {
  throw new ContractorBusinessIdentityEvidenceError(code, message);
}

function normalizeRegistration(value: string): string {
  return value.replace(/\s+/g, "").trim();
}

function normalizeBusinessName(value: string): string {
  return value.replace(/\s+/g, " ").trim().toUpperCase();
}

function decodePdfLiteral(value: string): string {
  return value
    .replace(/\\([\\()])/g, "$1")
    .replace(/\\n/g, " ")
    .replace(/\\r/g, " ")
    .replace(/\\t/g, " ")
    .replace(/\\[0-7]{1,3}/g, "");
}

function literalStrings(buffer: Buffer): string[] {
  const matches = buffer.toString("latin1").match(/\((?:\\.|[^\\()])*\)\s*T(?:j|\*)/g) ?? [];
  return matches.map((item) => decodePdfLiteral(item.slice(1, item.lastIndexOf(")"))));
}

async function extractStreamEvidence(buffer: Buffer): Promise<StreamEvidence[]> {
  const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const evidence: StreamEvidence[] = [];
  for (const [reference, object] of pdf.context.enumerateIndirectObjects()) {
    if (!(object as { contents?: unknown }).contents) continue;
    let stream = Buffer.from((object as unknown as { contents: Uint8Array }).contents);
    try {
      stream = zlib.inflateSync(stream);
    } catch {
      // Uncompressed streams are valid PDF content and remain usable.
    }
    const strings = literalStrings(stream);
    if (strings.length) evidence.push({ objectReference: String(reference), strings });
  }
  return evidence;
}

function containsValue(evidence: StreamEvidence[], value: string): StreamEvidence | null {
  const normalized = normalizeBusinessName(value);
  return evidence.find((item) => item.strings.some((entry) => normalizeBusinessName(entry) === normalized)) ?? null;
}

function containsRegistration(evidence: StreamEvidence[], expected: string): StreamEvidence | null {
  const normalized = normalizeRegistration(expected);
  return evidence.find((item) => item.strings.some((entry) => normalizeRegistration(entry).includes(normalized))) ?? null;
}

function hasField(evidence: StreamEvidence[], field: string): StreamEvidence | null {
  return evidence.find((item) => item.strings.some((entry) => entry.trim().toLowerCase() === field.toLowerCase())) ?? null;
}

function assertInsideContractorEvidenceFolder(inputPath: string, cwd: string): string {
  const approved = path.resolve(cwd, "evidence", "contractors", TORQUE_EMPIRE_CONTRACTOR_ID);
  const decoded = decodeURIComponent(inputPath.trim());
  const resolved = path.resolve(cwd, decoded);
  const relative = path.relative(approved, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    fail("CONTRACTOR_EVIDENCE_PATH_INVALID", "Evidence paths must remain inside the allowlisted contractor evidence folder.");
  }
  if (path.extname(resolved).toLowerCase() !== ".pdf") fail("SOURCE_TYPE_INVALID", "Evidence source must be a PDF.");
  return resolved;
}

export function resolveSafeEvidenceOutputPath(outputPath: string, cwd = process.cwd()): string {
  const resolved = path.resolve(cwd, decodeURIComponent(outputPath.trim()));
  const approved = path.resolve(cwd, "reports", "contractors");
  const relative = path.relative(approved, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("OUTPUT_PATH_INVALID", "Output must remain beneath reports/contractors.");
  if (path.extname(resolved).toLowerCase() !== ".json") fail("OUTPUT_EXTENSION_INVALID", "Output must use a .json extension.");
  return resolved;
}

export function writeBusinessIdentityEvidenceIdempotently(outputPath: string, content: string): "created" | "existing_identical" {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  if (fs.existsSync(outputPath)) {
    if (fs.readFileSync(outputPath, "utf8") === content) return "existing_identical";
    fail("OUTPUT_CONFLICT", "Refusing to overwrite a different evidence artifact.");
  }
  fs.writeFileSync(outputPath, content, "utf8");
  return "created";
}

export function stableStringifyBusinessIdentityEvidence(value: unknown): string {
  const sortValue = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(sortValue);
    if (!item || typeof item !== "object") return item;
    return Object.fromEntries(Object.entries(item).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, sortValue(child)]));
  };
  return JSON.stringify(sortValue(value), null, 2);
}

export async function prepareVerifiedContractorBusinessIdentityEvidence(input: PreparationInput): Promise<VerifiedBusinessIdentityEvidence> {
  const cwd = input.cwd ?? process.cwd();
  if (input.contractorDocumentId !== TORQUE_EMPIRE_CONTRACTOR_ID) fail("CONTRACTOR_NOT_ALLOWLISTED", "Only the Torque Empire contractor document ID is allowlisted.");
  if (input.expectedContractorName !== TORQUE_EMPIRE_CONTRACTOR_NAME) fail("CONTRACTOR_NAME_MISMATCH", "Contractor name does not match the allowlisted contractor ID.");
  if (normalizeRegistration(input.expectedRegistrationNumber) !== normalizeRegistration(TORQUE_EMPIRE_REGISTRATION_NUMBER)) fail("REGISTRATION_EXPECTATION_INVALID", "Expected registration number does not match the allowlisted contractor evidence.");

  const primaryPath = assertInsideContractorEvidenceFolder(input.primaryEvidencePath, cwd);
  const supportingPath = assertInsideContractorEvidenceFolder(input.supportingEvidencePath, cwd);
  if (primaryPath === supportingPath) fail("EVIDENCE_PATHS_MUST_BE_DISTINCT", "Primary and supporting evidence must be distinct files.");
  const outputPath = resolveSafeEvidenceOutputPath(input.outputPath, cwd);
  const primaryBuffer = fs.readFileSync(primaryPath);
  const supportingBuffer = fs.readFileSync(supportingPath);
  if (primaryBuffer.subarray(0, 5).toString("ascii") !== "%PDF-" || supportingBuffer.subarray(0, 5).toString("ascii") !== "%PDF-") fail("SOURCE_TYPE_INVALID", "Both evidence sources must be PDF files.");
  const primaryHash = crypto.createHash("sha256").update(primaryBuffer).digest("hex").toUpperCase();
  const supportingHash = crypto.createHash("sha256").update(supportingBuffer).digest("hex").toUpperCase();
  if (primaryHash !== input.expectedPrimarySHA256.toUpperCase()) fail("PRIMARY_HASH_MISMATCH", "Primary evidence hash does not match the confirmed source hash.");
  if (supportingHash !== input.expectedSupportingSHA256.toUpperCase()) fail("SUPPORTING_HASH_MISMATCH", "Supporting evidence hash does not match the confirmed source hash.");

  const [primaryEvidence, supportingEvidence] = await Promise.all([extractStreamEvidence(primaryBuffer), extractStreamEvidence(supportingBuffer)]);
  const primaryName = containsValue(primaryEvidence, "TORQUE EMPIRE");
  const legalName = containsValue(supportingEvidence, "TORQUE EMPIRE (PTY) LTD");
  const primaryRegistration = containsRegistration(primaryEvidence, input.expectedRegistrationNumber);
  const supportingRegistration = containsRegistration(supportingEvidence, input.expectedRegistrationNumber);
  const primaryType = containsValue(primaryEvidence, "Private Company");
  const primaryStatus = containsValue(primaryEvidence, "In Business");
  const supportingStatus = containsValue(supportingEvidence, "In Business");
  if (!primaryName || !legalName || !primaryRegistration || !supportingRegistration || !primaryType || !primaryStatus || !supportingStatus) fail("AUTHORITATIVE_FIELDS_MISSING", "Required CIPC identity, registration, type, or status fields are missing.");

  return {
    contractorDocumentId: input.contractorDocumentId,
    contractorName: input.expectedContractorName,
    evidenceType: "VERIFIED_CIPC_COR14_3_AND_SUPPORTING_CIPC_CERTIFICATE",
    legalBusinessName: "TORQUE EMPIRE (PTY) LTD",
    normalizedLegalBusinessName: "TORQUE EMPIRE PTY LTD",
    primaryRegisteredName: "TORQUE EMPIRE",
    legalSuffixBasis: "The supporting CIPC-issued certificate explicitly records the legal name with the PTY LTD suffix; the primary COR14.3 records the enterprise as a Private Company.",
    companyRegistrationNumber: TORQUE_EMPIRE_REGISTRATION_NUMBER,
    normalizedRegistrationNumber: normalizeRegistration(input.expectedRegistrationNumber),
    primarySourceDocumentPath: path.relative(cwd, primaryPath).replace(/\\/g, "/"),
    primarySourceDocumentSHA256: primaryHash,
    supportingSourceDocumentPath: path.relative(cwd, supportingPath).replace(/\\/g, "/"),
    supportingSourceDocumentSHA256: supportingHash,
    exactSourceFields: {
      primary: { page: 1, objectReference: primaryRegistration.objectReference, enterpriseName: "TORQUE EMPIRE", registrationNumber: "2024 / 105084 / 07", enterpriseType: "Private Company", enterpriseStatus: "In Business" },
      supporting: { page: 1, objectReference: legalName.objectReference, enterpriseName: "TORQUE EMPIRE (PTY) LTD", registrationNumber: "2024/105084/07", enterpriseStatus: "In Business" },
    },
    verificationStatus: "VERIFIED",
    verificationMethod: "LOCAL_PDF_CONTENT_STREAM_VERIFICATION",
    verifiedAt: input.verifiedAt ?? new Date().toISOString(),
    evidenceCollector: input.evidenceCollector,
    logicVersion: CONTRACTOR_BUSINESS_IDENTITY_EVIDENCE_LOGIC_VERSION,
    contractorIsolationStatus: "VERIFIED",
    redactionSummary: { excluded: ["tax_identifiers", "director_identity_numbers", "residential_or_postal_addresses", "phone_numbers", "personal_email_addresses", "authentication_material", "unrelated_personal_information"], rawPdfTextStored: false },
    evidenceLimitations: ["CSD evidence remains invalid or unresolved.", "This artifact is evidence preparation only and does not resolve contractor identity."],
    controls: { appliesOnlyToContractorDocumentId: TORQUE_EMPIRE_CONTRACTOR_ID, csdStatus: "INVALID_OR_UNRESOLVED", identityResolutionOccurred: false, contractorReferenceIssued: false, readinessChanged: false, complianceChanged: false, assignmentAuthorityChanged: false, assignmentAllowed: false, firebaseReadOccurred: false, firebaseWriteOccurred: false, productionMutationOccurred: false },
  };
}
