import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";

import { loadEnvConfig } from "@next/env";
import { PDFDocument } from "pdf-lib";

import { getBoundingBoxTemplate } from "@/lib/empirePdf/boundingBoxes";
import { fillTemplateWithIntelligence } from "@/lib/empirePdf/intelligentFillEngine";
import { EMPIRE_PDF_QA_SCENARIOS } from "@/lib/empirePdf/qa/scenarios";
import { compareEmpirePdfVisualLayout, type EmpirePdfVisualRegressionReport } from "@/lib/empirePdf/qa/visualRegression";
import { EMPIRE_PDF_TEMPLATE_REGISTRY } from "@/lib/empirePdf/templates";
import type { EngineDebugField, IntelligentFillResult, SemanticValueKey } from "@/lib/empirePdf/templates";

loadEnvConfig(process.cwd());

type QaTemplateKey = "sbd1" | "sbd4";

type QaTemplateResult = {
  templateKey: QaTemplateKey;
  formId: string;
  templateVersion: string | null;
  pdfPath: string;
  debugPdfPath: string;
  warningCount: number;
  warnings: string[];
  averageConfidence: number;
  renderedFieldCount: number;
  qaReport: IntelligentFillResult["qaReport"];
  visualRegression: EmpirePdfVisualRegressionReport;
  debugFields: Array<{
    fieldKey: string;
    sourceField: string;
    semanticKey: string | null;
    matchedAnchor: string | null;
    confidence: number;
    placementMethod: string;
    resolutionStrategy: string;
    pageIndex: number;
    rendered: boolean;
    fallbackUsed: boolean;
    overflowDetected: boolean;
    clippingRisk: boolean;
    multilineOverflowDetected: boolean;
    validationWarnings: string[];
    x: number;
    y: number;
    width: number | null;
    height: number | null;
    renderedBounds: EngineDebugField["renderedBounds"] | null;
    boundingBox: EngineDebugField["boundingBox"] | null;
    fontSize: number;
    lineHeight: number | null;
    fieldVersion: string | null;
  }>;
};

type QaScenarioResult = {
  scenarioId: string;
  label: string;
  purpose: string;
  packPdfPath: string;
  packDebugPdfPath: string;
  templates: QaTemplateResult[];
};

const OUTPUT_ROOT = path.join(process.cwd(), "output", "pdf", "empirepdf-qa");
const TMP_ROOT = path.join(process.cwd(), "tmp", "pdfs", "empirepdf-qa");

function toWindowsRelativePath(targetPath: string) {
  return path.relative(OUTPUT_ROOT, targetPath).replace(/\\/g, "/");
}

async function ensureCleanDir(targetPath: string) {
  await rm(targetPath, { recursive: true, force: true });
  await mkdir(targetPath, { recursive: true });
}

async function mergePdfBuffers(buffers: Uint8Array[]) {
  const merged = await PDFDocument.create();

  for (const buffer of buffers) {
    const source = await PDFDocument.load(buffer);
    const pages = await merged.copyPages(source, source.getPageIndices());
    pages.forEach((page) => merged.addPage(page));
  }

  return merged.save();
}

function toPlacementMethod(field: EngineDebugField): string {
  if (field.resolutionStrategy === "bounding_box_anchor" || field.resolutionStrategy === "checkbox_bounding_box") {
    return "calibrated_box";
  }

  if (field.resolutionStrategy === "placement_anchor" || field.resolutionStrategy === "checkbox_anchor") {
    return "placement_anchor";
  }

  if (field.resolutionStrategy === "placement_fallback" || field.resolutionStrategy === "checkbox_fallback") {
    return "fallback_anchor";
  }

  return field.resolutionStrategy;
}

