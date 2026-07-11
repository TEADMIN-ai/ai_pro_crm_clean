import type { CheckboxRenderStyle, OverflowBehavior } from "../boundingBoxes";
import type { FieldAlignment, FieldCriticality, TemplateFieldType } from "../templates";

export type PdfReferenceFolderRole =
  | "blank_forms"
  | "approved_completed"
  | "notes"
  | "teos_generated"
  | "difference_reports"
  | "field_maps"
  | "json"
  | "fonts"
  | "screenshots"
  | "signatures"
  | "version_history"
  | "custom";

export type PdfReferenceFolder = {
  role: PdfReferenceFolderRole;
  label: string;
  relativePath: string;
  required: boolean;
};

export type PdfReferenceLibrarySpec = {
  rootRelativePath: string;
  folders: PdfReferenceFolder[];
};

export type PdfVerticalAlignment = "top" | "middle" | "bottom" | "baseline";
export type PdfOverflowBehaviour = OverflowBehavior | "clip" | "review_required";

export type PdfBoundingRectangle = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PdfFontRule = {
  family: string;
  size: number;
  minimumSize: number;
  bold: boolean;
};

export type PdfCheckboxRule = {
  association?: string;
  style: CheckboxRenderStyle;
  alignmentTolerance: number;
};

export type PdfSignatureRule = {
  zone?: string;
  allowImage: boolean;
  allowTypedName: boolean;
  overlapTolerance: number;
};

export type PdfFieldMetadata = {
  fieldName: string;
  fieldType: TemplateFieldType;
  page: number;
  boundingRectangle: PdfBoundingRectangle;
  alignment: FieldAlignment;
  verticalAlignment: PdfVerticalAlignment;
  maximumCharacters?: number;
  font: PdfFontRule;
  wrapAllowed: boolean;
  shrinkAllowed: boolean;
  overflowBehaviour: PdfOverflowBehaviour;
  checkbox?: PdfCheckboxRule;
  signature?: PdfSignatureRule;
  confidenceScore: number;
  criticality: FieldCriticality;
  source?: {
    registry: string;
    templateVersion?: string;
    fieldVersion?: string;
  };
};

export type PdfBusinessFieldValue = {
  fieldName: string;
  value: string;
  source?: string;
  confidenceScore?: number;
};

export type PdfLayoutPlan = {
  field: PdfFieldMetadata;
  value: PdfBusinessFieldValue | null;
  resolvedRectangle: PdfBoundingRectangle;
  font: PdfFontRule;
  overflowBehaviour: PdfOverflowBehaviour;
  confidenceScore: number;
};

export type PdfValidationIssueCode =
  | "text_overflow"
  | "field_clipping"
  | "text_outside_boundaries"
  | "checkbox_alignment"
  | "checkbox_mismatch"
  | "missing_mandatory_value"
  | "reference_metadata_missing"
  | "reference_version_mismatch"
  | "field_map_missing"
  | "font_scaling"
  | "signature_overlap"
  | "signature_placement"
  | "image_overlap"
  | "page_overflow"
  | "unknown_field"
  | "alignment_warning"
  | "low_confidence";

export type PdfValidationSeverity = "info" | "warning" | "error";

export type PdfValidationIssue = {
  code: PdfValidationIssueCode;
  severity: PdfValidationSeverity;
  fieldName?: string;
  message: string;
  confidenceImpact: number;
};

export type PdfReferenceStatus =
  | "not_captured"
  | "blank_captured"
  | "approved_reference_captured"
  | "field_map_draft"
  | "field_map_complete"
  | "validated";

export type PdfReferenceDocumentKind =
  | "blank_pdf"
  | "approved_pdf"
  | "generated_pdf"
  | "future_difference_report"
  | "validation_report";

export type PdfReferenceDocumentDescriptor = {
  documentName: string;
  version?: string;
  municipality?: string;
  department?: string;
  kind: PdfReferenceDocumentKind;
  relativePath: string;
  status: PdfReferenceStatus;
  source: "reference_library" | "generated_output" | "external";
};

export type PdfLoadedReferenceDocument = PdfReferenceDocumentDescriptor & {
  bytes?: Uint8Array;
  loadedAt: string;
};

export type PdfReferenceMetadata = {
  documentName: string;
  version: string;
  municipality?: string;
  department?: string;
  revision?: string;
  approvalDate?: string;
  referenceStatus: PdfReferenceStatus;
  source: "registry" | "inferred";
  matchedVersion: boolean;
  availableVersions: string[];
  fieldMapCount: number;
  assetCount: number;
};

