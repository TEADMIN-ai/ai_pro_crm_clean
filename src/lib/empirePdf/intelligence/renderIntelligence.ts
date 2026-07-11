import fs from "fs";
import path from "path";

import { EMPIRE_PDF_TEMPLATE_REGISTRY, type EmpirePdfTemplateDefinition, type TenderFormId } from "../templates";
import type { SbdFormKey } from "@/lib/pdfs/templates/sbdSchema";
import { JsonFieldRegistry, parseJsonFieldMap } from "./jsonFieldRegistry";
import { PdfIntelligencePipeline } from "./pipeline";
import { classifyDocumentReadiness } from "./readiness";
import {
  EmpirePdfFieldRegistry,
  StaticBusinessDataRegistry,
  templateFieldToMetadata,
  type FieldRegistry,
} from "./registries";
import {
  DEFAULT_PDF_REFERENCE_LIBRARY,
  resolveReferenceFolder,
} from "./referenceLibrary";
import { createReferenceDescriptor } from "./referenceDocumentLoader";
import { validateReferenceDocumentSet } from "./referenceValidator";
import { buildValidationReport, summarizeValidationReport } from "./validationReport";
import type {
  JsonFieldMapDocument,
  PdfBusinessFieldValue,
  PdfDocumentReadiness,
  PdfLayoutPlan,
  PdfReferenceDocumentDescriptor,
  PdfReferenceDocumentSet,
  PdfReferenceMetadata,
  PdfValidationIssue,
  PdfValidationReport,
  PdfValidationReportSummary,
} from "./types";
import type { EngineDebugField } from "../templates";

type FolderLoadResult = {
  role: string;
  path: string | null;
  exists: boolean;
  files: string[];
};

export type PdfReferenceLibraryLoadResult = {
  rootPath: string;
  folders: FolderLoadResult[];
  documentSet: PdfReferenceDocumentSet;
  loadedReferences: PdfReferenceDocumentDescriptor[];
  validation: PdfValidationReport;
  referenceMetadata: PdfReferenceMetadata;
  fieldMaps: JsonFieldMapDocument[];
};

export type PdfRenderQualityReport = {
  document: TenderFormId;
  templateVersion: string | null;
  renderedFieldCount: number;
  expectedFieldCount: number;
  missingFieldCount: number;
  validationWarningCount: number;
  validationErrorCount: number;
  overflowEvents: number;
  clippingEvents: number;
  fallbackRenderCount: number;
  calibratedFieldCount: number;
  placementAccuracy: number;
  calibrationConfidence: number;
};

type CalibrationQaReportLike = {
  placementAccuracy: number;
  overflowEvents: number;
  clippingEvents: number;
  missingFields: number;
  calibrationConfidence: number;
  renderedFieldCount: number;
  calibratedFieldCount: number;
};

export type PdfRendererIntelligenceReport = {
  document: TenderFormId;
  templateKey: SbdFormKey;
  templateVersion: string | null;
  readinessScore: number;
  readiness: PdfDocumentReadiness;
  confidenceScore: number;
  missingFields: PdfValidationIssue[];
  validationWarnings: PdfValidationIssue[];
  validationErrors: PdfValidationIssue[];
  validationReport: PdfValidationReport;
  validationSummary: PdfValidationReportSummary;
  renderQuality: PdfRenderQualityReport;
  referenceLibrary: PdfReferenceLibraryLoadResult;
};

class CompositeFieldRegistry implements FieldRegistry {
  constructor(private readonly registries: FieldRegistry[]) {}

  getField(formId: TenderFormId, fieldId: string) {
    for (const registry of this.registries) {
      const field = registry.getField(formId, fieldId);
      if (field) {
        return field;
      }
    }

    return null;
  }
}

class TemplateFallbackFieldRegistry implements FieldRegistry {
  constructor(private readonly template: EmpirePdfTemplateDefinition) {}

