import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

import { loadEnvConfig } from "@next/env";

import { fillTemplateWithIntelligence } from "@/lib/empirePdf/intelligentFillEngine";
import { EMPIRE_PDF_QA_SCENARIOS } from "@/lib/empirePdf/qa/scenarios";
import { EMPIRE_PDF_TEMPLATE_REGISTRY } from "@/lib/empirePdf/templates";
import type { EngineDebugField } from "@/lib/empirePdf/templates";

loadEnvConfig(process.cwd());

const OUTPUT_ROOT = path.join(process.cwd(), "output", "pdf", "sbd1-signature-name-suppression-fix");

type SerializedDebugField = {
  fieldKey: string;
  sourceField?: string;
  semanticKey?: string;
  matchedAnchor?: string | null;
  confidence?: number;
  placementMethod?: string;
  resolutionStrategy?: string;
  pageIndex?: number;
  rendered?: boolean;
  fallbackUsed?: boolean;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fieldVersion?: string;
};

function formatNumber(value: number | undefined): string {
  return typeof value === "number" ? value.toFixed(2) : "";
}

function serializeAfterField(field: EngineDebugField): SerializedDebugField {
  return {
    fieldKey: field.fieldKey,
    sourceField: field.sourceField,
    semanticKey: field.semanticAliasUsed,
    matchedAnchor: field.matchedAnchor?.sourceText ?? null,
    confidence: field.confidence,
    placementMethod: field.boundingBox ? "calibrated_box" : field.resolutionStrategy,
    resolutionStrategy: field.resolutionStrategy,
    pageIndex: field.pageIndex,
    rendered: field.rendered,
    fallbackUsed: field.fallbackUsed,
    x: field.x,
    y: field.y,
    width: field.width,
    height: field.height,
    fieldVersion: field.fieldVersion,
  };
}

function buildCalibratedFieldComparison(beforeFields: SerializedDebugField[], afterFields: SerializedDebugField[]) {
  const afterByKey = new Map(afterFields.map((field) => [field.fieldKey, field]));
  return beforeFields
    .filter((field) => field.placementMethod === "calibrated_box")
    .map((before) => {
      const after = afterByKey.get(before.fieldKey);
      const unchanged =
        Boolean(after) &&
        before.rendered === after.rendered &&
        before.x === after.x &&
        before.y === after.y &&
        before.width === after.width &&
        before.height === after.height &&
        before.resolutionStrategy === after.resolutionStrategy;

      return {
        fieldKey: before.fieldKey,
        before,
        after,
        unchanged,
      };
    });
}

function buildReport(params: {
  beforeSignature: SerializedDebugField | undefined;
  afterSignature: SerializedDebugField | undefined;
  calibratedComparison: ReturnType<typeof buildCalibratedFieldComparison>;
}) {
  const unchangedCount = params.calibratedComparison.filter((field) => field.unchanged).length;
  const changedFields = params.calibratedComparison.filter((field) => !field.unchanged);
  const lines = [
    "# SBD1 Signature Name Suppression Fix Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Fix Applied",
    "",
    "`SBD1.signature_name` is now suppressed in the intelligent fill path when all of the following are true:",
    "",
    "- No calibrated `signature_name` bounding box exists.",
    "- No high-confidence signature-specific anchor exists.",
    "- No template metadata explicitly declares a valid signature section for the field.",
    "",
    "The guard is scoped to `SBD1.signature_name` only. It does not apply to SBD4 or other templates.",
    "",
    "## Before",
    "",
    params.beforeSignature
      ? `Before trace: \`${params.beforeSignature.fieldKey}\` rendered=${params.beforeSignature.rendered}, source=${params.beforeSignature.sourceField}, anchor=${params.beforeSignature.matchedAnchor}, strategy=${params.beforeSignature.resolutionStrategy}, x=${formatNumber(params.beforeSignature.x)}, y=${formatNumber(params.beforeSignature.y)}.`
      : "Before trace: `SBD1.signature_name` was not found in the baseline QA report.",
    "",
    "## After",
    "",
    params.afterSignature
      ? `After trace: \`${params.afterSignature.fieldKey}\` rendered=${params.afterSignature.rendered}, source=${params.afterSignature.sourceField}, anchor=${params.afterSignature.matchedAnchor}, strategy=${params.afterSignature.resolutionStrategy}, x=${formatNumber(params.afterSignature.x)}, y=${formatNumber(params.afterSignature.y)}.`
      : "After trace: `SBD1.signature_name` was not returned by the render engine.",
    "",
    "## Verification",
    "",
    `- Nomsa Dlamini removed from SBD1 supplier-information rendering: ${
      params.afterSignature?.rendered === false && params.afterSignature.sourceField === "contractor.directorName"
        ? "yes"
        : "needs review"
    }`,
    `- Existing calibrated fields unchanged: ${changedFields.length === 0 ? "yes" : "no"}`,
    `- Calibrated fields compared: ${params.calibratedComparison.length}`,
    `- Calibrated fields unchanged: ${unchangedCount}`,
  ];

  if (changedFields.length > 0) {
    lines.push(
      "",
      "## Changed Calibrated Fields",
      "",
      "| Field | Before X | Before Y | After X | After Y |",
      "| --- | ---: | ---: | ---: | ---: |"
    );

    for (const field of changedFields) {
      lines.push(
        `| \`${field.fieldKey}\` | ${formatNumber(field.before.x)} | ${formatNumber(field.before.y)} | ${formatNumber(
          field.after?.x
        )} | ${formatNumber(field.after?.y)} |`
      );
    }
  }

  lines.push(
    "",
    "## Generated Artifacts",
    "",
    "- `before.pdf`",
    "- `after.pdf`",
    "- `root-cause-fix-report.md`",
    "",
    "## Notes",
    "",
    "No calibration overrides, SBD4 files, coordinates, or bounding-box definitions were modified."
  );

  return `${lines.join("\n")}\n`;
}

