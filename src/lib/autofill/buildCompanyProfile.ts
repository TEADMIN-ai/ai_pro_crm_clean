import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { SBD_FIELD_DEFINITIONS, type SbdFieldKey } from "@/lib/pdfs/templates/sbdSchema";

type SourceTag = "contractor" | "document-ai" | "default";

export type CompanyProfile = {
  contractorId: string;
  companyName: string;
  regNumber: string;
  vatNumber: string;
  taxPin: string;
  cidb: string;
  csdNumber: string;
  bankingDetails: string;
  directors: string;
  address: string;
  contactPerson: string;
  email: string;
  phone: string;
  missingFields: SbdFieldKey[];
  sourceAttribution: Partial<Record<SbdFieldKey, SourceTag>>;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function pickFirst(...values: unknown[]): string {
  for (const value of values) {
    const normalized = asString(value);
    if (normalized) {
      return normalized;
    }
  }
  return "";
}

type DocumentExtract = Partial<Record<SbdFieldKey, string>>;

function readDocumentExtract(data: Record<string, unknown>): DocumentExtract {
  const extracted =
    (data.extractedFields as Record<string, unknown> | undefined) ??
    (data.extracted as Record<string, unknown> | undefined) ??
    {};

  return {
    companyName: pickFirst(extracted.companyName, extracted.legalName),
    regNumber: pickFirst(
      extracted.regNumber,
      extracted.registrationNumber,
      extracted.companyRegNumber,
      extracted.companyRegistrationNumber,
      extracted.employerRegistrationNumber
    ),
    vatNumber: pickFirst(extracted.vatNumber, extracted.vat),
    taxPin: pickFirst(extracted.taxPin, extracted.taxNumber),
    cidb: pickFirst(extracted.cidb, extracted.cidbNumber),
    csdNumber: pickFirst(extracted.csdNumber, extracted.csd),
    bankingDetails: pickFirst(
      extracted.bankingDetails,
      extracted.bankName,
      extracted.bankAccount,
      extracted.accountNumber,
      extracted.branchCode
    ),
    directors: pickFirst(extracted.directors, extracted.directorNames),
    address: pickFirst(extracted.address, extracted.physicalAddress, extracted.postalAddress),
    contactPerson: pickFirst(extracted.contactPerson, extracted.contactName, extracted.accountHolder),
    email: pickFirst(extracted.email, extracted.contactEmail),
    phone: pickFirst(extracted.phone, extracted.contactPhone),
  };
}

const REQUIRED_DIAGNOSTIC_FIELDS = [
  { name: "companyName", resolve: (profile: Omit<CompanyProfile, "missingFields" | "sourceAttribution">) => profile.companyName },
  { name: "vatNumber", resolve: (profile: Omit<CompanyProfile, "missingFields" | "sourceAttribution">) => profile.vatNumber },
  { name: "taxPin", resolve: (profile: Omit<CompanyProfile, "missingFields" | "sourceAttribution">) => profile.taxPin },
  { name: "csdNumber", resolve: (profile: Omit<CompanyProfile, "missingFields" | "sourceAttribution">) => profile.csdNumber },
  { name: "telephone", resolve: (profile: Omit<CompanyProfile, "missingFields" | "sourceAttribution">) => profile.phone },
  { name: "email", resolve: (profile: Omit<CompanyProfile, "missingFields" | "sourceAttribution">) => profile.email },
] as const;

export async function buildCompanyProfile(contractorId: string): Promise<CompanyProfile> {
  const db = getFirebaseAdmin();

  let contractorData: Record<string, unknown> = {};
  let documentData: Array<Record<string, unknown>> = [];

  try {
    const contractorSnap = await db.collection("contractors").doc(contractorId).get();
    contractorData = (contractorSnap.data() ?? {}) as Record<string, unknown>;
  } catch {
    contractorData = {};
  }

  try {
    const docsSnap = await db.collection("contractors").doc(contractorId).collection("documents").get();
    documentData = docsSnap.docs.map((doc: any) => (doc.data() ?? {}) as Record<string, unknown>);
  } catch {
    documentData = [];
  }

  const sourceAttribution: Partial<Record<SbdFieldKey, SourceTag>> = {};
  const profile: Omit<CompanyProfile, "missingFields" | "sourceAttribution"> = {
    contractorId,
    companyName: pickFirst(
      contractorData.companyName,
      contractorData.name,
      contractorData.legalName
    ),
    regNumber: pickFirst(
      contractorData.regNumber,
      contractorData.registrationNumber,
      contractorData.companyRegistrationNumber,
      contractorData.coidaRegistrationNumber
    ),
    vatNumber: pickFirst(contractorData.vatNumber, contractorData.vat),
    taxPin: pickFirst(contractorData.taxPin, contractorData.taxNumber),
    cidb: pickFirst(contractorData.cidb, contractorData.cidbNumber),
    csdNumber: pickFirst(contractorData.csdNumber, contractorData.csd),
    bankingDetails: pickFirst(
      contractorData.bankingDetails,
      contractorData.bankDetails,
      contractorData.bankName,
      contractorData.bankAccountNumber,
      contractorData.bankBranchCode
    ),
    directors: pickFirst(contractorData.directors, contractorData.directorNames),
    address: pickFirst(contractorData.address, contractorData.physicalAddress),
    contactPerson: pickFirst(contractorData.contactPerson, contractorData.contactName),
    email: pickFirst(contractorData.email),
    phone: pickFirst(contractorData.phone),
  };

  (Object.keys(profile) as Array<keyof typeof profile>).forEach((key) => {
    if (key !== "contractorId" && asString(profile[key])) {
      sourceAttribution[key as SbdFieldKey] = "contractor";
    }
  });

  for (const doc of documentData) {
    const extract = readDocumentExtract(doc);
    const keys = Object.keys(SBD_FIELD_DEFINITIONS) as SbdFieldKey[];
    for (const key of keys) {
      if (!profile[key]) {
        const extractedValue = pickFirst(extract[key]);
        if (extractedValue) {
          profile[key] = extractedValue;
          sourceAttribution[key] = "document-ai";
        }
      }
    }
  }

  const mapped = {
    ...profile,
  };

  const missingFields = (Object.keys(SBD_FIELD_DEFINITIONS) as SbdFieldKey[]).filter((key) => !mapped[key]);

  for (const key of missingFields) {
    sourceAttribution[key] = "default";
    mapped[key] = "";
  }

  console.log("Mapped Data:", {
    contractorId,
    contractorData,
    documentCount: documentData.length,
    mappedData: mapped,
    sourceAttribution,
    missingFields,
  });

  for (const field of REQUIRED_DIAGNOSTIC_FIELDS) {
    if (!field.resolve(mapped)) {
      console.warn("Missing field:", field.name);
    }
  }

  return {
    ...mapped,
    missingFields,
    sourceAttribution,
  };
}
