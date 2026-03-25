import { PDFDocument } from "pdf-lib";

import { generateTenderPack } from "@/lib/pdf/generateTenderPack";
import { generateSBD1OverlayDocument } from "@/lib/pdf/sbd1-overlay/service";
import { generateSBD4OverlayDocument } from "@/lib/pdf/sbd4-overlay/service";

jest.mock("@/lib/pdf/sbd1-overlay/service", () => ({
  generateSBD1OverlayDocument: jest.fn(),
}));

jest.mock("@/lib/pdf/sbd4-overlay/service", () => ({
  generateSBD4OverlayDocument: jest.fn(),
}));

jest.mock("pdf-lib", () => ({
  PDFDocument: {
    create: jest.fn(),
    load: jest.fn(),
  },
}));

describe("generateTenderPack migration pipeline", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("maps legacy input into TenderData before delegating to TenderData services", async () => {
    const addPage = jest.fn();
    const copyPages = jest.fn().mockResolvedValue(["page"]);
    const save = jest.fn().mockResolvedValue(Uint8Array.from([9, 9, 9]));

    (generateSBD1OverlayDocument as jest.MockedFunction<typeof generateSBD1OverlayDocument>).mockResolvedValue(
      Uint8Array.from([1, 2, 3])
    );
    (generateSBD4OverlayDocument as jest.MockedFunction<typeof generateSBD4OverlayDocument>).mockResolvedValue(
      Uint8Array.from([4, 5, 6])
    );
    (PDFDocument.create as jest.Mock).mockResolvedValue({
      copyPages,
      addPage,
      save,
    });
    (PDFDocument.load as jest.Mock).mockResolvedValue({
      getPageIndices: () => [0],
    });

    const result = await generateTenderPack({
      id: "deal-123",
      title: "Road Upgrade Tender",
      companyId: "contractor-001",
      companyName: "Torque Empire",
      contactNumber: "011 123 4567",
      email: "ops@example.com",
      vatNumber: "1234567890",
      bbbee: "YES",
      directors: [
        {
          name: "Director One",
          id: "9001011234087",
          entity: "Torque Empire",
        },
      ],
      declarationName: "Director One",
      hasRelationship: "NO",
    });

    expect(result).toEqual(Uint8Array.from([9, 9, 9]));
    expect(generateSBD1OverlayDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaFamily: "TenderData",
        legacyDealId: "deal-123",
      })
    );
    expect(generateSBD4OverlayDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaFamily: "TenderData",
        legacyDealId: "deal-123",
      })
    );
  });
});