async function main() {
  const template = EMPIRE_PDF_TEMPLATE_REGISTRY.sbd1;
  if (!template) {
    throw new Error("SBD1 template is not registered");
  }

  await mkdir(OUTPUT_ROOT, { recursive: true });

  const templateBytes = await readFile(path.join(process.cwd(), template.pdfRelativePath));
  const beforeResult = await fillTemplateWithIntelligence({
    templateKey: "sbd1",
    templateBytes: Uint8Array.from(templateBytes),
    profile: EMPIRE_PDF_QA_SCENARIOS[0].profile,
    debugBoundingBoxes: false,
    suppressSbd1SignatureName: false,
  });
  const afterResult = await fillTemplateWithIntelligence({
    templateKey: "sbd1",
    templateBytes: Uint8Array.from(templateBytes),
    profile: EMPIRE_PDF_QA_SCENARIOS[0].profile,
    debugBoundingBoxes: false,
  });

  await writeFile(path.join(OUTPUT_ROOT, "before.pdf"), Buffer.from(beforeResult.pdfBytes));
  await writeFile(path.join(OUTPUT_ROOT, "after.pdf"), Buffer.from(afterResult.pdfBytes));
  await writeFile(
    path.join(OUTPUT_ROOT, "before-debug-fields.json"),
    `${JSON.stringify(beforeResult.result.debugFields, null, 2)}\n`
  );
  await writeFile(
    path.join(OUTPUT_ROOT, "after-debug-fields.json"),
    `${JSON.stringify(afterResult.result.debugFields, null, 2)}\n`
  );

  const beforeFields = beforeResult.result.debugFields.map(serializeAfterField);
  const afterFields = afterResult.result.debugFields.map(serializeAfterField);
  const beforeSignature = beforeFields.find((field) => field.fieldKey === "SBD1.signature_name");
  const afterSignature = afterFields.find((field) => field.fieldKey === "SBD1.signature_name");
  const calibratedComparison = buildCalibratedFieldComparison(beforeFields, afterFields);

  await writeFile(
    path.join(OUTPUT_ROOT, "root-cause-fix-report.md"),
    buildReport({ beforeSignature, afterSignature, calibratedComparison })
  );

  console.log("[sbd1-signature-suppression] generated artifacts", {
    outputRoot: OUTPUT_ROOT,
    beforeSignature,
    afterSignature,
    calibratedFieldsCompared: calibratedComparison.length,
    changedCalibratedFields: calibratedComparison.filter((field) => !field.unchanged).map((field) => field.fieldKey),
  });
}

main()
  .catch((error) => {
    console.error("[sbd1-signature-suppression] failed", error);
    process.exitCode = 1;
  })
  .finally(() => {
    setTimeout(() => process.exit(process.exitCode ?? 0), 50);
  });
