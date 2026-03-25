import {
  CHECKBOX_FONT_SIZE,
  FIELD_FONT_SIZE,
  MAX_COMPANY_NAME_LENGTH,
  SBD1_CHECKBOX_PLACEMENTS,
  SBD1_DATE_PLACEMENT,
  SBD1_FIELD_PLACEMENTS,
  SBD1_OVERLAY_DEFAULTS,
} from "./constants";
import type {
  SBD1BbeeStatus,
  SBD1OverlayPlan,
  SBD1OverlayTextInstruction,
  SBD1ValidatedOverlayInput,
} from "./types";

function cleanText(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  return value.replace(/\s+/g, " ").trim();
}

function normalizeCompanyName(value: string | null | undefined): string {
  const resolved = cleanText(value) || SBD1_OVERLAY_DEFAULTS.companyName;
  return resolved.slice(0, MAX_COMPANY_NAME_LENGTH);
}

function normalizeBbeeStatus(value: string | null | undefined): SBD1BbeeStatus {
  return cleanText(value).toUpperCase() === "YES" ? "YES" : "NO";
}

function formatDate(value: Date): string {
  return value.toLocaleDateString("en-ZA");
}

function splitPhoneNumber(value: string | null | undefined): { code: string; number: string } {
  const cleaned = cleanText(value);
  if (!cleaned) {
    return { code: "", number: "" };
  }

  const compact = cleaned.replace(/\s+/g, " ").trim();
  const explicitParts = compact.split(/[\s/()-]+/).filter(Boolean);

  if (explicitParts.length >= 2) {
    return {
      code: explicitParts[0] ?? "",
      number: explicitParts.slice(1).join(" "),
    };
  }

  const digitsOnly = compact.replace(/\D/g, "");
  if (digitsOnly.length >= 7) {
    const codeLength =
      digitsOnly.startsWith("27") && digitsOnly.length >= 11 ? 2 : digitsOnly.startsWith("0") ? 3 : 4;

    return {
      code: digitsOnly.slice(0, codeLength),
      number: digitsOnly.slice(codeLength),
    };
  }

  return { code: "", number: compact };
}

function createFieldInstruction(
  field: SBD1OverlayTextInstruction["field"],
  text: string
): SBD1OverlayTextInstruction {
  const placement = SBD1_FIELD_PLACEMENTS[field];

  return {
    field,
    text,
    x: placement.x,
    y: placement.y,
    size: FIELD_FONT_SIZE,
    maxWidth: placement.maxWidth,
    pageIndex: placement.pageIndex,
    mask: placement.mask,
  };
}

export function buildSBD1OverlayPlan(input: SBD1ValidatedOverlayInput): SBD1OverlayPlan {
  const generatedAt = input.generatedAt ?? new Date();
  const resolvedContactNumber = cleanText(input.contactNumber) || SBD1_OVERLAY_DEFAULTS.contactNumber;
  const splitContactNumber = splitPhoneNumber(resolvedContactNumber);
  const textInstructions = [
    createFieldInstruction("companyName", normalizeCompanyName(input.companyName)),
    createFieldInstruction(
      "companyAddressLine1",
      cleanText(input.companyAddressLine1) || SBD1_OVERLAY_DEFAULTS.companyAddressLine1
    ),
    createFieldInstruction(
      "companyAddressLine2",
      cleanText(input.companyAddressLine2) || SBD1_OVERLAY_DEFAULTS.companyAddressLine2
    ),
    createFieldInstruction("contactNumberCode", splitContactNumber.code || resolvedContactNumber),
    createFieldInstruction("contactNumberValue", splitContactNumber.number || resolvedContactNumber),
    createFieldInstruction("email", cleanText(input.email) || SBD1_OVERLAY_DEFAULTS.email),
    createFieldInstruction("vatNumber", cleanText(input.vatNumber) || SBD1_OVERLAY_DEFAULTS.vatNumber),
  ];
  const bbeeStatus = normalizeBbeeStatus(input.bbbee);

  return {
    textInstructions,
    checkboxInstruction: {
      field: "bbbee",
      mark: "X",
      x: SBD1_CHECKBOX_PLACEMENTS[bbeeStatus].x,
      y: SBD1_CHECKBOX_PLACEMENTS[bbeeStatus].y,
      size: CHECKBOX_FONT_SIZE,
    },
    dateInstruction: {
      field: "date",
      text: formatDate(generatedAt),
      x: SBD1_DATE_PLACEMENT.x,
      y: SBD1_DATE_PLACEMENT.y,
      size: FIELD_FONT_SIZE,
      maxWidth: SBD1_DATE_PLACEMENT.maxWidth,
      pageIndex: SBD1_DATE_PLACEMENT.pageIndex,
      mask: SBD1_DATE_PLACEMENT.mask,
    },
  };
}
