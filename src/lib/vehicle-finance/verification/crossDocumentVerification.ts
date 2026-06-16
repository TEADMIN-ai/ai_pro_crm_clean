import type {
  VehicleFinanceCrossDocumentVerification,
  VehicleFinanceDriverLicenceIntelligence,
  VehicleFinanceIdentityDocumentIntelligence,
  VehicleFinanceRiskLevel,
} from "@/types/vehicleFinance";

type CrossDocumentFieldKey = "idNumber" | "dateOfBirth" | "gender" | "surname" | "forename";

export type VehicleFinanceDriverLicenceCrossDocumentSource = Pick<VehicleFinanceDriverLicenceIntelligence, "extraction">;
export type VehicleFinanceIdentityCrossDocumentSource = Pick<VehicleFinanceIdentityDocumentIntelligence, "documentType" | "extraction">;

type NormalizedField = {
  value: string;
  confidence: number;
  sourceText: string;
};

const FIELD_WEIGHTS: Record<CrossDocumentFieldKey, number> = {
  idNumber: 30,
  dateOfBirth: 25,
  gender: 15,
  surname: 20,
  forename: 10,
};

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

function tokenize(value: string | null | undefined): string[] {
  return normalize(value)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
}

function normalizeDate(value: string | null | undefined): string {
  const text = (value ?? "").trim();
  if (!text) {
    return "";
  }

  const compact = text.replace(/\s+/g, "").replace(/\./g, "-").replace(/\//g, "-");
  const isoMatch = compact.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const dottedMatch = compact.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
  if (dottedMatch) {
    const first = dottedMatch[1].padStart(2, "0");
    const second = dottedMatch[2].padStart(2, "0");
    const third = dottedMatch[3].length === 2 ? `20${dottedMatch[3]}` : dottedMatch[3];

    if (dottedMatch[1].length === 4) {
      return `${dottedMatch[1]}-${second}-${first}`;
    }

    return `${third}-${second}-${first}`;
  }

  const ymdMatch = compact.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (ymdMatch) {
    return `${ymdMatch[1]}-${ymdMatch[2]}-${ymdMatch[3]}`;
  }

  return normalize(text);
}

function driverFieldValue(extraction: VehicleFinanceDriverLicenceIntelligence["extraction"], key: keyof NonNullable<VehicleFinanceDriverLicenceIntelligence["extraction"]["fields"]>): NormalizedField {
  const structured = extraction.fields?.[key];
  const confidence = extraction.fieldConfidence?.[key] ?? extraction.confidence ?? 0;

  if (structured) {
    return {
      value: structured.value ?? "",
      confidence: clamp(structured.confidence ?? confidence),
      sourceText: structured.sourceText ?? "",
    };
  }

  const fallbackValue =
    key === "idNumber"
      ? extraction.idNumber
      : key === "dateOfBirth"
        ? extraction.dateOfBirth
        : key === "surname"
          ? extraction.surname
          : key === "name"
            ? extraction.name
            : key === "licenceNumber"
              ? extraction.licenceNumber
              : key === "issueDate"
                ? extraction.issueDate
                : key === "expiryDate"
                  ? extraction.expiryDate
                  : key === "licenceCode"
                    ? extraction.licenceCode
                    : key === "gender"
                      ? extraction.gender
                      : key === "restriction"
                        ? extraction.restriction
                        : extraction.country;

  return {
    value: fallbackValue ?? "",
    confidence: clamp(confidence),
    sourceText: fallbackValue ?? "",
  };
}

function identityFieldValue(
  extraction: VehicleFinanceIdentityDocumentIntelligence["extraction"],
  key: keyof VehicleFinanceIdentityDocumentIntelligence["extraction"],
): NormalizedField {
  const field = extraction[key];
  return {
    value: field.value ?? "",
    confidence: clamp(field.confidence ?? 0),
    sourceText: field.sourceText ?? "",
  };
}

function compareText(left: string, right: string): boolean {
  const normalizedLeft = normalize(left);
  const normalizedRight = normalize(right);
  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  return (
    normalizedLeft === normalizedRight ||
    normalizedLeft.includes(normalizedRight) ||
    normalizedRight.includes(normalizedLeft)
  );
}

function compareForenames(left: string, right: string): boolean {
  const leftTokens = tokenize(left);
  const rightTokens = tokenize(right);
  if (!leftTokens.length || !rightTokens.length) {
    return false;
  }

  return leftTokens.some((token) => rightTokens.includes(token)) || rightTokens.some((token) => leftTokens.includes(token));
}

function compareDate(left: string, right: string): boolean {
  const normalizedLeft = normalizeDate(left);
  const normalizedRight = normalizeDate(right);
  return Boolean(normalizedLeft) && normalizedLeft === normalizedRight;
}

function buildFraudFlag(prefix: string, reason: "MISSING" | "MISMATCH"): string {
  return `${prefix}_${reason}`;
}

function compareField(
  key: CrossDocumentFieldKey,
  left: string,
  right: string,
  comparator: (left: string, right: string) => boolean,
): { matched: boolean; fraudFlag?: string } {
  const flagPrefix =
    key === "forename" ? "FORENAME" : key === "dateOfBirth" ? "DOB" : key === "idNumber" ? "ID" : key === "gender" ? "GENDER" : "SURNAME";
  const hasLeft = Boolean(normalize(left));
  const hasRight = Boolean(normalize(right));

  if (!hasLeft || !hasRight) {
    return {
      matched: false,
      fraudFlag: buildFraudFlag(flagPrefix, "MISSING"),
    };
  }

  const matched = comparator(left, right);
  return matched
    ? { matched: true }
    : {
        matched: false,
        fraudFlag: buildFraudFlag(flagPrefix, "MISMATCH"),
      };
}

export function compareVehicleFinanceDriverLicenceToIdentityDocument(
  driverLicence: VehicleFinanceDriverLicenceCrossDocumentSource | null,
  identityDocument: VehicleFinanceIdentityCrossDocumentSource | null,
): VehicleFinanceCrossDocumentVerification | null {
  if (!driverLicence || !identityDocument) {
    return null;
  }

  if (identityDocument.documentType !== "GREEN_ID_BOOK" && identityDocument.documentType !== "SMART_ID_CARD") {
    return null;
  }

  const driverId = driverFieldValue(driverLicence.extraction, "idNumber");
  const driverDob = driverFieldValue(driverLicence.extraction, "dateOfBirth");
  const driverGender = driverFieldValue(driverLicence.extraction, "gender");
  const driverSurname = driverFieldValue(driverLicence.extraction, "surname");
  const driverForename = driverFieldValue(driverLicence.extraction, "name");

  const identityId = identityFieldValue(identityDocument.extraction, "idNumber");
  const identityDob = identityFieldValue(identityDocument.extraction, "dateOfBirth");
  const identityGender = identityFieldValue(identityDocument.extraction, "gender");
  const identitySurname = identityFieldValue(identityDocument.extraction, "surname");
  const identityForename = identityFieldValue(identityDocument.extraction, "forenames");

  const flags: VehicleFinanceCrossDocumentVerification["flags"] = [];
  const fraudFlags: string[] = [];
  let score = 0;

  const idMatch = compareField("idNumber", driverId.value, identityId.value, compareText);
  if (idMatch.matched) {
    flags.push("ID_MATCH");
    score += FIELD_WEIGHTS.idNumber;
  } else if (idMatch.fraudFlag) {
    fraudFlags.push(idMatch.fraudFlag);
  }

  const dobMatch = compareField("dateOfBirth", driverDob.value, identityDob.value, compareDate);
  if (dobMatch.matched) {
    flags.push("DOB_MATCH");
    score += FIELD_WEIGHTS.dateOfBirth;
  } else if (dobMatch.fraudFlag) {
    fraudFlags.push(dobMatch.fraudFlag);
  }

  const genderMatch = compareField("gender", driverGender.value, identityGender.value, compareText);
  if (genderMatch.matched) {
    flags.push("GENDER_MATCH");
    score += FIELD_WEIGHTS.gender;
  } else if (genderMatch.fraudFlag) {
    fraudFlags.push(genderMatch.fraudFlag);
  }

  const surnameMatch = compareField("surname", driverSurname.value, identitySurname.value, compareText);
  if (surnameMatch.matched) {
    flags.push("SURNAME_MATCH");
    score += FIELD_WEIGHTS.surname;
  } else if (surnameMatch.fraudFlag) {
    fraudFlags.push(surnameMatch.fraudFlag);
  }

  const forenameMatch = compareField("forename", driverForename.value, identityForename.value, compareForenames);
  if (forenameMatch.matched) {
    flags.push("FORENAME_MATCH");
    score += FIELD_WEIGHTS.forename;
  } else if (forenameMatch.fraudFlag) {
    fraudFlags.push(forenameMatch.fraudFlag);
  }

  const identityVerificationScore = clamp(score);
  const riskLevel: VehicleFinanceRiskLevel =
    identityVerificationScore <= 20 ? "CRITICAL" : identityVerificationScore <= 50 ? "HIGH" : identityVerificationScore <= 80 ? "MEDIUM" : "LOW";

  return {
    sourceDocumentType: "DRIVER_LICENCE",
    comparedDocumentType: identityDocument.documentType,
    flags,
    fraudFlags,
    passed: fraudFlags.length === 0 && flags.length === 5,
    identityVerificationScore,
    riskLevel,
  };
}
