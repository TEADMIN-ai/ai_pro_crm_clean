import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

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
      console.error("❌ Failed to load SBD4 template");
      return null;
    }

    const existingPdfBytes = await res.arrayBuffer();
    const pdfDoc = await PDFDocument.load(existingPdfBytes);

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const pages = pdfDoc.getPages();
    const page = pages[0];
    const pageWidth = page.getWidth();
    const pageHeight = page.getHeight();

    // Draw horizontal guide lines every 50px
    for (let y = 0; y < pageHeight; y += 50) {
      page.drawLine({
        start: { x: 0, y },
        end: { x: pageWidth, y },
        thickness: 0.5,
      });
    }

    // Draw vertical guide lines every 50px
    for (let x = 0; x < pageWidth; x += 50) {
      page.drawLine({
        start: { x, y: 0 },
        end: { x, y: pageHeight },
        thickness: 0.5,
      });
    }

    // =========================
    // 🎯 DIRECTOR TABLE (2 ROWS)
    // =========================

    let startY = 340;
    const nameX = 85;
    const idX = 220;
    const entityX = 360;
    const rowGap = 24;

    data.directors.slice(0, 2).forEach((director, index) => {
      const y = startY - index * rowGap;

      page.drawText(director.name || "-", {
        x: nameX,
        y,
        size: 9,
        font,
      });

      page.drawText(director.id || "-", {
        x: idX,
        y,
        size: 9,
        font,
      });

      page.drawText(director.entity || "-", {
        x: entityX,
        y,
        size: 9,
        font,
      });
    });

    // =========================
    // ✅ YES / NO CHECKBOX
    // =========================

    const yesX = 420;
    const noX = 460;
    const checkboxY = 260;

    page.drawText("X", {
      x: data.hasRelationship === "YES" ? yesX : noX,
      y: checkboxY,
      size: 12,
      font,
    });

    // =========================
    // 🧾 DECLARATION NAME
    // =========================

    page.drawText(data.declarationName || "Chadwin Karanie", {
      x: 120,
      y: 120,
      size: 10,
      font,
    });

    // =========================
    // 📅 DATE
    // =========================

    page.drawText(new Date().toLocaleDateString(), {
      x: 420,
      y: 100,
      size: 10,
      font,
    });

    // =========================
    // 💾 SAVE PDF
    // =========================

    const pdfBytes = await pdfDoc.save();

    return pdfBytes;

  } catch (error) {
    console.error("❌ SBD4 Overlay Error:", error);
    return null;
  }
}
