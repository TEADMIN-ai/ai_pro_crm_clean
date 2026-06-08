import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";
import { pathToFileURL } from "url";

import { loadEnvConfig } from "@next/env";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { getBoundingBoxField, getBoundingBoxTemplate } from "@/lib/empirePdf/boundingBoxes";
import type { BoundingBoxFieldDefinition } from "@/lib/empirePdf/boundingBoxes";
import { fillTemplateWithIntelligence } from "@/lib/empirePdf/intelligentFillEngine";
import { EMPIRE_PDF_QA_SCENARIOS } from "@/lib/empirePdf/qa/scenarios";
import { EMPIRE_PDF_TEMPLATE_REGISTRY } from "@/lib/empirePdf/templates";
loadEnvConfig(process.cwd());

const OUTPUT_ROOT = path.join(process.cwd(), "output", "pdf", "sbd1-calibration-manual");
const TEMPLATE_KEY = "sbd1";
const FORM_ID = "SBD1";
const NUMBER_FORMAT = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type CalibrationInventoryRow = {
  fieldName: string;
  fieldId: string;
  activeInTemplate: boolean;
  hasBoundingBox: boolean;
  currentX: number | null;
  currentY: number | null;
  width: number | null;
  height: number | null;
  pageNumber: number | null;
};

