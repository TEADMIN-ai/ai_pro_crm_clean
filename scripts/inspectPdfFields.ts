import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { PDFDocument } from "pdf-lib";

async function main() {
  const templateKey = process.argv[2];

  if (!templateKey) {
    console.error("Usage: npm.cmd exec tsx scripts/inspectPdfFields.ts <templateKey>");
    process.exit(1);
  }

  const pdfPath = path.join(
    process.cwd(),
    "src",
    "lib",
    "pdfs",
    "templates",
    "tender-packs",
    `${templateKey}.pdf`
  );

  let bytes: Buffer;
  try {
    bytes = await fs.readFile(pdfPath);
  } catch {
    console.error(`Template not found: ${pdfPath}`);
    process.exit(1);
    return;
  }

  const pdf = await PDFDocument.load(bytes);
  const form = pdf.getForm();
  const fields = form.getFields();

  if (fields.length === 0) {
    console.log("No AcroForm fields found.");
    return;
  }

  console.log(`Fields for template '${templateKey}':`);
  for (const field of fields) {
    console.log(field.getName());
  }
}

main().catch((error) => {
  console.error("Failed to inspect PDF fields:", error);
  process.exit(1);
});