export type PdfReferenceDocumentSet = {
  documentName: string;
  version?: string;
  municipality?: string;
  blankPdf?: PdfReferenceDocumentDescriptor;
  approvedPdf?: PdfReferenceDocumentDescriptor;
  generatedPdf?: PdfReferenceDocumentDescriptor;
  futureDifferenceReport?: PdfReferenceDocumentDescriptor;
  validationReport?: PdfReferenceDocumentDescriptor;
};

export type PdfReferenceSource = {
  load(descriptor: PdfReferenceDocumentDescriptor): Promise<PdfLoadedReferenceDocument>;
};


export type PdfValidationReport = {
  documentName?: string;
  documentVersion?: string;
  referenceMetadata?: PdfReferenceMetadata;
  issues: PdfValidationIssue[];
  warnings?: PdfValidationIssue[];
  errors?: PdfValidationIssue[];
  confidenceScore: number;
  readiness?: PdfDocumentReadiness;
  checkedAt: string;
};

export type PdfDifferenceReportRequest = {
  blankFormPath: string;
  approvedReferencePath: string;
  teosGeneratedPath: string;
  outputPath: string;
};


export type PdfDocumentReadiness =
  | "NOT_READY"
  | "REFERENCE_CAPTURED"
  | "FIELD_MAP_COMPLETE"
  | "VALIDATED"
  | "REVIEW_REQUIRED"
  | "READY_FOR_INTERNAL_USE"
  | "READY_FOR_CLIENT_REVIEW"
  | "READY_FOR_SUBMISSION";

export type PdfDocumentApprovalState =
  | "draft"
  | "validation_pending"
  | "internal_review"
  | "client_review"
  | "approved"
  | "rejected";

export type PdfDocumentRegistryRecord = {
  documentName: string;
  version: string;
  municipality?: string;
  issueDate?: string;
  revision?: string;
  referencePdf?: string;
  generatedPdf?: string;
  validationReport?: string;
  confidenceScore?: number;
  approvalState: PdfDocumentApprovalState;
  readiness?: PdfDocumentReadiness;
  documentVersion?: string;
  referenceStatus?: PdfReferenceStatus;
  approvedReference?: string;
  generatedOutput?: string;
  differenceReport?: string;
  submissionReadiness?: PdfDocumentReadiness;
  metadata?: Record<string, string>;
};

export type PdfDocumentRegistry = {
  records: PdfDocumentRegistryRecord[];
};

export type PdfValidationReportSummary = {
  missingFields: PdfValidationIssue[];
  overflow: PdfValidationIssue[];
  alignmentWarnings: PdfValidationIssue[];
  fontScaling: PdfValidationIssue[];
  checkboxMismatch: PdfValidationIssue[];
  signaturePlacement: PdfValidationIssue[];
  pageOverflow: PdfValidationIssue[];
  unknownFields: PdfValidationIssue[];
  warnings: PdfValidationIssue[];
  errors: PdfValidationIssue[];
  overallConfidence: number;
  readiness: PdfDocumentReadiness;
};

export type PdfDifferenceIssueCode =
  | "field_movement"
  | "font_difference"
  | "alignment_difference"
  | "missing_value"
  | "overflow"
  | "checkbox_difference"
  | "signature_difference";

export type PdfDifferenceIssue = {
  code: PdfDifferenceIssueCode;
  fieldName?: string;
  message: string;
  severity: PdfValidationSeverity;
  confidenceImpact: number;
};

export type PdfDifferenceReport = {
  request: PdfDifferenceReportRequest;
  issues: PdfDifferenceIssue[];
  confidenceScore: number;
  generatedAt: string;
  imageComparisonPerformed: false;
};

export type JsonFieldMapDocument = {
  document: string;
  version: string;
  schemaVersion: string;
  pages: JsonFieldMapPage[];
};

export type JsonFieldMapPage = {
  page: number;
  fields: JsonFieldMapField[];
};

export type JsonFieldMapField = {
  field: string;
  fieldId?: string;
  fieldName?: string;
  fieldType: TemplateFieldType;
  page?: number;
  rectangle?: PdfBoundingRectangle | null;
  boundingBox: PdfBoundingRectangle | null;
  x?: number | null;
  y?: number | null;
  width?: number | null;
  height?: number | null;
  font: PdfFontRule | null;
  maximumCharacters?: number | null;
  alignment: FieldAlignment | null;
  verticalAlignment: PdfVerticalAlignment | null;
  overflowRule: PdfOverflowBehaviour | null;
  checkboxRelationship?: string | null;
  signatureRelationship?: string | null;
  referenceSource?: string;
  approvalStatus?: "unreviewed" | "review_required" | "approved" | "rejected";
  checkbox?: PdfCheckboxRule | null;
  signatureZone?: PdfSignatureRule | null;
  confidenceMetadata: {
    score: number | null;
    source: string | null;
    measuredBy: string | null;
    measuredAt: string | null;
    notes?: string;
  };
};

