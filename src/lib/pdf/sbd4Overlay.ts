import { PDFDocument, StandardFonts } from "pdf-lib";

import { SBD4_FIELD_MAP } from "@/lib/pdf/maps/SBD4";
import { writeToField } from "@/lib/pdf/writeToField";

type Director = {
  name: string;
  id: string;
  entity: string;
};

type SBD4Data = {
  directors: Director[];
  hasRelationship?: "YES" | "NO";
  declarationName?: string;
};

export async function generateSBD4Overlay(data: SBD4Data) {
  try {
    const res = await fetch("/templates/SBD4.pdf");

    if (!res.ok) {
      console.error("Failed to load SBD4 template");
      return null;
    }

    const existingPdfBytes = await res.arrayBuffer();
    const pdfDoc = await PDFDocument.load(existingPdfBytes);

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const firstPage = pdfDoc.getPage(0);
    const declarationPage = pdfDoc.getPage(1);
    const signaturePage = pdfDoc.getPage(2);

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

    writeToField(signaturePage, data.declarationName || "Chadwin Karanie", {
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
