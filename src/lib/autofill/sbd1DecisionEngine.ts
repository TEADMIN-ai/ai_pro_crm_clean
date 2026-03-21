export type FieldRule = {
  fieldName: string;
  required: boolean;
  type: "text" | "number" | "email" | "phone" | "registration";
  allowedValues?: string[];
  fallback?: string[];
  validation?: (value: unknown) => boolean;
};

export type DecisionStatus = "OK" | "BLOCK" | "INVALID";

export type FieldDecision = {
  status: DecisionStatus;
  field: string;
  value?: string | number | null;
  reason?: string;
  usedFallback?: string;
  usedPlaceholder?: boolean;
};

export type AuditEntry = {
  field: string;
  status: DecisionStatus;
  reason: string;
  source?: string;
  value?: string | number | null;
};

export type Sbd1DecisionResolvedData = {
  companyName: string | number | null;
  regNumber: string | number | null;
  postalAddress: string | number | null;
  streetAddress: string | number | null;
  telephone: string | number | null;
  cellphone: string | number | null;
  email: string | number | null;
  vatNumber: string | number | null;
  taxPin: string | number | null;
  csdNumber: string | number | null;
};

export type Sbd1DecisionOutput = {
  resolvedData: Sbd1DecisionResolvedData;
  blockedFields: Array<{ field: string; reason: string }>;
  invalidFields: Array<{ field: string; reason: string; value?: string | number | null }>;
  usedFallbacks: Array<{ field: string; source: string; value: string | number | null }>;
  placeholdersUsed: Array<{ field: string; value: string | number | null }>;
  auditTrail: AuditEntry[];
};

type DecisionInput = Record<string, unknown>;

const SA_REGISTRATION_PATTERN = /^\d{4}\/\d{6}\/\d{2}$/;

export const SBD1_FIELD_RULES: FieldRule[] = [
  {
    fieldName: "companyName",
    required: true,
    type: "text",
    fallback: ["name", "legalName"],
    validation: (value) => normalizeString(value).length > 0,
  },
  {
    fieldName: "regNumber",
    required: true,
    type: "registration",
    fallback: ["registrationNumber", "companyRegistrationNumber", "companyRegNumber"],
  },
  {
    fieldName: "postalAddress",
    required: true,
    type: "text",
    fallback: ["streetAddress", "address", "physicalAddress"],
  },
  {
    fieldName: "streetAddress",
    required: true,
    type: "text",
    fallback: ["postalAddress", "address", "physicalAddress"],
  },
  {
    fieldName: "telephone",
    required: true,
    type: "phone",
    fallback: ["telNumber", "phone", "contactPhone", "cellNumber", "cellphone"],
  },
  {
    fieldName: "cellphone",
    required: false,
    type: "phone",
    fallback: ["cellNumber", "telephone", "telNumber", "phone", "contactPhone"],
  },
  {
    fieldName: "email",
    required: true,
    type: "email",
    fallback: ["contactEmail"],
  },
  {
    fieldName: "vatNumber",
    required: false,
    type: "text",
    fallback: ["vat"],
    validation: validateVatNumber,
  },
  {
    fieldName: "taxPin",
    required: false,
    type: "text",
    fallback: ["taxNumber"],
  },
  {
    fieldName: "csdNumber",
    required: false,
    type: "text",
    fallback: ["csd"],
  },
];

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getPrimaryValue(field: FieldRule, data: DecisionInput): string {
  return normalizeString(data[field.fieldName]);
}

function tryFallbacks(fallbacks: string[] | undefined, data: DecisionInput) {
  if (!Array.isArray(fallbacks)) {
    return { value: "", source: undefined as string | undefined };
  }

  for (const fallbackKey of fallbacks) {
    const fallbackValue = normalizeString(data[fallbackKey]);
    if (fallbackValue) {
      return {
        value: fallbackValue,
        source: fallbackKey,
      };
    }
  }

  return { value: "", source: undefined as string | undefined };
}

function resolvePlaceholder(field: FieldRule): string | number | null {
  if (field.required) return null;
  if (field.type === "number") return 0;
  if (field.type === "phone") return "";
  return "N/A";
}

function validateRegistrationNumber(value: unknown) {
  const normalized = normalizeString(value);
  return SA_REGISTRATION_PATTERN.test(normalized);
}

function validateEmail(value: unknown) {
  const normalized = normalizeString(value);
  return normalized.includes("@");
}

function validatePhone(value: unknown) {
  const normalized = normalizeString(value).replace(/\D/g, "");
  return normalized.length >= 10;
}

