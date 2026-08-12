import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { assertCanAccessContractor, AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import { SBD4_FIELD_MAP } from "@/lib/pdf/maps/SBD4";
import { writeToField } from "@/lib/pdf/writeToField";
import { persistGenericTenderPackPdf } from "@/server/services/tenderPackService";

type SBD4RequestBody = {
  contractorId?: string;
  companyName?: string | null;
  companyRegistrationNumber?: string | null;
  contactPerson?: string | null;
  directors?: string | null;
  directorNames?: string | null;
};

type DirectorRow = {
  name: string;
  id: string;
  entity: string;
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseDirectors(body: SBD4RequestBody): DirectorRow[] {
  const source = clean(body.directors) || clean(body.directorNames);
  const registrationNumber = clean(body.companyRegistrationNumber);

  if (!source) return [];

  return source
    .split(/[\n,;|]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, SBD4_FIELD_MAP.directors.length)
    .map((name) => ({ name, id: registrationNumber, entity: clean(body.companyName) }));
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    const body = (await request.json()) as SBD4RequestBody;
    const contractorId = clean(body.contractorId);

    if (!contractorId) return NextResponse.json({ error: "Missing contractorId" }, { status: 400 });
    assertCanAccessContractor(user, contractorId);

    const templatePath = path.join(process.cwd(), "public", "templates", "SBD4.pdf");
    const templateBytes = await readFile(templatePath);
    const pdfDoc = await PDFDocument.load(templateBytes);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const firstPage = pdfDoc.getPage(0);
    const declarationPage = pdfDoc.getPage(1);
    const signaturePage = pdfDoc.getPage(2);
    if (!firstPage || !declarationPage || !signaturePage) throw new Error("SBD4 template is missing required pages");

    const directors = parseDirectors(body);
    SBD4_FIELD_MAP.directors.forEach((row, index) => {
      const director = directors[index];
      if (!director) return;
      writeToField(firstPage, director.name || "-", { x: row.name.x, y: row.name.y, maxWidth: row.name.width, lineHeight: row.name.height, font, size: 9 });
      writeToField(firstPage, director.id || "-", { x: row.id.x, y: row.id.y, maxWidth: row.id.width, lineHeight: row.id.height, font, size: 9 });
      writeToField(firstPage, director.entity || "-", { x: row.entity.x, y: row.entity.y, maxWidth: row.entity.width, lineHeight: row.entity.height, font, size: 9 });
    });

    writeToField(declarationPage, "X", {
      x: SBD4_FIELD_MAP.answer.x + 10,
      y: SBD4_FIELD_MAP.answer.y - 3,
      maxWidth: SBD4_FIELD_MAP.answer.width,
      lineHeight: SBD4_FIELD_MAP.answer.height,
      font,
      size: 10,
    });

    writeToField(signaturePage, clean(body.contactPerson) || clean(body.companyName) || "Authorized Signatory", {
      x: SBD4_FIELD_MAP.name.x,
      y: SBD4_FIELD_MAP.name.y - 3,
      maxWidth: SBD4_FIELD_MAP.name.width,
      lineHeight: SBD4_FIELD_MAP.name.height,
      font,
      size: 10,
    });

    writeToField(signaturePage, new Date().toLocaleDateString("en-ZA"), {
      x: SBD4_FIELD_MAP.date.x,
      y: SBD4_FIELD_MAP.date.y,
      maxWidth: SBD4_FIELD_MAP.date.width,
      lineHeight: SBD4_FIELD_MAP.date.height,
      font,
      size: 10,
    });

    const pdfBytes = await pdfDoc.save();
    const responseBody = Buffer.from(pdfBytes);
    await persistGenericTenderPackPdf({
      contractorId,
      createdBy: user.uid,
      templateKey: "sbd4",
      pdfBytes: new Blob([responseBody], { type: "application/pdf" }),
      missingFields: [],
      warnings: [],
      fieldMapUsed: {
        companyName: clean(body.companyName),
        companyRegistrationNumber: clean(body.companyRegistrationNumber),
        contactPerson: clean(body.contactPerson),
      },
    });

    return new NextResponse(responseBody, {
      status: 200,
      headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="SBD4.pdf"' },
    });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("SBD4 generation failed:", error);
    return NextResponse.json({ error: "Failed to generate SBD4" }, { status: 500 });
  }
}
