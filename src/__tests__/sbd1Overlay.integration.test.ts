import { buildSBD1OverlayPlan } from "@/lib/pdf/sbd1-overlay/mapper";
import { renderSBD1Overlay } from "@/lib/pdf/sbd1-overlay/renderer";
import { loadSbd1OverlayTemplate } from "@/lib/pdf/sbd1-overlay/templateLoader";

describe("SBD1 overlay integration", () => {
  test("loads the real template and renders a non-empty PDF", async () => {
    const templateBytes = await loadSbd1OverlayTemplate();

    expect(templateBytes).not.toBeNull();

    const pdfBytes = await renderSBD1Overlay(
      buildSBD1OverlayPlan({
        companyName: "Example Company",
        companyAddressLine1: "10 Main Road",
        companyAddressLine2: "Unit 4",
        contactNumber: "011 123 4567",
        email: "info@example.com",
        vatNumber: "1234567890",
        bbbee: "YES",
        generatedAt: new Date("2026-03-25T00:00:00.000Z"),
      }),
      templateBytes as Uint8Array
    );

    expect(pdfBytes).not.toBeNull();
    expect(pdfBytes?.length ?? 0).toBeGreaterThan(1000);
  });
});
