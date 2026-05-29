import type { SemanticProfile, SemanticValueKey, TemplateFieldType, TenderFormId } from "../templates";

export type PlacementPreference = "below_anchor" | "right_of_anchor" | "inline_anchor" | "replace_anchor";

export type SemanticRegistryFieldDefinition = {
  fieldId: string;
  aliases: string[];
  sourcePath: string;
  semanticKey: SemanticValueKey;
  fieldType: TemplateFieldType;
  required: boolean;
  placementPreference: PlacementPreference;
};

export type SemanticRegistryFormDefinition = {
  formId: TenderFormId;
  fields: SemanticRegistryFieldDefinition[];
};

export type ResolvedSemanticField = {
  fieldId: string;
  value: string;
  source: string;
  sourceField: string;
  confidence: number;
  intentionallyEmpty?: boolean;
  fallbackUsed: boolean;
  aliasMatched: string;
  semanticAliasUsed: string;
  missingDependencies: string[];
  reviewFlags: Array<{
    field: string;
    reason: string;
  }>;
};

export type ResolveSemanticFieldParams = {
  formId: TenderFormId;
  fieldId: string;
  anchorText: string;
  profile: SemanticProfile;
};
