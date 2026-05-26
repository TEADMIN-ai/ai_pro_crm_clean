import type { CompanyProfile } from "@/lib/autofill/buildCompanyProfile";
import type { SbdFormKey } from "@/lib/pdfs/templates/sbdSchema";

export type TemplateFieldType = "text" | "checkbox" | "signature" | "date";
export type FieldCriticality = "critical" | "important" | "optional";
export type FieldResolutionStrategy =
  | "bounding_box_anchor"
  | "placement_anchor"
  | "placement_fallback"
  | "checkbox_bounding_box"
  | "checkbox_anchor"
  | "checkbox_fallback"
  | "not_rendered_missing_value"
  | "not_rendered_missing_page";

export type FieldPlacementMode = "below" | "right" | "inline" | "replace";
export type FieldAlignment = "left" | "center" | "right";

export type SemanticValueKey =
  | "companyName"
  | "regNumber"
  | "vatNumber"
  | "taxPin"
  | "csdNumber"
  | "cidb"
  | "bankingDetails"
  | "directors"
  | "address"
  | "postalAddress"
  | "streetAddress"
  | "contactPerson"
  | "email"
  | "phone"
  | "bbbeeLevel"
  | "bbbeeStatus"
  | "foreignSupplierYes"
  | "foreignSupplierNo"
  | "companyTypePtyLtd"
  | "companyTypeSoleProprietor"
  | "companyTypeConsortium"
  | "companyTypeJointVenture"
  | "relationshipDeclaration"
  | "signatureName"
  | "signatureRole"
  | "today";

export type TenderFormId = "SBD1" | "SBD4" | "SBD6.1";

export type TextBounds = {
  width: number;
  height?: number;
};

export type FallbackPlacement = {
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height?: number;
};

export type CheckboxGlyph = "X" | "✓";

export type TemplateFieldDefinition = {
  fieldId: string;
  pageIndex: number;
  anchorText: string;
  fieldType: TemplateFieldType;
  criticality?: FieldCriticality;
  semanticKey: SemanticValueKey;
  placement: FieldPlacementMode;
  alignment: FieldAlignment;
  textBounds: TextBounds;
  multiline?: boolean;
  lineHeight?: number;
  maxFontSize?: number;
  minFontSize?: number;
  checkboxGlyph?: CheckboxGlyph;
  fallback: FallbackPlacement;
};

export type EmpirePdfTemplateDefinition = {
  templateKey: SbdFormKey;
  formId: TenderFormId;
  pdfRelativePath: string;
  pageMappings: number[];
  fields: TemplateFieldDefinition[];
};

export type IntelligentAnchorMatch = {
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  sourceText: string;
};

export type SemanticProfile = CompanyProfile & {
  today: string;
  bbbeeLevel: string;
  bbbeeStatus: string;
  foreignSupplier: boolean | null;
  companyType: "PTY_LTD" | "SOLE_PROPRIETOR" | "CONSORTIUM" | "JOINT_VENTURE" | "UNKNOWN";
  relationshipDeclaration: string;
  signatureName: string;
  signatureRole: string;
  postalAddress: string;
  streetAddress: string;
};

export type EngineDebugField = {
  fieldId: string;
  pageIndex: number;
  fieldKey: string;
  value: string;
  rendered: boolean;
  renderSuccess: boolean;
  usedFallback: boolean;
  fallbackUsed: boolean;
  anchorFound: boolean;
  matchedAnchor: IntelligentAnchorMatch | null;
  anchorUsed: boolean;
  anchorText: string;
  aliasMatched: string;
  semanticAliasUsed: string;
  source: string;
  sourceField: string;
  confidence: number;
  resolutionStrategy: FieldResolutionStrategy;
  criticality: FieldCriticality;
  missingDependencies: string[];
  overflowDetected: boolean;
  clippingRisk: boolean;
  multilineOverflowDetected: boolean;
  renderDurationMs: number;
  x: number;
  y: number;
  fontSize: number;
};

export type ReviewFlag = {
  field: string;
  reason: string;
};

export type IntelligentFillResult = {
  debugFields: EngineDebugField[];
  warnings: string[];
  reviewFlags: ReviewFlag[];
  averageConfidence: number;
  renderedFieldCount: number;
};