function serializeDebugField(field: EngineDebugField, semanticKey: SemanticValueKey | null) {
  return {
    fieldKey: field.fieldKey,
    sourceField: field.sourceField,
    semanticKey,
    matchedAnchor: field.matchedAnchor?.sourceText ?? null,
    confidence: field.confidence,
    placementMethod: toPlacementMethod(field),
    resolutionStrategy: field.resolutionStrategy,
    pageIndex: field.pageIndex,
    rendered: field.rendered,
    fallbackUsed: field.fallbackUsed,
    overflowDetected: field.overflowDetected,
    clippingRisk: field.clippingRisk,
    multilineOverflowDetected: field.multilineOverflowDetected,
    validationWarnings: field.validationWarnings ?? [],
    x: field.x,
    y: field.y,
    width: field.width ?? null,
    height: field.height ?? null,
    renderedBounds: field.renderedBounds ?? null,
    boundingBox: field.boundingBox ?? null,
    fontSize: field.fontSize,
    lineHeight: field.lineHeight ?? null,
    fieldVersion: field.fieldVersion ?? null,
  };
}

function buildAlignmentReview(results: QaScenarioResult[]) {
  const alignmentMap = new Map<
    string,
    {
      fieldKey: string;
      pages: Set<number>;
      x: number[];
      y: number[];
      overflowCount: number;
      fallbackCount: number;
      scenarios: string[];
    }
  >();

  for (const scenario of results) {
    for (const template of scenario.templates) {
      for (const field of template.debugFields.filter((entry) => entry.rendered)) {
        const current =
          alignmentMap.get(field.fieldKey) ??
          {
            fieldKey: field.fieldKey,
            pages: new Set<number>(),
            x: [],
            y: [],
            overflowCount: 0,
            fallbackCount: 0,
            scenarios: [],
          };

        current.pages.add(field.pageIndex + 1);
        current.x.push(field.x);
        current.y.push(field.y);
        current.overflowCount += field.overflowDetected ? 1 : 0;
        current.fallbackCount += field.fallbackUsed ? 1 : 0;
        current.scenarios.push(scenario.scenarioId);
        alignmentMap.set(field.fieldKey, current);
      }
    }
  }

  return Array.from(alignmentMap.values())
    .map((entry) => ({
      fieldKey: entry.fieldKey,
      pageNumbers: Array.from(entry.pages).sort((left, right) => left - right),
      xSpread: Number((Math.max(...entry.x) - Math.min(...entry.x)).toFixed(2)),
      ySpread: Number((Math.max(...entry.y) - Math.min(...entry.y)).toFixed(2)),
      overflowCount: entry.overflowCount,
      fallbackCount: entry.fallbackCount,
      scenarioCount: entry.scenarios.length,
    }))
    .sort((left, right) => left.fieldKey.localeCompare(right.fieldKey));
}

function buildCoverageSummary(results: QaScenarioResult[]) {
  const templates: QaTemplateKey[] = ["sbd1", "sbd4"];

  return templates.map((templateKey) => {
    const template = EMPIRE_PDF_TEMPLATE_REGISTRY[templateKey];
    const boundingTemplate = template ? getBoundingBoxTemplate(template.formId) : null;
    const fieldIds = Object.keys(boundingTemplate?.fields ?? {});

    const coverage = fieldIds.map((fieldId) => {
      const fieldKey = `${template?.formId}.${fieldId}`;
      const matches = results.flatMap((scenario) =>
        scenario.templates
          .filter((entry) => entry.templateKey === templateKey)
          .flatMap((entry) => entry.debugFields.filter((field) => field.fieldKey === fieldKey))
      );

      return {
        fieldKey,
        renderedCount: matches.filter((field) => field.rendered).length,
        overflowCount: matches.filter((field) => field.overflowDetected).length,
        fallbackCount: matches.filter((field) => field.fallbackUsed).length,
        validationWarningCount: matches.reduce((sum, field) => sum + field.validationWarnings.length, 0),
      };
    });

    return {
      templateKey,
      formId: template?.formId ?? null,
      templateVersion: template?.templateVersion ?? null,
      calibratedFieldCount: fieldIds.length,
      coverage,
    };
  });
}

function buildDocumentQaSummary(results: QaScenarioResult[]) {
  return results.flatMap((scenario) =>
    scenario.templates.map((template) => ({
      scenarioId: scenario.scenarioId,
      document: template.formId,
      qaReport: template.qaReport,
      driftScore: template.visualRegression.driftScore,
      driftEventCount: template.visualRegression.driftEvents.length,
    }))
  );
}