function formatNumber(value: number | null): string {
  return typeof value === "number" ? NUMBER_FORMAT.format(value) : "";
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildCalibrationRows(): CalibrationInventoryRow[] {
  const template = EMPIRE_PDF_TEMPLATE_REGISTRY[TEMPLATE_KEY];
  const boundingTemplate = getBoundingBoxTemplate(FORM_ID);
  const activeFieldIds = new Set(template.fields.map((field) => field.fieldId));
  const fieldIds = Array.from(new Set([...template.fields.map((field) => field.fieldId), ...Object.keys(boundingTemplate?.fields ?? {})]));

  return fieldIds
    .map((fieldId) => {
      const box = getBoundingBoxField(FORM_ID, fieldId);

      return {
        fieldName: fieldId,
        fieldId,
        activeInTemplate: activeFieldIds.has(fieldId),
        hasBoundingBox: Boolean(box),
        currentX: box?.x ?? null,
        currentY: box?.y ?? null,
        width: box?.width ?? null,
        height: box?.height ?? null,
        pageNumber: box?.pageNumber ?? null,
      };
    })
    .sort((left, right) => {
      if ((left.pageNumber ?? 0) !== (right.pageNumber ?? 0)) {
        return (left.pageNumber ?? 0) - (right.pageNumber ?? 0);
      }

      if ((left.currentY ?? 0) !== (right.currentY ?? 0)) {
        return (right.currentY ?? 0) - (left.currentY ?? 0);
      }

      return left.fieldId.localeCompare(right.fieldId);
    });
}

function buildCsv(rows: CalibrationInventoryRow[]): string {
  const header = ["Field Name", "Current X", "Current Y", "Width", "Height"];
  const lines = [
    header.map(csvCell).join(","),
    ...rows.map((row) =>
      [row.fieldName, formatNumber(row.currentX), formatNumber(row.currentY), formatNumber(row.width), formatNumber(row.height)]
        .map(csvCell)
        .join(",")
    ),
  ];

  return `${lines.join("\n")}\n`;
}

function buildCalibrationMarkdown(rows: CalibrationInventoryRow[]): string {
  const lines = [
    "# SBD1 Manual Calibration Table",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "| Field Name | Current X | Current Y | Width | Height |",
    "| --- | ---: | ---: | ---: | ---: |",
  ];

  for (const row of rows) {
    lines.push(
      `| \`${row.fieldName}\` | ${formatNumber(row.currentX)} | ${formatNumber(row.currentY)} | ${formatNumber(row.width)} | ${formatNumber(row.height)} |`
    );
  }

  return `${lines.join("\n")}\n`;
}

function buildInventoryMarkdown(rows: CalibrationInventoryRow[]): string {
  const lines = [
    "# SBD1 Active Field Inventory",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "| Field ID | Active Template Field | Bounding Box | Page | Current X | Current Y | Width | Height |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];

  for (const row of rows) {
    lines.push(
      `| \`${row.fieldId}\` | ${row.activeInTemplate ? "yes" : "no"} | ${row.hasBoundingBox ? "yes" : "missing"} | ${
        row.pageNumber ?? ""
      } | ${formatNumber(row.currentX)} | ${formatNumber(row.currentY)} | ${formatNumber(row.width)} | ${formatNumber(row.height)} |`
    );
  }

  return `${lines.join("\n")}\n`;
}

function buildRootCauseMarkdown(rows: CalibrationInventoryRow[]): string {
  const missingBoxFields = rows.filter((row) => row.activeInTemplate && !row.hasBoundingBox).map((row) => row.fieldId);

  const lines = [
    "# SBD1 Manual Calibration Root Cause Summary",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "The renderer, validation engine, containment engine, and QA framework can render and report field placement, but the SBD1 visual issue is a manual coordinate calibration problem. Existing coordinate values and automatic deltas do not reliably align every field with the official government form artwork.",
    "",
    "This sprint intentionally made no automatic coordinate corrections and did not estimate new target positions. It exposes the current SBD1 bounding boxes, coordinates, dimensions, and field inventory so a human can compare the overlay against the official form and tune overrides incrementally.",
    "",
    "## Findings",
    `- Active SBD1 fields inventoried: ${rows.filter((row) => row.activeInTemplate).length}`,
    `- Active SBD1 fields with bounding boxes: ${rows.filter((row) => row.activeInTemplate && row.hasBoundingBox).length}`,
    `- Active SBD1 fields missing bounding boxes: ${missingBoxFields.length}`,
  ];

  if (missingBoxFields.length > 0) {
    lines.push(`- Missing bounding boxes: ${missingBoxFields.map((fieldId) => `\`${fieldId}\``).join(", ")}`);
  }

  lines.push(
    "",
    "## Rollback Strategy",
    "- Delete `src/lib/empirePdf/calibrationOverrides/sbd1.ts`.",
    "- Revert the calibration override lookup in `src/lib/empirePdf/boundingBoxes/index.ts`.",
    "- Remove `scripts/sbd1ManualCalibration.ts` and the `pdf:sbd1:calibration` package script.",
    "- Delete `output/pdf/sbd1-calibration-manual/` if generated artifacts are no longer needed."
  );

  return `${lines.join("\n")}\n`;
}

function drawLabel(params: {
  pageWidth: number;
  pageHeight: number;
  page: PDFDocument["getPages"] extends () => Array<infer Page> ? Page : never;
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>;
  box: BoundingBoxFieldDefinition;
}) {
  const { box, font, page, pageHeight, pageWidth } = params;
  const lines = [
    box.fieldId,
    `id=${box.fieldId}`,
    `x=${formatNumber(box.x)}`,
    `y=${formatNumber(box.y)}`,
    `w=${formatNumber(box.width)}`,
    `h=${formatNumber(box.height)}`,
  ];
  const fontSize = 5.5;
  const lineHeight = 6.2;
  const labelWidth = Math.max(...lines.map((line) => font.widthOfTextAtSize(line, fontSize))) + 4;
  const labelHeight = lines.length * lineHeight + 2;
  const preferredX = box.x + box.width + 4;
  const x = preferredX + labelWidth <= pageWidth ? preferredX : Math.max(box.x - labelWidth - 4, 0);
  const y = Math.min(Math.max(box.y + box.height - labelHeight, 2), pageHeight - labelHeight - 2);

  page.drawRectangle({
    x,
    y,
    width: labelWidth,
    height: labelHeight,
    color: rgb(1, 1, 1),
    opacity: 0.82,
    borderColor: rgb(0.05, 0.22, 0.65),
    borderWidth: 0.25,
  });

  lines.forEach((line, index) => {
    page.drawText(line, {
      x: x + 2,
      y: y + labelHeight - 7 - index * lineHeight,
      size: fontSize,
      font,
      color: rgb(0.05, 0.22, 0.65),
    });
  });
}

async function createCalibrationOverlayPdf(templateBytes: Uint8Array, rows: CalibrationInventoryRow[]): Promise<Uint8Array> {
  const pdfDocument = await PDFDocument.load(templateBytes);
  const font = await pdfDocument.embedFont(StandardFonts.Helvetica);
  const pages = pdfDocument.getPages();

  for (const row of rows.filter((entry) => entry.hasBoundingBox)) {
    const box = getBoundingBoxField(FORM_ID, row.fieldId);
    if (!box) {
      continue;
    }

    const page = pages[box.page];
    if (!page) {
      continue;
    }

    const { width: pageWidth, height: pageHeight } = page.getSize();
    page.drawRectangle({
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      borderColor: rgb(1, 0, 0),
      borderWidth: 0.8,
    });
    drawLabel({ pageWidth, pageHeight, page, font, box });
  }

  return pdfDocument.save();
}

async function renderFirstPdfPageToPng(pdfPath: string, outputPath: string): Promise<void> {
  const { chromium } = await import("playwright");
  const pdfjsModuleUrl = pathToFileURL(path.join(process.cwd(), "node_modules", "pdfjs-dist", "legacy", "build", "pdf.mjs")).href;
  const pdfjsWorkerUrl = pathToFileURL(path.join(process.cwd(), "node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.mjs")).href;
  const pdfUrl = pathToFileURL(pdfPath).href;
  const htmlPath = outputPath.replace(/\.png$/i, ".renderer.html");
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body { margin: 0; padding: 0; background: white; }
      canvas { display: block; }
    </style>
  </head>
  <body>
    <canvas id="page"></canvas>
    <script type="module">
      import * as pdfjs from "${pdfjsModuleUrl}";
      pdfjs.GlobalWorkerOptions.workerSrc = "${pdfjsWorkerUrl}";
      const loadingTask = pdfjs.getDocument({
        url: "${pdfUrl}",
        disableWorker: true,
        useWorkerFetch: false,
        isEvalSupported: false,
        disableFontFace: true,
        isOffscreenCanvasSupported: false,
        isImageDecoderSupported: false,
        verbosity: 0
      });
      const documentProxy = await loadingTask.promise;
      const page = await documentProxy.getPage(1);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.getElementById("page");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
      await documentProxy.destroy();
      window.__renderDone = true;
    </script>
  </body>
</html>`;

  await writeFile(htmlPath, html);
  const browser = await chromium.launch({
    headless: true,
    args: ["--allow-file-access-from-files"],
  });

  try {
    const page = await browser.newPage({ viewport: { width: 1300, height: 1800 }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
    await page.waitForFunction(() => (window as Window & { __renderDone?: boolean }).__renderDone === true, {
      timeout: 30000,
    });
    const canvas = page.locator("canvas");
    await canvas.screenshot({ path: outputPath });
  } finally {
    await browser.close();
    await rm(htmlPath, { force: true });
  }
}

async function main() {
  const template = EMPIRE_PDF_TEMPLATE_REGISTRY[TEMPLATE_KEY];
  const templateBytes = await readFile(path.join(process.cwd(), template.pdfRelativePath));
  const rows = buildCalibrationRows();

  await rm(OUTPUT_ROOT, { recursive: true, force: true });
  await mkdir(OUTPUT_ROOT, { recursive: true });

  const beforeResult = await fillTemplateWithIntelligence({
    templateKey: TEMPLATE_KEY,
    templateBytes: Uint8Array.from(templateBytes),
    profile: EMPIRE_PDF_QA_SCENARIOS[0].profile,
    debugBoundingBoxes: false,
  });
  const calibrationPdfBytes = await createCalibrationOverlayPdf(Uint8Array.from(templateBytes), rows);

  const beforePdfPath = path.join(OUTPUT_ROOT, "before-calibration.pdf");
  const calibrationPdfPath = path.join(OUTPUT_ROOT, "sbd1.calibration.pdf");

  await writeFile(beforePdfPath, Buffer.from(beforeResult.pdfBytes));
  await writeFile(calibrationPdfPath, Buffer.from(calibrationPdfBytes));
  await writeFile(path.join(OUTPUT_ROOT, "calibration-table.csv"), buildCsv(rows));
  await writeFile(path.join(OUTPUT_ROOT, "calibration-table.md"), buildCalibrationMarkdown(rows));
  await writeFile(path.join(OUTPUT_ROOT, "field-inventory.md"), buildInventoryMarkdown(rows));
  await writeFile(path.join(OUTPUT_ROOT, "root-cause-summary.md"), buildRootCauseMarkdown(rows));

  await renderFirstPdfPageToPng(calibrationPdfPath, path.join(OUTPUT_ROOT, "sbd1.calibration.png"));
  await renderFirstPdfPageToPng(beforePdfPath, path.join(OUTPUT_ROOT, "before-calibration.png"));

  console.log("[sbd1-manual-calibration] generated artifacts", {
    outputRoot: OUTPUT_ROOT,
    activeFieldCount: rows.filter((row) => row.activeInTemplate).length,
    boundingBoxCount: rows.filter((row) => row.hasBoundingBox).length,
    files: [
      "before-calibration.pdf",
      "before-calibration.png",
      "sbd1.calibration.pdf",
      "sbd1.calibration.png",
      "calibration-table.csv",
      "calibration-table.md",
      "field-inventory.md",
      "root-cause-summary.md",
    ],
  });
}

main().catch((error) => {
  console.error("[sbd1-manual-calibration] failed", error);
  process.exit(1);
});
