import { PDFDocument, StandardFonts } from "pdf-lib";

import { SBD4_FIELD_MAP } from "@/lib/pdf/maps/SBD4";
import { writeToField } from "@/lib/pdf/writeToField";
import { mapTenderDataToSBD4OverlayInput } from "@/lib/tender/mappers/tender.mapper";
import type { TenderData } from "@/types/tender.types";

async function loadSBD4OverlayTemplate(): Promise<Uint8Array | null> {
  try {
    const response = await fetch("/templates/SBD4.pdf");

    if (!response.ok) {
      console.error("Failed to load SBD4 template");
      return null;
    }

    return new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    console.error("Failed to load SBD4 template", error);
    return null;
  }
}

export async function generateSBD4OverlayDocument(tenderData: TenderData): Promise<Uint8Array | null> {
  try {
    const data = mapTenderDataToSBD4OverlayInput(tenderData);
    const templateBytes = await loadSBD4OverlayTemplate();

    if (!templateBytes) {
      return null;
    }

    const pdfDoc = await PDFDocument.load(templateBytes);

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const firstPage = pdfDoc.getPage(0);
    const declarationPage = pdfDoc.getPage(1);
    const signaturePage = pdfDoc.getPage(2);

    if (!firstPage || !declarationPage || !signaturePage) {
      throw new Error("SBD4 template is missing required pages");
    }

    SBD4_FIELD_MAP.directors.forEach((row, index) => {
      const director = data.directors[index];
      if (!director) {
        return;
      }

      writeToField(firstPage, director.name || "-", {
        x: row.name.x,
        y: row.name.y,
        maxWidth: row.name.width,
        lineHeight: row.name.height,
        font,
        size: 9,
      });

      writeToField(firstPage, director.id || "-", {
        x: row.id.x,
        y: row.id.y,
        maxWidth: row.id.width,
        lineHeight: row.id.height,
        font,
        size: 9,
      });

      writeToField(firstPage, director.entity || "-", {
        x: row.entity.x,
        y: row.entity.y,
        maxWidth: row.entity.width,
        lineHeight: row.entity.height,
        font,
        size: 9,
      });
    });

    const yesField = {
      x: SBD4_FIELD_MAP.answer.x,
      y: SBD4_FIELD_MAP.answer.y - 3,
      maxWidth: SBD4_FIELD_MAP.answer.width,
      lineHeight: SBD4_FIELD_MAP.answer.height,
      font,
      size: 10,
    };

    const noField = {
      x: SBD4_FIELD_MAP.answer.x + 10,
      y: SBD4_FIELD_MAP.answer.y - 3,
      maxWidth: SBD4_FIELD_MAP.answer.width,
      lineHeight: SBD4_FIELD_MAP.answer.height,
      font,
      size: 10,
    };

    if (data.hasRelationship === "YES") {
      writeToField(declarationPage, "X", yesField);
    } else if (data.hasRelationship === "NO") {
      writeToField(declarationPage, "X", noField);
    }

    writeToField(signaturePage, data.declarationName || "Authorized Signatory", {
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

    return await pdfDoc.save();
  } catch (error) {
    console.error("SBD4 Overlay Error:", error);
    return null;
  }
}