  getField(formId: TenderFormId, fieldId: string) {
    if (formId !== this.template.formId) {
      return null;
    }

    const field = this.template.fields.find((candidate) => candidate.fieldId === fieldId);
    return field ? templateFieldToMetadata(field) : null;
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function toScore(value: number): number {
  return Math.round(clamp01(value) * 100);
}

function safeReadDirectory(folderPath: string | null): string[] {
  if (!folderPath || !fs.existsSync(folderPath)) {
    return [];
  }

  return fs
    .readdirSync(folderPath, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

function findReferenceFile(files: string[], formId: TenderFormId): string | null {
  const normalizedFormId = formId.toUpperCase();
  return files.find((file) => file.toUpperCase().startsWith(normalizedFormId)) ?? null;
}

export function loadPdfReferenceLibrary(formId: TenderFormId, requestedVersion?: string): PdfReferenceLibraryLoadResult {
  const rootPath = path.join(process.cwd(), DEFAULT_PDF_REFERENCE_LIBRARY.rootRelativePath);
  const referenceVersion = "reference-standards-v1"
  const folders = DEFAULT_PDF_REFERENCE_LIBRARY.folders.map((folder) => {
    const folderPath = resolveReferenceFolder(DEFAULT_PDF_REFERENCE_LIBRARY, folder.role);
    return {
      role: folder.role,
      path: folderPath,
      exists: Boolean(folderPath && fs.existsSync(folderPath)),
      files: safeReadDirectory(folderPath),
    };
  });

  const blankFolder = folders.find((folder) => folder.role === "blank_forms");
  const approvedFolder = folders.find((folder) => folder.role === "approved_completed");
  const blankFile = findReferenceFile(blankFolder?.files ?? [], formId);
  const approvedFile = findReferenceFile(approvedFolder?.files ?? [], formId);
  const fieldMapCount = folders
    .filter(function(folder) { return ["field_maps", "json"].includes(folder.role) })
    .reduce(function(sum, folder) {
      return sum + folder.files.filter(function(file) { return file.toLowerCase().endsWith(".json") }).length
    }, 0);
  const referenceMetadata: PdfReferenceMetadata = {
    documentName: formId,
    version: referenceVersion,
    referenceStatus: approvedFile ? "approved_reference_captured" : blankFile ? "blank_captured" : "not_captured",
    source: "inferred",
    matchedVersion: requestedVersion ? requestedVersion === referenceVersion : true,
    availableVersions: [referenceVersion],
    fieldMapCount,
    assetCount: [blankFile, approvedFile].filter(Boolean).length,
  };
  const documentSet: PdfReferenceDocumentSet = {
    documentName: formId,
    version: referenceVersion,
    blankPdf: blankFile
      ? createReferenceDescriptor({
          documentName: formId,
          version: referenceVersion,
          kind: "blank_pdf",
          relativePath: path.join("Blank Forms", blankFile),
          status: "blank_captured",
        })
      : undefined,
    approvedPdf: approvedFile
      ? createReferenceDescriptor({
          documentName: formId,
          version: referenceVersion,
          kind: "approved_pdf",
          relativePath: path.join("Approved Completed", approvedFile),
          status: "approved_reference_captured",
        })
      : undefined,
  };

  const folderIssues: PdfValidationIssue[] = folders
    .filter((folder) => {
      const spec = DEFAULT_PDF_REFERENCE_LIBRARY.folders.find((item) => item.role === folder.role);
      return spec?.required && !folder.exists;
    })
    .map((folder) => ({
      code: "missing_mandatory_value",
      severity: "warning",
      message: `Required reference folder is missing: ${folder.role}`,
      confidenceImpact: 0.04,
    }));
  const referenceValidation = validateReferenceDocumentSet(documentSet, referenceMetadata, requestedVersion);
  const validation =
    folderIssues.length > 0
      ? buildValidationReport({
          documentName: formId,
          documentVersion: documentSet.version,
          referenceMetadata,
          issues: [...referenceValidation.issues, ...folderIssues],
          confidenceScore: Math.max(
            0,
            referenceValidation.confidenceScore -
              folderIssues.reduce((sum, issue) => sum + issue.confidenceImpact, 0)
          ),
        })
      : referenceValidation;

  return {
    rootPath,
    folders,
    documentSet,
    loadedReferences: [documentSet.blankPdf, documentSet.approvedPdf].filter(
      (descriptor): descriptor is PdfReferenceDocumentDescriptor => Boolean(descriptor)
    ),
    validation,
    referenceMetadata,
    fieldMaps: [],
  };
}

function loadJsonFieldMaps(): JsonFieldMapDocument[] {
  const fieldMapFolder = path.join(process.cwd(), "src", "lib", "empirePdf", "intelligence", "fieldMaps");
  if (!fs.existsSync(fieldMapFolder)) {
    return [];
  }

  return fs
    .readdirSync(fieldMapFolder)
    .filter((file) => file.endsWith(".json"))
    .map((file) => {
      const raw = fs.readFileSync(path.join(fieldMapFolder, file), "utf8");
      return parseJsonFieldMap(JSON.parse(raw));
    });
}

function buildBusinessValues(debugFields: EngineDebugField[]): PdfBusinessFieldValue[] {
  return debugFields.map((field) => ({
    fieldName: field.fieldId,
    value: field.value,
    source: field.sourceField || field.source,
    confidenceScore: clamp01(field.confidence),
  }));
}

function buildFieldRegistry(template: EmpirePdfTemplateDefinition): FieldRegistry {
  return new CompositeFieldRegistry([
    new JsonFieldRegistry(loadJsonFieldMaps()),
    new EmpirePdfFieldRegistry(),
    new TemplateFallbackFieldRegistry(template),
  ]);
}

function mergeValidationReports(params: {
  documentName: TenderFormId;
  documentVersion: string | null;
  reports: PdfValidationReport[];
}): PdfValidationReport {
  const issues = params.reports.flatMap((report) => report.issues);
  const confidenceScores = params.reports.map((report) => report.confidenceScore);
  const averageConfidence =
    confidenceScores.length > 0
      ? confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length
      : 0;
  const issuePenalty = Math.min(0.45, issues.reduce((sum, issue) => sum + issue.confidenceImpact, 0));
  const confidenceScore = Math.min(averageConfidence, 1 - issuePenalty);
  const referenceMetadata = params.reports.find((report) => report.referenceMetadata)?.referenceMetadata;

  return buildValidationReport({
    documentName: params.documentName,
    documentVersion: params.documentVersion ?? undefined,
    referenceMetadata,
    issues,
    confidenceScore: clamp01(confidenceScore),
  });
}

function buildRenderQualityReport(params: {
  template: EmpirePdfTemplateDefinition;
  debugFields: EngineDebugField[];
  validationReport: PdfValidationReport;
  qaReport?: {
    placementAccuracy: number;
    overflowEvents: number;
    clippingEvents: number;
    missingFields: number;
    calibrationConfidence: number;
    renderedFieldCount: number;
    calibratedFieldCount: number;
  };
}): PdfRenderQualityReport {
  const fallbackRenderCount = params.debugFields.filter((field) => field.fallbackUsed).length;
  const validationWarnings = params.validationReport.warnings ?? [];
  const validationErrors = params.validationReport.errors ?? [];

  return {
    document: params.template.formId,
    templateVersion: params.template.templateVersion ?? null,
    renderedFieldCount: params.qaReport?.renderedFieldCount ?? params.debugFields.filter((field) => field.rendered).length,
    expectedFieldCount: params.template.fields.length,
    missingFieldCount:
      params.qaReport?.missingFields ??
      params.debugFields.filter((field) => !field.rendered && field.criticality !== "optional").length,
    validationWarningCount: validationWarnings.length,
    validationErrorCount: validationErrors.length,
    overflowEvents: params.qaReport?.overflowEvents ?? params.debugFields.filter((field) => field.overflowDetected).length,
    clippingEvents: params.qaReport?.clippingEvents ?? params.debugFields.filter((field) => field.clippingRisk).length,
    fallbackRenderCount,
    calibratedFieldCount:
      params.qaReport?.calibratedFieldCount ?? params.debugFields.filter((field) => Boolean(field.boundingBox)).length,
    placementAccuracy: params.qaReport?.placementAccuracy ?? 0,
    calibrationConfidence: params.qaReport?.calibrationConfidence ?? toScore(params.validationReport.confidenceScore),
  };
}

function addRendererIssues(plans: PdfLayoutPlan[], debugFields: EngineDebugField[]): PdfValidationIssue[] {
  const issues: PdfValidationIssue[] = [];
  const planByField = new Map(plans.map((plan) => [plan.field.fieldName, plan]));

  for (const debugField of debugFields) {
    const plan = planByField.get(debugField.fieldId);
    if (!plan) {
      issues.push({
        code: "unknown_field",
        severity: "warning",
        fieldName: debugField.fieldId,
        message: `No registry metadata was resolved for rendered field ${debugField.fieldKey}`,
        confidenceImpact: 0.04,
      });
    }

    for (const warning of debugField.validationWarnings ?? []) {
      issues.push({
        code: warning.includes("Overflow") ? "text_overflow" : "alignment_warning",
        severity: "warning",
        fieldName: debugField.fieldId,
        message: warning,
        confidenceImpact: 0.03,
      });
    }
  }

  return issues;
}

export function buildRendererIntelligenceReport(params: {
  templateKey: SbdFormKey;
  debugFields: EngineDebugField[];
  qaReport?: CalibrationQaReportLike;
}): PdfRendererIntelligenceReport {
  const template = EMPIRE_PDF_TEMPLATE_REGISTRY[params.templateKey];
  if (!template) {
    throw new Error(`No intelligent template registered for '${params.templateKey}'`);
  }

  const referenceLibrary = loadPdfReferenceLibrary(template.formId, template.templateVersion);
  const pipeline = new PdfIntelligencePipeline(
    buildFieldRegistry(template),
    new StaticBusinessDataRegistry(buildBusinessValues(params.debugFields))
  );
  const pipelineResult = pipeline.plan({
    formId: template.formId,
    fieldIds: template.fields.map((field) => field.fieldId),
  });
  const rendererIssues = addRendererIssues(pipelineResult.plans, params.debugFields);
  const validationReport = mergeValidationReports({
    documentName: template.formId,
    documentVersion: template.templateVersion ?? null,
    reports: [
      pipelineResult.validation,
      referenceLibrary.validation,
      buildValidationReport({
        documentName: template.formId,
        documentVersion: template.templateVersion,
        issues: rendererIssues,
        confidenceScore: Math.max(0, 1 - rendererIssues.reduce((sum, issue) => sum + issue.confidenceImpact, 0)),
      }),
    ],
  });
  const validationSummary = summarizeValidationReport(validationReport);
  const readiness = classifyDocumentReadiness(validationReport);

  return {
    document: template.formId,
    templateKey: params.templateKey,
    templateVersion: template.templateVersion ?? null,
    readinessScore: toScore(validationReport.confidenceScore),
    readiness,
    confidenceScore: toScore(validationReport.confidenceScore),
    missingFields: validationSummary.missingFields,
    validationWarnings: validationSummary.warnings,
    validationErrors: validationSummary.errors,
    validationReport,
    validationSummary,
    renderQuality: buildRenderQualityReport({
      template,
      debugFields: params.debugFields,
      validationReport,
      qaReport: params.qaReport,
    }),
    referenceLibrary,
  };
}
