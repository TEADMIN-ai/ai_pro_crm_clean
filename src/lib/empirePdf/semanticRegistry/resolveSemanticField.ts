import { findMatchingAlias, isSemanticAliasMatch } from "./aliases";
import { SEMANTIC_TENDER_FIELD_REGISTRY } from "./registry";
import type { ResolveSemanticFieldParams, ResolvedSemanticField, SemanticRegistryFieldDefinition } from "./types";

type FieldResolutionDiagnostics = {
  value: string;
  sourceField: string;
  missingDependencies: string[];
  sourceConfidence: number;
  intentionallyEmpty?: boolean;
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function resolveProfileSourceConfidence(profile: ResolveSemanticFieldParams["profile"], sourceField: string): number {
  const profileKey = sourceField.replace(/^contractor\./, "");
  const attribution = profile.sourceAttribution?.[profileKey as keyof typeof profile.sourceAttribution];

  if (sourceField.startsWith("semantic.")) {
    return 0.97;
  }

  if (attribution === "contractor") {
    return 0.98;
  }

  if (attribution === "document-ai") {
    return 0.9;
  }

  if (attribution === "default") {
    return 0.45;
  }

  return 0.82;
}

function resolveDirectField(
  profile: ResolveSemanticFieldParams["profile"],
  sourceField: string
): FieldResolutionDiagnostics {
  const profileKey = sourceField.replace(/^contractor\./, "") as keyof ResolveSemanticFieldParams["profile"];
  const value = clean(profile[profileKey]);

  return {
    value,
    sourceField,
    missingDependencies: value ? [] : [String(profileKey)],
    sourceConfidence: value ? resolveProfileSourceConfidence(profile, sourceField) : 0.15,
  };
}

function resolveAddressField(
  profile: ResolveSemanticFieldParams["profile"],
  preferredField: "postalAddress" | "streetAddress"
): FieldResolutionDiagnostics {
  const directValue = clean(profile[preferredField]);
  const directAttribution = profile.sourceAttribution?.[preferredField as keyof typeof profile.sourceAttribution];
  const addressFallback = clean(profile.address);
  const isDerivedFromGenericAddress =
    directValue &&
    addressFallback &&
    directValue === addressFallback &&
    (!directAttribution || directAttribution === "default");

  if (directValue && !isDerivedFromGenericAddress) {
    return {
      value: directValue,
      sourceField: `contractor.${preferredField}`,
      missingDependencies: [],
      sourceConfidence: resolveProfileSourceConfidence(profile, `contractor.${preferredField}`),
    };
  }

  if (addressFallback) {
    return {
      value: addressFallback,
      sourceField: "contractor.address",
      missingDependencies: [preferredField],
      sourceConfidence: Number((resolveProfileSourceConfidence(profile, "contractor.address") * 0.72).toFixed(2)),
    };
  }

  return {
    value: "",
    sourceField: `contractor.${preferredField}`,
    missingDependencies: [preferredField, "address"],
    sourceConfidence: 0.15,
  };
}

function resolveSignatureName(profile: ResolveSemanticFieldParams["profile"]): FieldResolutionDiagnostics {
  const directorName = clean(profile.directorName);
  if (directorName) {
    return {
      value: directorName,
      sourceField: "contractor.directorName",
      missingDependencies: [],
      sourceConfidence: resolveProfileSourceConfidence(profile, "contractor.directorName"),
    };
  }

  const contactPerson = clean(profile.contactPerson);
  if (contactPerson) {
    return {
      value: contactPerson,
      sourceField: "contractor.contactPerson",
      missingDependencies: ["directorName"],
      sourceConfidence: Number((resolveProfileSourceConfidence(profile, "contractor.contactPerson") * 0.82).toFixed(2)),
    };
  }

  const companyName = clean(profile.companyName);
  if (companyName) {
    return {
      value: companyName,
      sourceField: "contractor.companyName",
      missingDependencies: ["directorName", "contactPerson"],
      sourceConfidence: Number((resolveProfileSourceConfidence(profile, "contractor.companyName") * 0.65).toFixed(2)),
    };
  }

  return {
    value: "",
    sourceField: "semantic.signatureName",
    missingDependencies: ["directorName", "contactPerson", "companyName"],
    sourceConfidence: 0.15,
  };
}

function resolveSignatureRole(profile: ResolveSemanticFieldParams["profile"]): FieldResolutionDiagnostics {
  const signatoryRole = clean(profile.signatoryRole);
  if (signatoryRole) {
    return {
      value: signatoryRole,
      sourceField: "contractor.signatoryRole",
      missingDependencies: [],
      sourceConfidence: resolveProfileSourceConfidence(profile, "contractor.signatoryRole"),
    };
  }

  return {
    value: profile.signatureRole,
    sourceField: "semantic.signatureRole",
    missingDependencies: ["signatoryRole"],
    sourceConfidence: 0.45,
  };
}

function resolveForeignSupplier(profile: ResolveSemanticFieldParams["profile"]): FieldResolutionDiagnostics {
  if (profile.foreignSupplier === true) {
    return {
      value: "true",
      sourceField: clean(profile.country) ? "contractor.country" : "contractor.address",
      missingDependencies: clean(profile.country) ? [] : ["country"],
      sourceConfidence: clean(profile.country)
        ? resolveProfileSourceConfidence(profile, "contractor.country")
        : 0.62,
    };
  }

  if (profile.foreignSupplier === false) {
    return {
      value: "true",
      sourceField: clean(profile.country) ? "contractor.country" : "contractor.address",
      missingDependencies: clean(profile.country) ? [] : ["country"],
      sourceConfidence: clean(profile.country)
        ? resolveProfileSourceConfidence(profile, "contractor.country")
        : 0.62,
    };
  }

  return {
    value: "",
    sourceField: "semantic.foreignSupplier",
    missingDependencies: ["country", "address", "streetAddress", "postalAddress"],
    sourceConfidence: 0.15,
  };
}

function resolveCompanyType(profile: ResolveSemanticFieldParams["profile"]): FieldResolutionDiagnostics {
  if (profile.companyType !== "UNKNOWN") {
    const businessType = clean(profile.businessType);
    if (businessType) {
      return {
        value: "true",
        sourceField: "contractor.businessType",
        missingDependencies: [],
        sourceConfidence: resolveProfileSourceConfidence(profile, "contractor.businessType"),
      };
    }

    const companyName = clean(profile.companyName);
    if (companyName) {
      return {
        value: "true",
        sourceField: "contractor.companyName",
        missingDependencies: ["businessType"],
        sourceConfidence: Number((resolveProfileSourceConfidence(profile, "contractor.companyName") * 0.7).toFixed(2)),
      };
    }

    const directors = clean(profile.directors);
    if (directors) {
      return {
        value: "true",
        sourceField: "contractor.directors",
        missingDependencies: ["businessType", "companyName"],
        sourceConfidence: Number((resolveProfileSourceConfidence(profile, "contractor.directors") * 0.65).toFixed(2)),
      };
    }
  }

  return {
    value: "",
    sourceField: "semantic.companyType",
    missingDependencies: ["businessType", "companyName", "directors"],
    sourceConfidence: 0.15,
  };
}

function resolveFieldDiagnostics(
  profile: ResolveSemanticFieldParams["profile"],
  field: SemanticRegistryFieldDefinition
): FieldResolutionDiagnostics {
  switch (field.semanticKey) {
    case "foreignSupplierYes": {
      const diagnostics = resolveForeignSupplier(profile);
      return {
        ...diagnostics,
        value: profile.foreignSupplier === true ? diagnostics.value : "",
        intentionallyEmpty: profile.foreignSupplier === false,
      };
    }
    case "foreignSupplierNo": {
      const diagnostics = resolveForeignSupplier(profile);
      return {
        ...diagnostics,
        value: profile.foreignSupplier === false ? diagnostics.value : "",
        intentionallyEmpty: profile.foreignSupplier === true,
      };
    }
    case "companyTypePtyLtd":
      return profile.companyType === "PTY_LTD"
        ? resolveCompanyType(profile)
        : {
            value: "",
            sourceField: "semantic.companyType",
            missingDependencies: profile.companyType === "UNKNOWN" ? ["businessType", "companyName", "directors"] : [],
            sourceConfidence: profile.companyType === "UNKNOWN" ? 0.15 : 0.9,
            intentionallyEmpty: profile.companyType !== "UNKNOWN",
          };
    case "companyTypeSoleProprietor":
      return profile.companyType === "SOLE_PROPRIETOR"
        ? resolveCompanyType(profile)
        : {
            value: "",
            sourceField: "semantic.companyType",
            missingDependencies: profile.companyType === "UNKNOWN" ? ["businessType", "companyName", "directors"] : [],
            sourceConfidence: profile.companyType === "UNKNOWN" ? 0.15 : 0.9,
            intentionallyEmpty: profile.companyType !== "UNKNOWN",
          };
    case "companyTypeConsortium":
      return profile.companyType === "CONSORTIUM"
        ? resolveCompanyType(profile)
        : {
            value: "",
            sourceField: "semantic.companyType",
            missingDependencies: profile.companyType === "UNKNOWN" ? ["businessType", "companyName", "directors"] : [],
            sourceConfidence: profile.companyType === "UNKNOWN" ? 0.15 : 0.9,
            intentionallyEmpty: profile.companyType !== "UNKNOWN",
          };
    case "companyTypeJointVenture":
      return profile.companyType === "JOINT_VENTURE"
        ? resolveCompanyType(profile)
        : {
            value: "",
            sourceField: "semantic.companyType",
            missingDependencies: profile.companyType === "UNKNOWN" ? ["businessType", "companyName", "directors"] : [],
            sourceConfidence: profile.companyType === "UNKNOWN" ? 0.15 : 0.9,
            intentionallyEmpty: profile.companyType !== "UNKNOWN",
          };
    case "signatureName":
      return resolveSignatureName(profile);
    case "signatureRole":
      return resolveSignatureRole(profile);
    case "relationshipDeclaration":
      return {
        value: profile.relationshipDeclaration,
        sourceField: "semantic.relationshipDeclaration",
        missingDependencies: [],
        sourceConfidence: 0.97,
      };
    case "today":
      return {
        value: profile.today,
        sourceField: "semantic.today",
        missingDependencies: [],
        sourceConfidence: 0.99,
      };
    case "postalAddress":
      return resolveAddressField(profile, "postalAddress");
    case "streetAddress":
      return resolveAddressField(profile, "streetAddress");
    default:
      return resolveDirectField(profile, field.sourcePath);
  }
}

function computeConfidence(params: {
  aliasMatched: boolean;
  value: string;
  sourceConfidence: number;
  field: SemanticRegistryFieldDefinition;
  intentionallyEmpty?: boolean;
}): number {
  const aliasWeight = params.aliasMatched ? 0.99 : 0.78;
  const dataWeight = params.value || params.intentionallyEmpty ? params.sourceConfidence : 0.15;
  const requiredPenalty = params.field.required && !params.value && !params.intentionallyEmpty ? 0.2 : 1;
  const semanticBoost = params.field.fieldType === "checkbox" ? 0.99 : 0.95;
  const score = (aliasWeight * 0.35 + dataWeight * 0.45 + semanticBoost * 0.2) * requiredPenalty;

  return Number(Math.max(0, Math.min(0.99, score)).toFixed(2));
}

export function resolveSemanticField(params: ResolveSemanticFieldParams): ResolvedSemanticField {
  const form = SEMANTIC_TENDER_FIELD_REGISTRY[params.formId];
  const entry = form?.fields.find((field) => field.fieldId === params.fieldId);

  if (!entry) {
    return {
      fieldId: params.fieldId,
      value: "",
      source: "unregistered",
      sourceField: "unregistered",
      confidence: 0,
      fallbackUsed: false,
      aliasMatched: params.anchorText,
      semanticAliasUsed: params.anchorText,
      missingDependencies: [],
      reviewFlags: [{ field: params.fieldId, reason: "missing semantic registry definition" }],
    };
  }

  const aliasMatched = findMatchingAlias(entry.aliases, params.anchorText);
  const isAliasMatch = isSemanticAliasMatch(aliasMatched, params.anchorText);
  const diagnostics = resolveFieldDiagnostics(params.profile, entry);
  const confidence = computeConfidence({
    aliasMatched: isAliasMatch,
    value: diagnostics.value,
    sourceConfidence: diagnostics.sourceConfidence,
    field: entry,
    intentionallyEmpty: diagnostics.intentionallyEmpty,
  });
  const reviewFlags: ResolvedSemanticField["reviewFlags"] = [];

  if (!diagnostics.value && !diagnostics.intentionallyEmpty) {
    reviewFlags.push({
      field: entry.fieldId,
      reason: `missing contractor data for ${entry.sourcePath}`,
    });
  }

  for (const dependency of diagnostics.missingDependencies) {
    reviewFlags.push({
      field: entry.fieldId,
      reason: `missing dependency '${dependency}' for ${entry.fieldId}`,
    });
  }

  if (!isAliasMatch) {
    reviewFlags.push({
      field: entry.fieldId,
      reason: `anchor alias '${params.anchorText}' did not exactly match configured registry aliases`,
    });
  }

  if (confidence < 0.7) {
    reviewFlags.push({
      field: entry.fieldId,
      reason: `low confidence semantic resolution (${confidence})`,
    });
  }

  return {
    fieldId: entry.fieldId,
    value: diagnostics.value,
    source: diagnostics.sourceField,
    sourceField: diagnostics.sourceField,
    confidence,
    intentionallyEmpty: diagnostics.intentionallyEmpty,
    fallbackUsed: false,
    aliasMatched,
    semanticAliasUsed: aliasMatched,
    missingDependencies: diagnostics.missingDependencies,
    reviewFlags,
  };
}
