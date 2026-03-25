import { generateSBD4Overlay } from "@/lib/pdf/sbd4Overlay";
import { generateSBD4OverlayDocument } from "@/lib/pdf/sbd4-overlay/service";

jest.mock("@/lib/pdf/sbd4-overlay/service", () => ({
  generateSBD4OverlayDocument: jest.fn(),
}));

describe("generateSBD4Overlay entrypoint", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("maps legacy overlay input to TenderData before calling the service", async () => {
    (generateSBD4OverlayDocument as jest.MockedFunction<typeof generateSBD4OverlayDocument>).mockResolvedValue(
      Uint8Array.from([4, 5, 6])
    );

    await generateSBD4Overlay({
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

    expect(generateSBD4OverlayDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaFamily: "TenderData",
        metadata: expect.objectContaining({
          declarationName: "Director One",
          hasRelationship: "NO",
        }),
      })
    );
  });
});
