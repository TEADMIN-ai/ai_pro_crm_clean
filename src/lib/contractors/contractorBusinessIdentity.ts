export const CONTRACTOR_BUSINESS_IDENTITY_LOGIC_VERSION = "contractor-business-identity-v1";

export type ContractorBusinessIdentityStatus = "VERIFIED" | "UNRESOLVED" | "CONFLICT";
export type ContractorBusinessIdentityInput = Record<string, unknown>;
export type ContractorBusinessIdentityDecision = {
  status: ContractorBusinessIdentityStatus;
  identityResolved: boolean;
  legalName: string | null;
  tradingName: string | null;
  registeredBusinessName: string | null;
  companyName: string | null;
  label: string | null;
  blockingReasons: string[];
  warnings: string[];
  evidenceFields: string[];
};

type IdentityContext = { technicalIds?: unknown[]; personalValues?: unknown[] };

export function cleanContractorIdentityText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function norm(value: unknown): string | null {
  const text = cleanContractorIdentityText(value);
  return text ? text.toLowerCase().replace(/[^a-z0-9]+/g, "").trim() : null;
}

function local(value: unknown): string | null {
  const email = cleanContractorIdentityText(value);
  return email && email.includes("@") ? email.split("@")[0] || null : null;
}

function nset(values: unknown[]): Set<string> {
  const result = new Set<string>();
  for (const value of values) {
    const next = norm(value);
    if (next) result.add(next);
  }
  return result;
}

export function looksLikePlaceholderContractorIdentity(value: string): boolean {
  return /^(unnamed contractor|unknown|unknown contractor|contractor|n\/a|na|null|undefined)$/i.test(value.trim());
}

export function looksLikePersonalContractorIdentity(value: string): boolean {
  const text = value.toLowerCase().replace(/\s+/g, " ").trim();
  return /^(mr|mrs|ms|miss|dr|prof)\.?\s+\S+/.test(text) || /^(admin|staff|user|test user|unknown user)$/.test(text);
}

function unsafeReason(value: string, input: ContractorBusinessIdentityInput, context: IdentityContext): string | null {
  if (looksLikePlaceholderContractorIdentity(value)) return "Business identity is a placeholder";
  if (looksLikePersonalContractorIdentity(value)) return "Business identity appears to be a personal name";
  const normalized = norm(value);
  if (!normalized) return "Business identity is missing";
  const emails = [input.email, input.contactEmail];
  if (nset([...emails, ...emails.map(local)]).has(normalized)) return "Business identity is derived from email evidence";
  if (nset([input.contractorId, input.id, input.uid, input.authUid, input.userId, ...(context.technicalIds ?? [])]).has(normalized)) return "Business identity is derived from a technical identifier";
  const explicitBusinessEvidence = nset([
    input.legalName,
    input.tradingName,
    input.registeredBusinessName,
    input.businessName,
    input.companyName,
  ]);
  if (explicitBusinessEvidence.has(normalized)) return null;
  const fullName = [cleanContractorIdentityText(input.firstName), cleanContractorIdentityText(input.lastName)].filter(Boolean).join(" ");
  if (nset([input.name, input.displayName, input.firstName, input.lastName, fullName, ...(context.personalValues ?? [])]).has(normalized)) return "Business identity is derived from personal profile evidence";
  return null;
}

function candidate(field: string, value: unknown, input: ContractorBusinessIdentityInput, context: IdentityContext) {
  const text = cleanContractorIdentityText(value);
  return text ? { field, value: text, reason: unsafeReason(text, input, context) } : null;
}

export function resolveContractorBusinessIdentity(input: ContractorBusinessIdentityInput, context: IdentityContext = {}): ContractorBusinessIdentityDecision {
  const candidates = [
    candidate("legalName", input.legalName, input, context),
    candidate("tradingName", input.tradingName, input, context),
    candidate("registeredBusinessName", input.registeredBusinessName ?? input.businessName, input, context),
    candidate("companyName", input.companyName, input, context),
  ].filter((item): item is { field: string; value: string; reason: string | null } => Boolean(item));
  const warnings = Array.from(new Set(candidates.flatMap((item) => item.reason ? [item.reason] : [])));
  const valid = candidates.filter((item) => !item.reason);
  const canonical = new Set(valid.filter((item) => item.field !== "tradingName").map((item) => norm(item.value)).filter((item): item is string => Boolean(item)));
  if (canonical.size > 1) return { status: "CONFLICT", identityResolved: false, legalName: null, tradingName: null, registeredBusinessName: null, companyName: null, label: null, blockingReasons: ["Contractor business identity evidence is conflicting"], warnings, evidenceFields: valid.map((item) => item.field) };
  const legalName = valid.find((item) => item.field === "legalName")?.value ?? null;
  const tradingName = valid.find((item) => item.field === "tradingName")?.value ?? null;
  const registeredBusinessName = valid.find((item) => item.field === "registeredBusinessName")?.value ?? null;
  const companyName = valid.find((item) => item.field === "companyName")?.value ?? null;
  const label = legalName ?? tradingName ?? registeredBusinessName ?? companyName;
  if (!label) return { status: "UNRESOLVED", identityResolved: false, legalName: null, tradingName: null, registeredBusinessName: null, companyName: null, label: null, blockingReasons: ["Contractor business identity evidence is missing"], warnings, evidenceFields: [] };
  return { status: "VERIFIED", identityResolved: true, legalName, tradingName, registeredBusinessName, companyName, label, blockingReasons: [], warnings, evidenceFields: valid.map((item) => item.field) };
}

export function buildUnresolvedContractorIdentityFields(input: { source: string; sourceUserUid?: string | null; workspaceId?: string | null; existingBlockingReasons?: string[]; nowIso?: string }) {
  const workspaceResolutionStatus = input.workspaceId ? "RESOLVED" : "UNRESOLVED";
  const blockingReasons = Array.from(new Set([...(input.existingBlockingReasons ?? []), "Contractor business identity evidence is missing", ...(input.workspaceId ? [] : ["Contractor workspace resolution is unresolved"])]));
  const now = input.nowIso ?? new Date().toISOString();
  return { workspaceId: input.workspaceId ?? null, workspaceResolutionStatus, identityResolved: false, identityStatus: "UNRESOLVED", identityResolutionStatus: "UNRESOLVED", businessIdentityEvidenceStatus: "MISSING", blockingReasons, status: "identity_unresolved", logicVersion: CONTRACTOR_BUSINESS_IDENTITY_LOGIC_VERSION, sourceMetadata: { source: input.source, sourceUserUid: input.sourceUserUid ?? null, workspaceResolutionStatus, missingEvidence: ["legalName", "tradingName", "registeredBusinessName"], decisionLogicVersion: CONTRACTOR_BUSINESS_IDENTITY_LOGIC_VERSION, createdAt: now } };
}

export function hasResolvedContractorBusinessIdentity(record: ContractorBusinessIdentityInput): boolean {
  if (record.identityResolved === false) return false;
  return resolveContractorBusinessIdentity(record).identityResolved;
}
