import type { CompanyProfile } from "@/lib/autofill/buildCompanyProfile";

import type { SemanticProfile, SemanticValueKey } from "./templates";

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function inferCompanyType(profile: CompanyProfile): SemanticProfile["companyType"] {
  const source = [
    clean(profile.companyName),
    clean(profile.directors),
    clean(profile.businessType),
  ]
    .join(" ")
    .toLowerCase();

  if (source.includes("joint venture") || /\bjv\b/.test(source)) {
    return "JOINT_VENTURE";
  }

  if (source.includes("consortium")) {
    return "CONSORTIUM";
  }

  if (source.includes("sole proprietor") || source.includes("sole prop")) {
    return "SOLE_PROPRIETOR";
  }

  if (source.includes("pty") || source.includes("proprietary limited")) {
    return "PTY_LTD";
  }

  return "UNKNOWN";
}

function inferForeignSupplier(profile: CompanyProfile): boolean | null {
  const country = clean(profile.country).toLowerCase();
  if (country) {
    return !["south africa", "rsa", "za"].includes(country);
  }

  const address = [clean(profile.address), clean(profile.streetAddress), clean(profile.postalAddress)]
    .join(" ")
    .toLowerCase();

  if (!address) {
    return null;
  }

  if (
    address.includes("south africa") ||
    address.includes("johannesburg") ||
    address.includes("pretoria") ||
    address.includes("cape town") ||
    address.includes("durban") ||
    address.includes("gauteng")
  ) {
    return false;
  }

  return null;
}

function extractBbbeeLevel(profile: CompanyProfile): string {
  const direct = clean(profile.bbbeeLevel || profile.bbbeeStatus);
  if (!direct) {
    return "";
  }

  const match = direct.match(/\b([1-8])\b/);
  return match ? `Level ${match[1]}` : direct;
}

export function buildSemanticProfile(profile: CompanyProfile): SemanticProfile {
  const today = new Date().toLocaleDateString("en-ZA");
  const bbbeeLevel = extractBbbeeLevel(profile);
  const foreignSupplier = inferForeignSupplier(profile);

  return {
    ...profile,
    today,
    bbbeeLevel,
    bbbeeStatus: clean(profile.bbbeeStatus || profile.bbbeeLevel),
    foreignSupplier,
    companyType: inferCompanyType(profile),
    relationshipDeclaration: "None",
    signatureName: clean(profile.directorName) || clean(profile.contactPerson) || clean(profile.companyName),
    signatureRole: clean(profile.signatoryRole) || "Authorized Signatory",
    postalAddress: clean(profile.postalAddress) || clean(profile.address),
    streetAddress: clean(profile.streetAddress) || clean(profile.address),
  };
}

export function resolveSemanticValue(profile: SemanticProfile, key: SemanticValueKey): string {
  switch (key) {
    case "foreignSupplierYes":
      return profile.foreignSupplier === true ? "true" : "";
    case "foreignSupplierNo":
      return profile.foreignSupplier === false ? "true" : "";
    case "companyTypePtyLtd":
      return profile.companyType === "PTY_LTD" ? "true" : "";
    case "companyTypeSoleProprietor":
      return profile.companyType === "SOLE_PROPRIETOR" ? "true" : "";
    case "companyTypeConsortium":
      return profile.companyType === "CONSORTIUM" ? "true" : "";
    case "companyTypeJointVenture":
      return profile.companyType === "JOINT_VENTURE" ? "true" : "";
    case "relationshipDeclaration":
      return profile.relationshipDeclaration;
    case "signatureName":
      return profile.signatureName;
    case "signatureRole":
      return profile.signatureRole;
    case "today":
      return profile.today;
    default: {
      const value = profile[key];
      return typeof value === "string" ? value.trim() : "";
    }
  }
}
