const mockAdd = jest.fn();
const mockSave = jest.fn();
const mockGetSignedUrl = jest.fn();
const mockDelete = jest.fn();
const mockFile = jest.fn();

jest.mock("@/lib/firebase/admin", () => ({
  getFirebaseAdmin: () => ({
    collection: (name: string) => {
      if (name !== "tenderPacks") throw new Error(`Unexpected collection ${name}`);
      return { add: mockAdd };
    },
  }),
  getFirebaseStorageBucket: () => ({ file: mockFile }),
}));

import {
  persistGenericTenderPackPdf,
  persistLegacyTenderPackPdf,
  persistTenderPackPdf,
} from "@/server/services/tenderPackService";

function base() {
  return {
    contractorId: "contractor-1",
    createdBy: "staff-1",
    templateKey: "tender-pack",
    pdfBytes: Buffer.from("%PDF-test"),
    missingFields: [],
    warnings: [],
    fieldMapUsed: { dealId: "deal-1", contractorId: "contractor-1" },
  };
}

describe("tender pack persistence governance", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    mockAdd.mockResolvedValue({ id: "pack-1" });
    mockSave.mockResolvedValue(undefined);
    mockGetSignedUrl.mockResolvedValue(["https://signed.example/pack.pdf"]);
    mockDelete.mockResolvedValue(undefined);
    mockFile.mockImplementation(() => ({ save: mockSave, getSignedUrl: mockGetSignedUrl, delete: mockDelete }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("governed pack persists canonical ownership in path, metadata and record", async () => {
    const result = await persistTenderPackPdf({
      ...base(),
      dealId: "deal-1",
      opportunityId: "deal-1",
      workspaceId: "workspace-1",
      clientQuoteId: "client-quote-1",
    });

    expect(mockFile).toHaveBeenCalledWith(expect.stringContaining("tenderPacks/governed/workspace-1/deal-1/contractor-1/"));
    expect(mockSave).toHaveBeenCalledWith(expect.any(Buffer), expect.objectContaining({
      metadata: expect.objectContaining({
        metadata: expect.objectContaining({
          governanceMode: "GOVERNED",
          dealId: "deal-1",
          opportunityId: "deal-1",
          workspaceId: "workspace-1",
          contractorId: "contractor-1",
          clientQuoteId: "client-quote-1",
        }),
      }),
    }));
    expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({
      governanceMode: "GOVERNED",
      dealId: "deal-1",
      opportunityId: "deal-1",
      workspaceId: "workspace-1",
      contractorId: "contractor-1",
      clientQuoteId: "client-quote-1",
      fileName: "1700000000000-tender-pack.pdf",
      filename: "1700000000000-tender-pack.pdf",
    }));
    expect(result).toMatchObject({ packId: "pack-1", fileName: "1700000000000-tender-pack.pdf" });
  });

  test.each([
    ["dealId", ""],
    ["opportunityId", ""],
    ["workspaceId", ""],
    ["clientQuoteId", ""],
    ["contractorId", ""],
  ])("governed persistence fails closed when %s is blank", async (field, value) => {
    const input = {
      ...base(),
      dealId: "deal-1",
      opportunityId: "deal-1",
      workspaceId: "workspace-1",
      clientQuoteId: "client-quote-1",
      [field]: value,
    };

    await expect(persistTenderPackPdf(input)).rejects.toThrow(/required/);
    expect(mockSave).not.toHaveBeenCalled();
    expect(mockAdd).not.toHaveBeenCalled();
  });

  test("legacy persistence remains distinguishable and does not fabricate quote or opportunity IDs", async () => {
    await persistLegacyTenderPackPdf({ ...base(), dealId: "deal-legacy" });

    expect(mockFile).toHaveBeenCalledWith(expect.stringContaining("tenderPacks/legacy/unscoped/deal-legacy/contractor-1/"));
    expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({
      governanceMode: "LEGACY",
      dealId: "deal-legacy",
      opportunityId: null,
      clientQuoteId: null,
    }));
  });

  test("generic persistence does not fabricate procurement ownership", async () => {
    await persistGenericTenderPackPdf(base());

    expect(mockFile).toHaveBeenCalledWith(expect.stringContaining("tenderPacks/generic/contractor-1/"));
    expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({
      governanceMode: "GENERIC",
      dealId: null,
      opportunityId: null,
      workspaceId: null,
      clientQuoteId: null,
    }));
  });

  test("each generation creates a new historical tenderPacks record", async () => {
    mockAdd.mockResolvedValueOnce({ id: "pack-1" }).mockResolvedValueOnce({ id: "pack-2" });

    await persistTenderPackPdf({
      ...base(), dealId: "deal-1", opportunityId: "deal-1", workspaceId: "workspace-1", clientQuoteId: "quote-1",
    });
    await persistTenderPackPdf({
      ...base(), dealId: "deal-1", opportunityId: "deal-1", workspaceId: "workspace-1", clientQuoteId: "quote-1",
    });

    expect(mockAdd).toHaveBeenCalledTimes(2);
  });
});