function buildMarkdownReport(results: QaScenarioResult[]) {
  const alignment = buildAlignmentReview(results);
  const coverage = buildCoverageSummary(results);
  const totalWarnings = results.reduce(
    (sum, scenario) => sum + scenario.templates.reduce((templateSum, template) => templateSum + template.warningCount, 0),
    0
  );

  const lines: string[] = [
    "# EmpirePDF Visual Calibration & Human QA",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Scenarios: ${results.length}`,
    `Total renderer warnings: ${totalWarnings}`,
    "",
    "## Scenario Outputs",
  ];

  for (const scenario of results) {
    lines.push("");
    lines.push(`### ${scenario.label}`);
    lines.push(`- Scenario ID: \`${scenario.scenarioId}\``);
    lines.push(`- Purpose: ${scenario.purpose}`);
    lines.push(`- Pack: [${path.basename(scenario.packPdfPath)}](./${toWindowsRelativePath(scenario.packPdfPath)})`);
    lines.push(
      `- Debug Pack: [${path.basename(scenario.packDebugPdfPath)}](./${toWindowsRelativePath(scenario.packDebugPdfPath)})`
    );

    for (const template of scenario.templates) {
      lines.push(
        `- ${template.formId}: warnings=${template.warningCount}, rendered=${template.renderedFieldCount}, confidence=${template.averageConfidence.toFixed(
          2
        )}, placement=${template.qaReport?.placementAccuracy ?? 0}, drift=${template.visualRegression.driftScore}`
      );
      lines.push(`  normal: [${path.basename(template.pdfPath)}](./${toWindowsRelativePath(template.pdfPath)})`);
      lines.push(`  debug: [${path.basename(template.debugPdfPath)}](./${toWindowsRelativePath(template.debugPdfPath)})`);
    }
  }

  lines.push("");
  lines.push("## Calibration QA Scores");
  lines.push("");
  lines.push("| Scenario | Document | Placement | Overflow | Checkbox Issues | Missing | Confidence | Drift |");
  lines.push("| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const item of buildDocumentQaSummary(results)) {
    lines.push(
      `| \`${item.scenarioId}\` | ${item.document} | ${item.qaReport?.placementAccuracy ?? 0} | ${
        item.qaReport?.overflowEvents ?? 0
      } | ${item.qaReport?.checkboxAlignmentIssues ?? 0} | ${item.qaReport?.missingFields ?? 0} | ${
        item.qaReport?.calibrationConfidence ?? 0
      } | ${item.driftScore} |`
    );
  }

  lines.push("");
  lines.push("## Alignment Review");
  lines.push("");
  lines.push("| Field | Pages | X Spread | Y Spread | Overflow | Fallback |");
  lines.push("| --- | --- | ---: | ---: | ---: | ---: |");
  for (const field of alignment) {
    lines.push(
      `| \`${field.fieldKey}\` | ${field.pageNumbers.join(", ")} | ${field.xSpread} | ${field.ySpread} | ${field.overflowCount} | ${field.fallbackCount} |`
    );
  }

  lines.push("");
  lines.push("## Calibrated Field Coverage");
  for (const template of coverage) {
    lines.push("");
    lines.push(`### ${template.formId} (${template.templateVersion ?? "unknown"})`);
    lines.push("| Field | Rendered | Overflow | Fallback | Validation Warnings |");
    lines.push("| --- | ---: | ---: | ---: | ---: |");
    for (const field of template.coverage) {
      lines.push(
        `| \`${field.fieldKey}\` | ${field.renderedCount} | ${field.overflowCount} | ${field.fallbackCount} | ${field.validationWarningCount} |`
      );
    }
  }

  lines.push("");
  lines.push("## Human QA Checklist");
  lines.push("- Open each `pack.debug.pdf` first and confirm every calibrated field sits inside its red box.");
  lines.push("- Compare `pack.pdf` against `pack.debug.pdf` to confirm debug overlays are the only visual delta.");
  lines.push("- Check long legal names, long postal/street addresses, and long signatory roles for readable scaling rather than drift.");
  lines.push("- Verify foreign-supplier and PTY checkbox states across local and foreign scenarios.");
  lines.push("- Confirm SBD4 signature-name and signature-role alignment across baseline and stress scenarios.");
  lines.push("- Review any field with non-zero overflow or fallback counts before production sign-off.");

  return lines.join("\n");
}

