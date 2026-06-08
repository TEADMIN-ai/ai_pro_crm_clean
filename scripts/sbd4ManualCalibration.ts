import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";
import { pathToFileURL } from "url";

import { loadEnvConfig } from "@next/env";
import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb } from "pdf-lib";

import { getBoundingBoxField, getBoundingBoxTemplate } from "@/lib/empirePdf/boundingBoxes";
import type { BoundingBoxFieldDefinition } from "@/lib/empirePdf/boundingBoxes";
import { fillTemplateWithIntelligence } from "@/lib/empirePdf/intelligentFillEngine";
import { EMPIRE_PDF_QA_SCENARIOS } from "@/lib/empirePdf/qa/scenarios";
import { EMPIRE_PDF_TEMPLATE_REGISTRY } from "@/lib/empirePdf/templates";

loadEnvConfig(process.cwd());

const OUTPUT_ROOT = path.join(process.cwd(), "output", "pdf", "sbd4-calibration-manual");
const TEMPLATE_KEY = "sbd4";
const FORM_ID = "SBD4";
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
  if (!template) {
    throw new Error(`Template '${TEMPLATE_KEY}' is not registered in EmpirePDF`);
  }

  const boundingTemplate = getBoundingBoxTemplate(FORM_ID);
  const activeFieldIds = new Set(template.fields.map((field) => field.fieldId));
  const fieldIds = Array.from(
    new Set([...template.fields.map((field) => field.fieldId), ...Object.keys(boundingTemplate?.fields ?? {})])
  );

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
    "# SBD4 Manual Calibration Table",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "| Field Name | Page | Current X | Current Y | Width | Height |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
  ];

  for (const row of rows) {
    lines.push(
      `| \`${row.fieldName}\` | ${row.pageNumber ?? ""} | ${formatNumber(row.currentX)} | ${formatNumber(
        row.currentY
      )} | ${formatNumber(row.width)} | ${formatNumber(row.height)} |`
    );
  }

  return `${lines.join("\n")}\n`;
}

function buildInventoryMarkdown(rows: CalibrationInventoryRow[]): string {
  const lines = [
    "# SBD4 Active Field Inventory",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "| Field ID | Active Template Field | Bounding Box | Page | Current X | Current Y | Width | Height |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];

  for (const row of rows) {
    lines.push(
      `| \`${row.fieldId}\` | ${row.activeInTemplate ? "yes" : "no"} | ${
        row.hasBoundingBox ? "yes" : "missing"
      } | ${row.pageNumber ?? ""} | ${formatNumber(row.currentX)} | ${formatNumber(row.currentY)} | ${formatNumber(
        row.width
      )} | ${formatNumber(row.height)} |`
    );
  }

  return `${lines.join("\n")}\n`;
}

function drawLabel(params: {
  pageWidth: number;
  pageHeight: number;
  page: PDFPage;
  font: PDFFont;
  box: BoundingBoxFieldDefinition;
}) {
  const { box, font, page, pageHeight, pageWidth } = params;
  const lines = [
    box.fieldId,
    `id=${box.fieldId}`,
    `page=${box.pageNumber}`,
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

async function renderPdfPagesToPng(pdfPath: string, outputPath: string): Promise<void> {
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
    <canvas id="pages"></canvas>
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
      const scale = 1.6;
      const gap = 24;
      const pageData = [];
      for (let pageNumber = 1; pageNumber <= documentProxy.numPages; pageNumber += 1) {
        const page = await documentProxy.getPage(pageNumber);
        const viewport = page.getViewport({ scale });
        pageData.push({ page, viewport });
      }
      const width = Math.ceil(Math.max(...pageData.map((entry) => entry.viewport.width)));
      const height = Math.ceil(pageData.reduce((sum, entry) => sum + entry.viewport.height, 0) + gap * (pageData.length - 1));
      const canvas = document.getElementById("pages");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      context.fillStyle = "white";
      context.fillRect(0, 0, width, height);
      let offsetY = 0;
      for (const entry of pageData) {
        context.save();
        context.translate(0, offsetY);
        await entry.page.render({ canvasContext: context, viewport: entry.viewport }).promise;
        context.restore();
        offsetY += entry.viewport.height + gap;
      }
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
    const page = await browser.newPage({ viewport: { width: 1100, height: 5600 }, deviceScaleFactor: 1 });
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
  if (!template) {
    throw new Error(`Template '${TEMPLATE_KEY}' is not registered in EmpirePDF`);
  }

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
  const beforeOverlayResult = await fillTemplateWithIntelligence({
    templateKey: TEMPLATE_KEY,
    templateBytes: Uint8Array.from(templateBytes),
    profile: EMPIRE_PDF_QA_SCENARIOS[0].profile,
    debugBoundingBoxes: true,
  });
  const calibrationPdfBytes = await createCalibrationOverlayPdf(Uint8Array.from(templateBytes), rows);

  const calibrationPdfPath = path.join(OUTPUT_ROOT, "sbd4.calibration.pdf");

  await writeFile(path.join(OUTPUT_ROOT, "before.pdf"), Buffer.from(beforeResult.pdfBytes));
  await writeFile(path.join(OUTPUT_ROOT, "before-overlay.pdf"), Buffer.from(beforeOverlayResult.pdfBytes));
  await writeFile(calibrationPdfPath, Buffer.from(calibrationPdfBytes));
  await writeFile(path.join(OUTPUT_ROOT, "calibration-table.csv"), buildCsv(rows));
  await writeFile(path.join(OUTPUT_ROOT, "calibration-table.md"), buildCalibrationMarkdown(rows));
  await writeFile(path.join(OUTPUT_ROOT, "field-inventory.json"), `${JSON.stringify(rows, null, 2)}\n`);
  await writeFile(path.join(OUTPUT_ROOT, "field-inventory.md"), buildInventoryMarkdown(rows));

  await renderPdfPagesToPng(calibrationPdfPath, path.join(OUTPUT_ROOT, "sbd4.calibration.png"));

  console.log("[sbd4-manual-calibration] generated artifacts", {
    outputRoot: OUTPUT_ROOT,
    activeFieldCount: rows.filter((row) => row.activeInTemplate).length,
    boundingBoxCount: rows.filter((row) => row.hasBoundingBox).length,
    files: [
      "before.pdf",
      "before-overlay.pdf",
      "sbd4.calibration.pdf",
      "sbd4.calibration.png",
      "calibration-table.csv",
      "calibration-table.md",
      "field-inventory.json",
      "field-inventory.md",
    ],
  });
}

main().catch((error) => {
  console.error("[sbd4-manual-calibration] failed", error);
  process.exit(1);
});