export const PdfDocumentReadiness = {
  NOT_READY: "NOT_READY",
  REFERENCE_CAPTURED: "REFERENCE_CAPTURED",
  FIELD_MAP_COMPLETE: "FIELD_MAP_COMPLETE",
  VALIDATED: "VALIDATED",
  REVIEW_REQUIRED: "REVIEW_REQUIRED",
  READY_FOR_INTERNAL_USE: "READY_FOR_INTERNAL_USE",
  READY_FOR_CLIENT_REVIEW: "READY_FOR_CLIENT_REVIEW",
  READY_FOR_SUBMISSION: "READY_FOR_SUBMISSION",
} as const;

export const PdfDocumentApprovalState = {
  DRAFT: "draft",
  VALIDATION_PENDING: "validation_pending",
  INTERNAL_REVIEW: "internal_review",
  CLIENT_REVIEW: "client_review",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

export const PdfValidationSeverity = {
  INFO: "info",
  WARNING: "warning",
  ERROR: "error",
} as const;

export const PdfValidationIssueCode = {
  TEXT_OVERFLOW: "text_overflow",
  FIELD_CLIPPING: "field_clipping",
  TEXT_OUTSIDE_BOUNDARIES: "text_outside_boundaries",
  CHECKBOX_ALIGNMENT: "checkbox_alignment",
  CHECKBOX_MISMATCH: "checkbox_mismatch",
  MISSING_MANDATORY_VALUE: "missing_mandatory_value",
  REFERENCE_METADATA_MISSING: "reference_metadata_missing",
  REFERENCE_VERSION_MISMATCH: "reference_version_mismatch",
  FIELD_MAP_MISSING: "field_map_missing",
  FONT_SCALING: "font_scaling",
  SIGNATURE_OVERLAP: "signature_overlap",
  SIGNATURE_PLACEMENT: "signature_placement",
  IMAGE_OVERLAP: "image_overlap",
  PAGE_OVERFLOW: "page_overflow",
  UNKNOWN_FIELD: "unknown_field",
  ALIGNMENT_WARNING: "alignment_warning",
  LOW_CONFIDENCE: "low_confidence",
} as const;

export const PdfDifferenceIssueCode = {
  FIELD_MOVEMENT: "field_movement",
  FONT_DIFFERENCE: "font_difference",
  ALIGNMENT_DIFFERENCE: "alignment_difference",
  MISSING_VALUE: "missing_value",
  OVERFLOW: "overflow",
  CHECKBOX_DIFFERENCE: "checkbox_difference",
  SIGNATURE_DIFFERENCE: "signature_difference",
} as const;

export type PdfOverflowBehavior = PdfOverflowBehaviour;
export type PdfBoundingBox = PdfBoundingRectangle;
export type PdfFieldMapDocument = JsonFieldMapDocument;
export type PdfFieldMapPage = JsonFieldMapPage;
export type PdfFieldMapField = JsonFieldMapField;


export type PdfDiscoveredFieldKind =
  | "text"
  | "checkbox"
  | "signature"
  | "static_label"
  | "table"
  | "reserved_area"
  | "unknown";

export type PdfDiscoveredField = {
  fieldId: string;
  fieldName: string;
  page: number;
  kind: PdfDiscoveredFieldKind;
  rectangle: PdfBoundingRectangle | null;
  confidenceMetadata: JsonFieldMapField["confidenceMetadata"];
  referenceSource: string;
  approvalStatus: "unreviewed" | "review_required" | "approved" | "rejected";
  classification?: PdfFieldClassification;
};

export type PdfFieldClassification =
  | "business_data"
  | "static_reference"
  | "checkbox_control"
  | "signature_zone"
  | "table_boundary"
  | "page_region"
  | "reserved_area"
  | "unknown";

export type PdfCoordinateExtractionResult = {
  document: string;
  version: string;
  fields: PdfDiscoveredField[];
  extractedAt: string;
  extractionPerformed: false;
};

export type PdfStaticLayoutRegionKind =
  | "checkbox_location"
  | "signature_block"
  | "static_label"
  | "table_boundary"
  | "page_margin"
  | "header_region"
  | "footer_region"
  | "reserved_area";

export type PdfStaticLayoutRegion = {
  id: string;
  page: number;
  kind: PdfStaticLayoutRegionKind;
  rectangle: PdfBoundingRectangle | null;
  confidenceScore: number | null;
  referenceSource: string;
};

export type PdfStaticLayoutAnalysis = {
  document: string;
  version?: string;
  regions: PdfStaticLayoutRegion[];
  analyzedAt: string;
  analyzer: string;
  ocrPerformed: false;
  aiPerformed: false;
  imageComparisonPerformed: false;
};
