import fs from "node:fs";
import path from "node:path";
import { GET as consolidatedPackGET } from "@/app/api/hygiene/clients/[clientId]/consolidated-pack/route";
import { downloadFirebaseStorageObject } from "@/lib/firebase/storageRest";
import { getConsolidatedHygieneClientPackData } from "@/lib/hygiene/hygieneConsolidatedPack";
import { generateConsolidatedHygieneClientPackPdf } from "@/lib/hygiene/hygienePdfBranding";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";

jest.mock("@/lib/server/authz", () => {
  class AuthorizationError extends Error {
    status: number;
    constructor(message: string, status = 403) {
      super(message);
      this.name = "AuthorizationError";
      this.status = status;
    }
  }
  return { AuthorizationError, requireAuthorizedUser: jest.fn() };
});

jest.mock("@/lib/hygiene/hygieneConsolidatedPack", () => ({
  getConsolidatedHygieneClientPackData: jest.fn(),
}));

jest.mock("@/lib/hygiene/hygienePdfBranding", () => ({
  buildConsolidatedHygieneClientPackFileName: jest.fn(() => "Torque-Empire_Hygiene_Client_Consolidated-Client-Pack_2026-07.pdf"),
  buildPdfContentDisposition: jest.fn((disposition: string, filename: string) => `${disposition}; filename="${filename}"`),
  generateConsolidatedHygieneClientPackPdf: jest.fn(),
}));

jest.mock("@/lib/firebase/storageRest", () => ({
  downloadFirebaseStorageObject: jest.fn(),
}));

const user = { uid: "admin-1", email: "admin@example.test", role: "admin" as const };
const consolidatedData = {
  client: { clientId: "TE-CLI-1", clientName: "CBAVO Services" },
  period: { startDate: "2026-07-01", endDate: "2026-07-31" },
  siteFilter: null,
  entries: [
    {
      collection: { collectionId: "TE-COL-1" },
      manifest: { manifestId: "TE-WM-1" },
      site: { siteName: "Goldman Crossing" },
      disposalEvidence: [{
        evidenceId: "TE-EP-1",
        storagePath: "hygiene/evidence/TE-CLI-1/TE-COL-1/cert.pdf",
      }],
    },
  ],
  summary: {},
  generatedAt: "2026-07-31T12:00:00.000Z",
};

function request(url = "https://teos.example.test/api/hygiene/clients/TE-CLI-1/consolidated-pack?startDate=2026-07-01&endDate=2026-07-31") {
  return { nextUrl: new URL(url) } as never;
}

const context = { params: Promise.resolve({ clientId: "TE-CLI-1" }) };

describe("Hygiene consolidated client-pack route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireAuthorizedUser as jest.Mock).mockResolvedValue(user);
    (getConsolidatedHygieneClientPackData as jest.Mock).mockResolvedValue(consolidatedData);
    (downloadFirebaseStorageObject as jest.Mock).mockResolvedValue(Uint8Array.from(Buffer.from("certificate")));
    (generateConsolidatedHygieneClientPackPdf as jest.Mock).mockResolvedValue(Uint8Array.from([37, 80, 68, 70]));
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("requires authentication before returning consolidated packs", async () => {
    (requireAuthorizedUser as jest.Mock).mockRejectedValue(new AuthorizationError("unauthorized", 401));

    const response = await consolidatedPackGET(request(), context);

    expect(response.status).toBe(401);
    expect(getConsolidatedHygieneClientPackData).not.toHaveBeenCalled();
  });

  it("uses the route clientId and canonical resolver instead of client-supplied fields", async () => {
    const response = await consolidatedPackGET(request("https://teos.example.test/api/hygiene/clients/TE-CLI-1/consolidated-pack?clientId=OTHER&startDate=2026-07-01&endDate=2026-07-31&siteId=TE-SIT-1"), context);
    const body = new Uint8Array(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(getConsolidatedHygieneClientPackData).toHaveBeenCalledWith(user, {
      clientId: "TE-CLI-1",
      startDate: "2026-07-01",
      endDate: "2026-07-31",
      siteId: "TE-SIT-1",
      includeIncomplete: false,
    });
    expect(downloadFirebaseStorageObject).toHaveBeenCalledWith("hygiene/evidence/TE-CLI-1/TE-COL-1/cert.pdf");
    expect(generateConsolidatedHygieneClientPackPdf).toHaveBeenCalledWith(consolidatedData, [{
      evidenceId: "TE-EP-1",
      manifestId: "TE-WM-1",
      collectionId: "TE-COL-1",
      bytes: Uint8Array.from(Buffer.from("certificate")),
    }]);
    expect(Array.from(body)).toEqual([37, 80, 68, 70]);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe("attachment; filename=\"Torque-Empire_Hygiene_Client_Consolidated-Client-Pack_2026-07.pdf\"");
  });

  it("keeps the consolidated route clear of Firebase Admin Storage imports", () => {
    const routeSource = fs.readFileSync(
      path.join(process.cwd(), "src/app/api/hygiene/clients/[clientId]/consolidated-pack/route.ts"),
      "utf8",
    );

    expect(routeSource).not.toContain("firebase-admin/storage");
    expect(routeSource).not.toContain("getFirebaseStorageBucket");
    expect(routeSource).not.toContain("@/lib/firebase/admin");
    expect(routeSource).toContain("@/lib/firebase/storageRest");
  });

  it("keeps Hygiene PDF branding on exact public assets only", () => {
    const brandingSource = fs.readFileSync(path.join(process.cwd(), "src/lib/hygiene/hygienePdfBranding.ts"), "utf8");

    expect(brandingSource).toContain("\"public\", \"corporate\", \"letterhead\", \"torque-empire-business-letterhead.png\"");
    expect(brandingSource).toContain("\"public\", \"corporate\", \"logo\", \"torque-empire-primary.png\"");
    expect(brandingSource).not.toContain("publicAssetPath");
    expect(brandingSource).not.toContain("readdir");
  });
});
