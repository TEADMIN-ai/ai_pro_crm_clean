import type {
  SBD1OverlayInput,
  SBD1OverlayValidationResult,
  SBD1ValidatedOverlayInput,
} from "./types";

function sanitizeOptionalText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const sanitizedValue = value.replace(/\s+/g, " ").trim();
  return sanitizedValue.length > 0 ? sanitizedValue : undefined;
}

function sanitizeGeneratedAt(value: unknown): Date | undefined {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return undefined;
  }

  return value;
}

function buildValidatedValue(input: SBD1OverlayInput): SBD1ValidatedOverlayInput {
  return {
    companyName: sanitizeOptionalText(input.companyName),
    companyAddressLine1: sanitizeOptionalText(input.companyAddressLine1),
    companyAddressLine2: sanitizeOptionalText(input.companyAddressLine2),
    contactNumber: sanitizeOptionalText(input.contactNumber),
    email: sanitizeOptionalText(input.email),
    vatNumber: sanitizeOptionalText(input.vatNumber),
    bbbee: sanitizeOptionalText(input.bbbee),
    generatedAt: sanitizeGeneratedAt(input.generatedAt),
  };
}

export function validateSBD1OverlayInput(input: SBD1OverlayInput): SBD1OverlayValidationResult {
  const issues: string[] = [];
  const validatedValue = buildValidatedValue(input);

  if (input.generatedAt !== undefined && validatedValue.generatedAt === undefined) {
    issues.push("generatedAt must be a valid Date instance");
  }

  if (validatedValue.email && !validatedValue.email.includes("@")) {
    issues.push("email must contain '@' when provided");
  }

  if (
    validatedValue.bbbee &&
    validatedValue.bbbee.toUpperCase() !== "YES" &&
    validatedValue.bbbee.toUpperCase() !== "NO"
  ) {
    issues.push("bbbee must be either 'YES' or 'NO' when provided");
  }

  return {
    isValid: issues.length === 0,
    issues,
    value: validatedValue,
  };
}
