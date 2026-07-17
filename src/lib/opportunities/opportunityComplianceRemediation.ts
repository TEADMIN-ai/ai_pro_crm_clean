type AnyRecord = Record<string, unknown>;

export type OpportunityRequirementStatus =
  | "VALID"
  | "MISSING"
  | "EXPIRED"
  | "UNVERIFIED"
  | "UNCLASSIFIED"
  | "INVALID"
  | "WRONG_CONTRACTOR"
  | "DUPLICATE"
  | "NOT_APPLICABLE"
  | "REQUIRES_MANUAL_REVIEW";

export type OpportunityRequirementKey = "tax" | "csd" | "bbbee" | "coida" | "cidb" | "banking" | "tenderSpecific";
export type OpportunityRequirementAction =
  | "View"
  | "Verify document"
  | "Approve document"
  | "Reclassify document"
  | "Upload replacement"
  | "Request document"
  | "Mark not applicable"
  | "Escalate for review";

export type OpportunityRequirementEvidence = {
  documentFound: boolean;
  documentId: string | null;
  contractorId: string | null;
  documentCategory: string | null;
  originalFilename: string | null;
  uploadedAt: string | null;
  expiryDate: string | null;
  analysisStatus: string | null;
  verificationStatus: string | null;
  approvalStatus: string | null;
  workspaceId: string | null;
  latestValidDocument: boolean;
  accepted: boolean;
  reason: string;
};

export type OpportunityRequirementDetail = {
  key: OpportunityRequirementKey;
  requirementName: string;
  required: boolean;
  status: OpportunityRequirementStatus;
  matchedDocument: OpportunityRequirementEvidence | null;
  evidence: OpportunityRequirementEvidence[];
  expiryDate: string | null;
  reason: string;
  blockerSeverity: "none" | "review" | "blocking";
  requiredAction: OpportunityRequirementAction;
  responsiblePerson: "staff" | "contractor" | "compliance" | "manager";
  dueDate: string | null;
};

export type ComplianceRemediationRequestStatus =
  | "draft"
  | "sent"
  | "document_uploaded"
  | "staff_review"
  | "approved"
  | "rejected"
  | "replacement_requested"
  | "completed";

export type ComplianceRemediationRequest = {
  id: string;
  opportunityId: string;
  dealId: string;
  contractorId: string;
  requirement: string;
  requirementKey: OpportunityRequirementKey;
  dueDate: string | null;
  assignedStaffMember: string | null;
  status: ComplianceRemediationRequestStatus;
  surfaces: Array<"execution_workspace" | "contractor_portal" | "staff_task_list" | "notification_queue">;
};

export type OpportunityRequirementInput = {
  key: OpportunityRequirementKey;
  name: string;
  required: boolean;
  tokens: string[];
  validKeys: string[];
};

function rec(value: unknown): AnyRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as AnyRecord) : {};
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function bool(value: unknown): boolean {
  return value === true;
}

function pct(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 0;
}

function asMillis(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
    return value.toMillis();
  }
  return null;
}

function isoDate(value: unknown): string | null {
  const millis = asMillis(value);
  return millis === null ? null : new Date(millis).toISOString().slice(0, 10);
}

