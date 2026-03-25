import { generateSBD1OverlayDocument } from "@/lib/pdf/sbd1-overlay/service";
import { loadSbd1OverlayTemplate } from "@/lib/pdf/sbd1-overlay/templateLoader";
import { renderSBD1Overlay } from "@/lib/pdf/sbd1-overlay/renderer";

jest.mock("@/lib/pdf/sbd1-overlay/templateLoader", () => ({
  loadSbd1OverlayTemplate: jest.fn(),
}));

jest.mock("@/lib/pdf/sbd1-overlay/renderer", () => ({
  renderSBD1Overlay: jest.fn(),
}));

describe("generateSBD1OverlayDocument", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns null and does not render when validation fails", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    const result = await generateSBD1OverlayDocument({
      schemaVersion: "2026-01",
      schemaFamily: "TenderData",
      tenderId: "tender-1",
      title: "Tender 1",
      sourceYear: 2026,
      status: "draft",
      timeline: {},
      requirements: [],
      documents: [],
      metadata: {
        email: "invalid-email",
        bbbee: "MAYBE",
      },
    });

    expect(result).toBeNull();
    expect(loadSbd1OverlayTemplate).not.toHaveBeenCalled();
    expect(renderSBD1Overlay).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      "SBD1 overlay validation failed",
      expect.objectContaining({
        issues: expect.arrayContaining([
          "email must contain '@' when provided",
          "bbbee must be either 'YES' or 'NO' when provided",
        ]),
      })
    );

    warnSpy.mockRestore();
  });

  test("loads template and renders validated overlay input", async () => {
    const infoSpy = jest.spyOn(console, "info").mockImplementation(() => undefined);
    const templateBytes = Uint8Array.from([1, 2, 3]);
    const pdfBytes = Uint8Array.from([4, 5, 6]);

    (loadSbd1OverlayTemplate as jest.MockedFunction<typeof loadSbd1OverlayTemplate>).mockResolvedValue(
      templateBytes
    );
    (renderSBD1Overlay as jest.MockedFunction<typeof renderSBD1Overlay>).mockResolvedValue(pdfBytes);

    const result = await generateSBD1OverlayDocument({
      schemaVersion: "2026-01",
      schemaFamily: "TenderData",
      tenderId: "tender-2",
      title: "Tender 2",
      sourceYear: 2026,
      status: "draft",
      contractor: {
        id: "contractor-1",
        name: "Example Company",
        role: "contractor",
      },
      timeline: {
        updatedAt: "2026-03-25T00:00:00.000Z",
      },
      requirements: [],
      documents: [],
      metadata: {
        email: "info@example.com",
        bbbee: "YES",
      },
    });

    expect(result).toBe(pdfBytes);
    expect(loadSbd1OverlayTemplate).toHaveBeenCalledTimes(1);
    expect(renderSBD1Overlay).toHaveBeenCalledWith(
      expect.objectContaining({
        textInstructions: expect.arrayContaining([
          expect.objectContaining({ text: "Example Company" }),
        ]),
        checkboxInstruction: expect.objectContaining({ x: 420 }),
      }),
      templateBytes
    );
    expect(infoSpy).toHaveBeenCalledWith(
      "SBD1 overlay generation started",
      expect.objectContaining({
        tenderId: "tender-2",
        hasCompanyName: true,
        hasEmail: true,
      })
    );

    infoSpy.mockRestore();
  });
});