function buildHtmlReport(results: QaScenarioResult[]) {
  const scenarioSections = results
    .map((scenario) => {
  const templateLinks = scenario.templates
        .map(
          (template) => `
          <li>
            <strong>${template.formId}</strong>
            <span>warnings=${template.warningCount}, rendered=${template.renderedFieldCount}, confidence=${template.averageConfidence.toFixed(
              2
            )}, placement=${template.qaReport?.placementAccuracy ?? 0}, drift=${template.visualRegression.driftScore}</span>
            <div><a href="./${toWindowsRelativePath(template.pdfPath)}">Normal PDF</a></div>
            <div><a href="./${toWindowsRelativePath(template.debugPdfPath)}">Debug PDF</a></div>
          </li>`
        )
        .join("");

      return `
        <section class="scenario">
          <h2>${scenario.label}</h2>
          <p>${scenario.purpose}</p>
          <div class="links">
            <a href="./${toWindowsRelativePath(scenario.packPdfPath)}">Open Pack PDF</a>
            <a href="./${toWindowsRelativePath(scenario.packDebugPdfPath)}">Open Debug Pack PDF</a>
          </div>
          <ul>${templateLinks}</ul>
          <div class="frame-grid">
            <iframe title="${scenario.label} debug pack" src="./${toWindowsRelativePath(scenario.packDebugPdfPath)}"></iframe>
            <iframe title="${scenario.label} normal pack" src="./${toWindowsRelativePath(scenario.packPdfPath)}"></iframe>
          </div>
        </section>
      `;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>EmpirePDF Visual Calibration QA</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f4f0e8;
        --panel: #fffdf8;
        --ink: #1d2b36;
        --muted: #6b7783;
        --line: #d9d0c4;
        --accent: #0d5c63;
      }
      body {
        margin: 0;
        padding: 32px;
        font-family: Georgia, "Times New Roman", serif;
        background: radial-gradient(circle at top, #fbf7ef 0, var(--bg) 62%);
        color: var(--ink);
      }
      main {
        max-width: 1200px;
        margin: 0 auto;
      }
      h1, h2 {
        letter-spacing: 0.02em;
      }
      .scenario {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 20px;
        margin-bottom: 24px;
        box-shadow: 0 10px 30px rgba(29, 43, 54, 0.08);
      }
      .links {
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
        margin: 12px 0;
      }
      a {
        color: var(--accent);
        text-decoration: none;
        font-weight: 600;
      }
      ul {
        padding-left: 20px;
      }
      li {
        margin-bottom: 10px;
      }
      li span {
        color: var(--muted);
        margin-left: 8px;
      }
      .frame-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        gap: 16px;
        margin-top: 18px;
      }
      iframe {
        width: 100%;
        min-height: 720px;
        border: 1px solid var(--line);
        border-radius: 12px;
        background: white;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>EmpirePDF Visual Calibration & Human QA</h1>
      <p>Use the debug packs to inspect every calibrated field against its bounding box, then compare with the clean packs for final polish.</p>
      ${scenarioSections}
    </main>
  </body>
</html>`;
}

async function renderTemplateScenario(params: {
  scenarioDir: string;
  scenarioId: string;
  templateKey: QaTemplateKey;
  profile: (typeof EMPIRE_PDF_QA_SCENARIOS)[number]["profile"];
}): Promise<QaTemplateResult> {
  const template = EMPIRE_PDF_TEMPLATE_REGISTRY[params.templateKey];
  if (!template) {
    throw new Error(`Template '${params.templateKey}' is not registered in EmpirePDF`);
  }

  const templatePath = path.join(process.cwd(), template.pdfRelativePath);
  const templateBytes = await readFile(templatePath);
  const normalTemplateBytes = Uint8Array.from(templateBytes);
  const debugTemplateBytes = Uint8Array.from(templateBytes);

  const normalResult = await fillTemplateWithIntelligence({
    templateKey: params.templateKey,
    templateBytes: normalTemplateBytes,
    profile: params.profile,
    debugBoundingBoxes: false,
  });

  const debugResult = await fillTemplateWithIntelligence({
    templateKey: params.templateKey,
    templateBytes: debugTemplateBytes,
    profile: params.profile,
    debugBoundingBoxes: true,
  });

  const pdfPath = path.join(params.scenarioDir, `${params.templateKey}.pdf`);
  const debugPdfPath = path.join(params.scenarioDir, `${params.templateKey}.debug.pdf`);

  await writeFile(pdfPath, Buffer.from(normalResult.pdfBytes));
  await writeFile(debugPdfPath, Buffer.from(debugResult.pdfBytes));
  const visualRegression = compareEmpirePdfVisualLayout({
    baseline: normalResult.result.debugFields,
    candidate: debugResult.result.debugFields,
  });

  return {
    templateKey: params.templateKey,
    formId: template.formId,
    templateVersion: template.templateVersion ?? null,
    pdfPath,
    debugPdfPath,
    warningCount: debugResult.result.warnings.length,
    warnings: debugResult.result.warnings,
    averageConfidence: debugResult.result.averageConfidence,
    renderedFieldCount: debugResult.result.renderedFieldCount,
    qaReport: debugResult.result.qaReport,
    visualRegression,
    debugFields: debugResult.result.debugFields.map((field) =>
      serializeDebugField(
        field,
        template.fields.find((templateField) => templateField.fieldId === field.fieldId)?.semanticKey ?? null
      )
    ),
  };
}

async function main() {
  await ensureCleanDir(OUTPUT_ROOT);
  await ensureCleanDir(TMP_ROOT);

  const scenarioResults: QaScenarioResult[] = [];

  for (const scenario of EMPIRE_PDF_QA_SCENARIOS) {
    const scenarioDir = path.join(OUTPUT_ROOT, scenario.id);
    await mkdir(scenarioDir, { recursive: true });

    const sbd1 = await renderTemplateScenario({
      scenarioDir,
      scenarioId: scenario.id,
      templateKey: "sbd1",
      profile: scenario.profile,
    });
    const sbd4 = await renderTemplateScenario({
      scenarioDir,
      scenarioId: scenario.id,
      templateKey: "sbd4",
      profile: scenario.profile,
    });

    const packPdfBytes = await mergePdfBuffers([
      await readFile(sbd1.pdfPath),
      await readFile(sbd4.pdfPath),
    ]);
    const packDebugPdfBytes = await mergePdfBuffers([
      await readFile(sbd1.debugPdfPath),
      await readFile(sbd4.debugPdfPath),
    ]);

    const packPdfPath = path.join(scenarioDir, "pack.pdf");
    const packDebugPdfPath = path.join(scenarioDir, "pack.debug.pdf");

    await writeFile(packPdfPath, Buffer.from(packPdfBytes));
    await writeFile(packDebugPdfPath, Buffer.from(packDebugPdfBytes));

    scenarioResults.push({
      scenarioId: scenario.id,
      label: scenario.label,
      purpose: scenario.purpose,
      packPdfPath,
      packDebugPdfPath,
      templates: [sbd1, sbd4],
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    outputRoot: OUTPUT_ROOT,
    scenarios: scenarioResults,
    alignmentReview: buildAlignmentReview(scenarioResults),
    calibratedFieldCoverage: buildCoverageSummary(scenarioResults),
    documentQaSummary: buildDocumentQaSummary(scenarioResults),
  };

  await writeFile(path.join(OUTPUT_ROOT, "qa-report.json"), JSON.stringify(report, null, 2));
  await writeFile(path.join(TMP_ROOT, "qa-report.json"), JSON.stringify(report, null, 2));
  await writeFile(path.join(OUTPUT_ROOT, "qa-report.md"), buildMarkdownReport(scenarioResults));
  await writeFile(path.join(OUTPUT_ROOT, "qa-review.html"), buildHtmlReport(scenarioResults));

  console.log("[empirepdf-qa] generated visual calibration artifacts", {
    outputRoot: OUTPUT_ROOT,
    scenarioCount: scenarioResults.length,
    files: [
      "qa-report.json",
      "qa-report.md",
      "qa-review.html",
    ],
  });
}

main().catch((error) => {
  console.error("[empirepdf-qa] visual calibration failed", error);
  process.exit(1);
});