function validateVatNumber(value: unknown) {
  const normalized = normalizeString(value);
  if (!normalized) {
    return true;
  }

  return /^\d+$/.test(normalized) || normalized.toLowerCase() === "not vat registered";
}

function validateText(value: unknown) {
  return normalizeString(value).length > 0;
}

function validate(field: FieldRule, value: unknown): boolean {
  if (value === null || value === undefined || value === "") {
    return !field.required;
  }

  if (field.allowedValues && field.allowedValues.length > 0) {
    const normalized = normalizeString(value);
    if (!field.allowedValues.includes(normalized)) {
      return false;
    }
  }

  if (field.validation) {
    return field.validation(value);
  }

  switch (field.type) {
    case "email":
      return validateEmail(value);
    case "phone":
      return validatePhone(value);
    case "registration":
      return validateRegistrationNumber(value);
    case "number":
      return Number.isFinite(typeof value === "number" ? value : Number(value));
    case "text":
    default:
      if (field.fieldName === "vatNumber") {
        return validateVatNumber(value);
      }
      return validateText(value);
  }
}

export function resolveField(field: FieldRule, data: DecisionInput): FieldDecision {
  let value = getPrimaryValue(field, data);
  let usedFallback: string | undefined;

  if (!value) {
    const fallback = tryFallbacks(field.fallback, data);
    value = fallback.value;
    usedFallback = fallback.source;
  }

  if (!value && field.required) {
    return {
      status: "BLOCK",
      reason: "Missing required field",
      field: field.fieldName,
    };
  }

  if (value && !validate(field, value)) {
    return {
      status: "INVALID",
      reason: "Validation failed",
      field: field.fieldName,
      value,
      usedFallback,
    };
  }

  const resolvedValue = value || resolvePlaceholder(field);

  return {
    status: "OK",
    field: field.fieldName,
    value: resolvedValue,
    usedFallback,
    usedPlaceholder: !value,
  };
}

export function resolveSbd1AutofillData(data: DecisionInput): Sbd1DecisionOutput {
  const resolvedData = {} as Sbd1DecisionResolvedData;
  const blockedFields: Sbd1DecisionOutput["blockedFields"] = [];
  const invalidFields: Sbd1DecisionOutput["invalidFields"] = [];
  const usedFallbacks: Sbd1DecisionOutput["usedFallbacks"] = [];
  const placeholdersUsed: Sbd1DecisionOutput["placeholdersUsed"] = [];
  const auditTrail: AuditEntry[] = [];

  for (const field of SBD1_FIELD_RULES) {
    const decision = resolveField(field, data);

    if (decision.status === "BLOCK") {
      resolvedData[field.fieldName as keyof Sbd1DecisionResolvedData] = null;
      blockedFields.push({
        field: field.fieldName,
        reason: decision.reason ?? "Missing required field",
      });
      auditTrail.push({
        field: field.fieldName,
        status: "BLOCK",
        reason: decision.reason ?? "Missing required field",
      });
      continue;
    }

    if (decision.status === "INVALID") {
      resolvedData[field.fieldName as keyof Sbd1DecisionResolvedData] = null;
      invalidFields.push({
        field: field.fieldName,
        reason: decision.reason ?? "Validation failed",
        value: decision.value,
      });
      auditTrail.push({
        field: field.fieldName,
        status: "INVALID",
        reason: decision.reason ?? "Validation failed",
        source: decision.usedFallback,
        value: decision.value,
      });
      continue;
    }

    resolvedData[field.fieldName as keyof Sbd1DecisionResolvedData] =
      decision.value === undefined ? null : decision.value;

    if (decision.usedFallback) {
      usedFallbacks.push({
        field: field.fieldName,
        source: decision.usedFallback,
        value: decision.value ?? null,
      });
    }

    if (decision.usedPlaceholder) {
      placeholdersUsed.push({
        field: field.fieldName,
        value: decision.value ?? null,
      });
    }

    auditTrail.push({
      field: field.fieldName,
      status: "OK",
      reason: decision.usedPlaceholder
        ? "Resolved using placeholder"
        : decision.usedFallback
        ? "Resolved using fallback"
        : "Resolved using primary value",
      source: decision.usedFallback ?? field.fieldName,
      value: decision.value ?? null,
    });
  }

  return {
    resolvedData,
    blockedFields,
    invalidFields,
    usedFallbacks,
    placeholdersUsed,
    auditTrail,
  };
}