function normalize(value: unknown): string {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function documentText(doc: AnyRecord): string {
  return [
    doc.documentType,
    doc.docType,
    doc.complianceType,
    doc.category,
    doc.documentName,
    doc.fileName,
    doc.filename,
    doc.originalName,
    doc.name,
    doc.title,
  ].map((value) => String(value ?? "")).join(" ");
}

function fieldValid(contractor: AnyRecord, keys: string[]): boolean {
  return keys.some((key) => contractor[key] === true || ["valid", "verified", "active", "compliant", "yes"].includes(String(contractor[key] ?? "").toLowerCase()));
}

function hasFile(doc: AnyRecord): boolean {
  return Boolean(str(doc.fileUrl) ?? str(doc.downloadURL) ?? str(doc.url) ?? str(doc.storagePath));
}

function isVerified(doc: AnyRecord): boolean {
  return doc.verified === true || Boolean(asMillis(doc.verifiedAt)) || ["verified", "verified_manual", "approved", "pass"].includes(String(doc.status ?? doc.verificationStatus ?? doc.validationStatus ?? "").toLowerCase());
}

function isRejected(doc: AnyRecord): boolean {
  return doc.verified === false && Boolean(str(doc.validationError) ?? str(doc.rejectionReason)) ||
    ["invalid", "rejected", "rejected_manual", "fail"].includes(String(doc.status ?? doc.verificationStatus ?? doc.validationStatus ?? "").toLowerCase());
}

function isExpired(doc: AnyRecord, now: number): boolean {
  const expiry = asMillis(doc.expiresAt ?? doc.expiryDate);
  return doc.status === "expired" || doc.isExpired === true || (expiry !== null && expiry <= now);
}

function isUnclassified(doc: AnyRecord, tokens: string[]): boolean {
  const typeText = [doc.documentType, doc.docType, doc.complianceType, doc.category].map((value) => String(value ?? "")).join(" ");
  return !tokens.some((token) => normalize(typeText).includes(normalize(token)));
}

function evidenceFor(doc: AnyRecord, accepted: boolean, reason: string): OpportunityRequirementEvidence {
  return {
    documentFound: hasFile(doc),
    documentId: str(doc.id) ?? null,
    contractorId: str(doc.contractorId) ?? str(doc.ownerContractorId),
    documentCategory: str(doc.documentType) ?? str(doc.docType) ?? str(doc.complianceType) ?? str(doc.category),
    originalFilename: str(doc.fileName) ?? str(doc.filename) ?? str(doc.originalName) ?? str(doc.documentName) ?? str(doc.name),
    uploadedAt: isoDate(doc.uploadedAt ?? doc.createdAt),
    expiryDate: isoDate(doc.expiresAt ?? doc.expiryDate),
    analysisStatus: str(doc.aiStatus) ?? str(doc.analysisStatus) ?? str(doc.finalStatus) ?? str(doc.validationStatus),
    verificationStatus: str(doc.verificationStatus) ?? (isVerified(doc) ? "verified" : str(doc.status)),
    approvalStatus: str(doc.approvalStatus) ?? str(doc.finalStatus) ?? (doc.approved === true ? "approved" : null),
    workspaceId: str(doc.workspaceId),
    latestValidDocument: accepted,
    accepted,
    reason,
  };
}

function actionFor(status: OpportunityRequirementStatus): OpportunityRequirementAction {
  switch (status) {
    case "VALID":
      return "View";
    case "UNVERIFIED":
      return "Verify document";
    case "UNCLASSIFIED":
      return "Reclassify document";
    case "EXPIRED":
      return "Request document";
    case "MISSING":
      return "Request document";
    case "INVALID":
      return "Upload replacement";
    case "WRONG_CONTRACTOR":
    case "DUPLICATE":
    case "REQUIRES_MANUAL_REVIEW":
      return "Escalate for review";
    case "NOT_APPLICABLE":
      return "Mark not applicable";
  }
}

function reasonFor(name: string, status: OpportunityRequirementStatus, evidence: OpportunityRequirementEvidence | null): string {
  switch (status) {
    case "VALID":
      return `Valid ${name} found`;
    case "MISSING":
      return `${name} document not found`;
    case "EXPIRED":
      return evidence?.expiryDate ? `${name} expired on ${evidence.expiryDate}` : `${name} document has expired`;
    case "UNVERIFIED":
      return `${name} document uploaded but not verified`;
    case "UNCLASSIFIED":
      return `${name} document requires classification`;
    case "INVALID":
      return `${name} document was rejected or failed verification`;
    case "WRONG_CONTRACTOR":
      return `${name} document belongs to another contractor record`;
    case "DUPLICATE":
      return `Multiple current ${name} documents require manual selection`;
    case "REQUIRES_MANUAL_REVIEW":
      return `${name} requires manual review`;
    case "NOT_APPLICABLE":
      return `${name} is not required for this opportunity`;
  }
}

function documentMatches(doc: AnyRecord, tokens: string[]): boolean {
  const haystack = normalize(documentText(doc));
  return tokens.some((token) => haystack.includes(normalize(token)));
}

function candidateDocuments(contractor: AnyRecord, input: OpportunityRequirementInput): AnyRecord[] {
  const directDocs = Array.isArray(contractor.documents) ? contractor.documents.map(rec) : [];
  const subDocs = Array.isArray(contractor.contractorDocuments) ? contractor.contractorDocuments.map(rec) : [];
  const vaultDocs = Array.isArray(contractor.documentVault) ? contractor.documentVault.map(rec) : [];
  const analysisDocs = Array.isArray(contractor.documentAnalysisRecords) ? contractor.documentAnalysisRecords.map(rec) : [];
  const approvedDocs = Array.isArray(contractor.approvedComplianceRecords) ? contractor.approvedComplianceRecords.map(rec) : [];
  const userDocs = Array.isArray(contractor.profileLinkedDocuments) ? contractor.profileLinkedDocuments.map(rec) : [];
  const legacy = rec(contractor.documentsByType ?? contractor.legacyDocuments);
  const legacyDocs = Object.entries(legacy).map(([key, value]) => ({ id: key, documentType: key, ...rec(value) }));
  const all = [...directDocs, ...subDocs, ...vaultDocs, ...analysisDocs, ...approvedDocs, ...userDocs, ...legacyDocs];
  return all.filter((doc) => documentMatches(doc, input.tokens) || input.tokens.some((token) => normalize(str(doc.id) ?? "").includes(normalize(token))));
}

function bestCandidate(candidates: AnyRecord[], requirement: OpportunityRequirementInput, contractorId: string | null, workspaceId: string | null, now: number): { status: OpportunityRequirementStatus; doc: AnyRecord | null; evidence: OpportunityRequirementEvidence[] } {
  const ranked = candidates.map((doc) => {
    let status: OpportunityRequirementStatus = "REQUIRES_MANUAL_REVIEW";
    if (!hasFile(doc)) status = "MISSING";
    else if (contractorId && str(doc.contractorId) && str(doc.contractorId) !== contractorId) status = "WRONG_CONTRACTOR";
    else if (workspaceId && str(doc.workspaceId) && str(doc.workspaceId) !== workspaceId) status = "INVALID";
    else if (isUnclassified(doc, requirement.tokens)) status = "UNCLASSIFIED";
    else if (isExpired(doc, now)) status = "EXPIRED";
    else if (isRejected(doc)) status = "INVALID";
    else if (!isVerified(doc)) status = "UNVERIFIED";
    else status = "VALID";
    return { doc, status };
  });
  const valid = ranked.filter((item) => item.status === "VALID");
  if (valid.length > 1) {
    return {
      status: "DUPLICATE",
      doc: valid[0].doc,
      evidence: ranked.map((item) => evidenceFor(item.doc, item.doc === valid[0].doc, item.doc === valid[0].doc ? "Duplicate current document selected for review" : "Duplicate candidate")),
    };
  }
  const order: OpportunityRequirementStatus[] = ["VALID", "UNVERIFIED", "EXPIRED", "UNCLASSIFIED", "INVALID", "WRONG_CONTRACTOR", "REQUIRES_MANUAL_REVIEW", "MISSING"];
  const picked = ranked.sort((left, right) => order.indexOf(left.status) - order.indexOf(right.status))[0] ?? null;
  return {
    status: picked?.status ?? "MISSING",
    doc: picked?.doc ?? null,
    evidence: ranked.map((item) => evidenceFor(item.doc, item === picked, item === picked ? "Selected as latest requirement evidence" : "Rejected in favour of stronger evidence")),
  };
}

export function buildOpportunityRequirementDetails(input: {
  requirements: OpportunityRequirementInput[];
  contractor: AnyRecord | null;
  contractorId: string | null;
  workspaceId: string | null;
  dueDate: string | null;
  now?: number;
}): OpportunityRequirementDetail[] {
  const now = input.now ?? Date.now();
  return input.requirements.map((requirement) => {
    if (!requirement.required) {
      return {
        key: requirement.key,
        requirementName: requirement.name,
        required: false,
        status: "NOT_APPLICABLE",
        matchedDocument: null,
        evidence: [],
        expiryDate: null,
        reason: reasonFor(requirement.name, "NOT_APPLICABLE", null),
        blockerSeverity: "none",
        requiredAction: "Mark not applicable",
        responsiblePerson: "staff",
        dueDate: input.dueDate,
      };
    }
    if (!input.contractor) {
      return {
        key: requirement.key,
        requirementName: requirement.name,
        required: true,
        status: "MISSING",
        matchedDocument: null,
        evidence: [],
        expiryDate: null,
        reason: `${requirement.name} cannot be checked until a contractor is assigned`,
        blockerSeverity: "blocking",
        requiredAction: "Request document",
        responsiblePerson: "staff",
        dueDate: input.dueDate,
      };
    }

    const candidates = candidateDocuments(input.contractor, requirement);
    const unclassified = candidates.length === 0 && Array.isArray(input.contractor.documents)
      ? input.contractor.documents.map(rec).find((doc) => requirement.tokens.some((token) => normalize(documentText(doc)).includes(normalize(token))) && isUnclassified(doc, requirement.tokens))
      : null;
    const resolved = unclassified
      ? { status: "UNCLASSIFIED" as OpportunityRequirementStatus, doc: unclassified, evidence: [evidenceFor(unclassified, true, "Document content or filename matches but category is not canonical")] }
      : bestCandidate(candidates, requirement, input.contractorId, input.workspaceId, now);
    const fieldIsValid = fieldValid(input.contractor, requirement.validKeys);
    const finalStatus = resolved.status === "MISSING" && fieldIsValid ? "VALID" : resolved.status;
    const matchedDocument = resolved.doc ? evidenceFor(resolved.doc, finalStatus === "VALID", reasonFor(requirement.name, finalStatus, null)) : null;
    const evidence = matchedDocument
      ? resolved.evidence.map((item) => item.documentId === matchedDocument.documentId ? { ...matchedDocument, latestValidDocument: finalStatus === "VALID", accepted: finalStatus === "VALID" } : item)
      : resolved.evidence;
    return {
      key: requirement.key,
      requirementName: requirement.name,
      required: true,
      status: finalStatus,
      matchedDocument,
      evidence,
      expiryDate: matchedDocument?.expiryDate ?? null,
      reason: reasonFor(requirement.name, finalStatus, matchedDocument),
      blockerSeverity: finalStatus === "VALID" ? "none" : finalStatus === "UNVERIFIED" || finalStatus === "UNCLASSIFIED" || finalStatus === "DUPLICATE" || finalStatus === "REQUIRES_MANUAL_REVIEW" ? "review" : "blocking",
      requiredAction: actionFor(finalStatus),
      responsiblePerson: finalStatus === "MISSING" || finalStatus === "EXPIRED" ? "contractor" : finalStatus === "VALID" || finalStatus === "NOT_APPLICABLE" ? "staff" : "compliance",
      dueDate: input.dueDate,
    };
  });
}

export function calculateProfileCompleteness(contractor: AnyRecord | null): number {
  if (!contractor) return 0;
  const fields = ["companyName", "businessName", "registrationNumber", "taxNumber", "csdNumber", "contactEmail", "phone", "workspaceId"];
  const completed = fields.filter((field) => Boolean(str(contractor[field])) || bool(contractor[field])).length;
  return pct((completed / fields.length) * 100);
}

export function calculateSubmissionReadiness(requirements: OpportunityRequirementDetail[]): number {
  const required = requirements.filter((requirement) => requirement.required);
  if (!required.length) return 100;
  return pct((required.filter((requirement) => requirement.status === "VALID" || requirement.status === "NOT_APPLICABLE").length / required.length) * 100);
}

export function createComplianceRemediationRequests(input: {
  opportunityId: string;
  dealId: string;
  contractorId: string | null;
  requirements: OpportunityRequirementDetail[];
  existingRequests?: ComplianceRemediationRequest[];
  assignedStaffMember?: string | null;
}): ComplianceRemediationRequest[] {
  if (!input.contractorId) return input.existingRequests ?? [];
  const existing = input.existingRequests ?? [];
  const openKeys = new Set(existing.filter((request) => !["completed", "approved"].includes(request.status)).map((request) => `${request.contractorId}:${request.requirementKey}`));
  const next = [...existing];
  for (const requirement of input.requirements) {
    if (requirement.blockerSeverity === "none") continue;
    const key = `${input.contractorId}:${requirement.key}`;
    if (openKeys.has(key)) continue;
    next.push({
      id: `compliance-request-${input.dealId}-${input.contractorId}-${requirement.key}`,
      opportunityId: input.opportunityId,
      dealId: input.dealId,
      contractorId: input.contractorId,
      requirement: requirement.requirementName,
      requirementKey: requirement.key,
      dueDate: requirement.dueDate,
      assignedStaffMember: input.assignedStaffMember ?? null,
      status: "draft",
      surfaces: ["execution_workspace", "contractor_portal", "staff_task_list", "notification_queue"],
    });
    openKeys.add(key);
  }
  return next;
}

export function requirementStatusToComplianceStatus(details: OpportunityRequirementDetail[]): "VALID" | "MISSING" | "EXPIRED" | "UNVERIFIED" | "UNCLASSIFIED" | "INVALID" | "WRONG_CONTRACTOR" | "DUPLICATE" | "REQUIRES_MANUAL_REVIEW" {
  const blocking = details.filter((detail) => detail.required && detail.status !== "VALID" && detail.status !== "NOT_APPLICABLE");
  if (!blocking.length) return "VALID";
  const priority: OpportunityRequirementStatus[] = ["WRONG_CONTRACTOR", "EXPIRED", "INVALID", "MISSING", "UNVERIFIED", "UNCLASSIFIED", "DUPLICATE", "REQUIRES_MANUAL_REVIEW"];
  return priority.find((status) => blocking.some((detail) => detail.status === status)) as ReturnType<typeof requirementStatusToComplianceStatus>;
}

