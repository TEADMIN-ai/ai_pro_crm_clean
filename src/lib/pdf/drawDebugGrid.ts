import { rgb, type PDFPage } from "pdf-lib";

export function drawDebugGrid(page: PDFPage, step = 25) {
  const { width, height } = page.getSize();
  const gridColor = rgb(0.85, 0.2, 0.2);

  for (let x = 0; x <= width; x += step) {
    page.drawLine({
      start: { x, y: 0 },
      end: { x, y: height },
      thickness: 0.25,
      color: gridColor,
      opacity: 0.25,
    });

    page.drawText(String(x), {
      x: Math.min(x + 1, width - 20),
      y: 4,
      size: 6,
      color: gridColor,
      opacity: 0.7,
    });
  }

  for (let y = 0; y <= height; y += step) {
    page.drawLine({
      start: { x: 0, y },
      end: { x: width, y },
      thickness: 0.25,
      color: gridColor,
      opacity: 0.25,
    });

    page.drawText(String(y), {
      x: 4,
      y: Math.min(y + 1, height - 8),
      size: 6,
      color: gridColor,
      opacity: 0.7,
    });
  }
}
