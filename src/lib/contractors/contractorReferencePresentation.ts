export type ContractorReferencePresentationRecord = {
  id?: string | null;
  contractorId?: string | null;
  uid?: string | null;
  userId?: string | null;
  linkedUserId?: string | null;
  authUid?: string | null;
  teosContractorReference?: string | null;
  contractorReference?: string | null;
  contractorNumber?: string | null;
  businessReference?: string | null;
  registrationNumber?: string | null;
  companyRegistrationNumber?: string | null;
  csdNumber?: string | null;
  csdMNumber?: string | null;
  mNumber?: string | null;
  companyName?: string | null;
  businessName?: string | null;
  legalName?: string | null;
  tradingName?: string | null;
  name?: string | null;
  email?: string | null;
  contactEmail?: string | null;
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalized(value: unknown): string {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function emailLocalPart(value: unknown): string {
  const email = clean(value);
  return email.includes("@") ? email.split("@")[0] ?? "" : "";
}

function isUnsafeReference(record: ContractorReferencePresentationRecord, value: string): boolean {
  const candidate = normalized(value);
  if (!candidate) return true;

  return [
    record.id,
    record.contractorId,
    record.uid,
    record.userId,
    record.linkedUserId,
    record.authUid,
    record.companyName,
    record.businessName,
    record.legalName,
    record.tradingName,
    record.name,
    record.email,
    record.contactEmail,
    emailLocalPart(record.email),
    emailLocalPart(record.contactEmail),
  ].some((unsafeValue) => normalized(unsafeValue) === candidate);
}

export function getBusinessFacingContractorReference(record: ContractorReferencePresentationRecord): string {
  for (const value of [
    record.teosContractorReference,
    record.contractorReference,
    record.contractorNumber,
    record.businessReference,
  ]) {
    const reference = clean(value);
    if (reference && !isUnsafeReference(record, reference)) {
      return reference;
    }
  }

  return "Contractor reference not issued";
}

export function getCipcRegistrationNumber(record: ContractorReferencePresentationRecord): string {
  return clean(record.companyRegistrationNumber) || clean(record.registrationNumber) || "Not recorded";
}

export function getCsdSupplierNumber(record: ContractorReferencePresentationRecord): string {
  return clean(record.csdNumber) || clean(record.csdMNumber) || clean(record.mNumber) || "Not recorded";
}

