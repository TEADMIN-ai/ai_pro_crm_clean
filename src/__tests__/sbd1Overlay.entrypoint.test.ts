import { generateSBD1Overlay } from "@/lib/pdf/sbd1Overlay";
import { generateSBD1OverlayDocument } from "@/lib/pdf/sbd1-overlay/service";

jest.mock("@/lib/pdf/sbd1-overlay/service", () => ({
  generateSBD1OverlayDocument: jest.fn(),
}));

describe("generateSBD1Overlay entrypoint", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("maps legacy input to TenderData before calling the service", async () => {
    (generateSBD1OverlayDocument as jest.MockedFunction<typeof generateSBD1OverlayDocument>).mockResolvedValue(
      Uint8Array.from([1, 2, 3])
    );

    await generateSBD1Overlay({
      id: "deal-123",
      title: "Road Upgrade Tender",
      companyId: "contractor-001",
      companyName: "Torque Empire",
      email: "ops@example.com",
      vatNumber: "1234567890",
      bbbee: "YES",
    });

    expect(generateSBD1OverlayDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaFamily: "TenderData",
        legacyDealId: "deal-123",
        contractor: expect.objectContaining({
          id: "contractor-001",
        }),
      })
    );
  });
});
