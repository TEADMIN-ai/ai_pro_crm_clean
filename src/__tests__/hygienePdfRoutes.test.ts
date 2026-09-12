import { GET as manifestPdfGET } from "@/app/api/hygiene/manifests/[manifestId]/pdf/route";
import { GET as clientPackGET } from "@/app/api/hygiene/manifests/[manifestId]/client-pack/route";
import fs from "node:fs";
import path from "node:path";
import { getHygieneManifestPdfData } from "@/lib/hygiene/hygienePdfData";
import { generateHygieneClientPackPdf, generateHygieneManifestPdf } from "@/lib/hygiene/hygienePdfBranding";
import { downloadFirebaseStorageObject } from "@/lib/firebase/storageRest";
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

jest.mock("@/lib/hygiene/hygienePdfData", () => ({
  getHygieneManifestPdfData: jest.fn(),
}));

jest.mock("@/lib/hygiene/hygienePdfBranding", () => ({
  buildHygieneManifestFileName: jest.fn(() => "Torque-Empire_Hygiene_Client_Site_Waste-Manifest_TE-WM-1_2026-07-10.pdf"),
  buildPdfContentDisposition: jest.fn((disposition: string, filename: string) => `${disposition}; filename="${filename}"`),
  generateHygieneManifestPdf: jest.fn(),
  generateHygieneClientPackPdf: jest.fn(),
}));

jest.mock("@/lib/firebase/storageRest", () => ({
  downloadFirebaseStorageObject: jest.fn(),
}));

const user = { uid: "admin-1", email: "admin@example.test", role: "admin" as const };
const data = {
  manifest: { manifestId: "TE-WM-1", clientId: "TE-CLI-1", collectionId: "TE-COL-1", siteId: "TE-SIT-1" },
  client: { clientName: "Client" },
  site: { siteName: "Site" },
  collection: { collectionId: "TE-COL-1" },
  disposalEvidence: [],
};

function request(url = "https://teos.example.test/api/hygiene/manifests/TE-WM-1/pdf") {
  return { nextUrl: new URL(url) } as never;
}

const context = { params: Promise.resolve({ manifestId: "TE-WM-1" }) };

describe("Hygiene PDF routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireAuthorizedUser as jest.Mock).mockResolvedValue(user);
    (getHygieneManifestPdfData as jest.Mock).mockResolvedValue(data);
    (generateHygieneManifestPdf as jest.Mock).mockResolvedValue(Uint8Array.from([37, 80, 68, 70]));
    (generateHygieneClientPackPdf as jest.Mock).mockResolvedValue(Uint8Array.from([37, 80, 68, 70]));
    (downloadFirebaseStorageObject as jest.Mock).mockResolvedValue(Uint8Array.from(Buffer.from("certificate")));
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("requires authentication before returning manifest PDFs", async () => {
    (requireAuthorizedUser as jest.Mock).mockRejectedValue(new AuthorizationError("unauthorized", 401));

    const response = await manifestPdfGET(request(), context);

    expect(response.status).toBe(401);
    expect(getHygieneManifestPdfData).not.toHaveBeenCalled();
  });

  it("uses the route manifestId and canonical resolver instead of client-supplied fields", async () => {
    const response = await manifestPdfGET(request("https://teos.example.test/api/hygiene/manifests/TE-WM-1/pdf?clientName=Tampered&download=1"), context);
    const body = new Uint8Array(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(getHygieneManifestPdfData).toHaveBeenCalledWith(user, "TE-WM-1");
    expect(generateHygieneManifestPdf).toHaveBeenCalledWith(data);
    expect(Array.from(body)).toEqual([37, 80, 68, 70]);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe("attachment; filename=\"Torque-Empire_Hygiene_Client_Site_Waste-Manifest_TE-WM-1_2026-07-10.pdf\"");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store, max-age=0");
  });

  it("opens manifest PDFs inline for view requests", async () => {
    const response = await manifestPdfGET(request(), context);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe("inline; filename=\"Torque-Empire_Hygiene_Client_Site_Waste-Manifest_TE-WM-1_2026-07-10.pdf\"");
  });

  it("returns safe 404 when the manifest does not exist", async () => {
    (getHygieneManifestPdfData as jest.Mock).mockRejectedValue(new Error("Hygiene manifest was not found."));

    const response = await manifestPdfGET(request(), context);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Hygiene manifest was not found.");
    expect(generateHygieneManifestPdf).not.toHaveBeenCalled();
  });

  it("sanitizes manifest PDF server errors before returning them to clients", async () => {
    (getHygieneManifestPdfData as jest.Mock).mockRejectedValue(new Error("Firestore document path hygiene/internal/secret"));

    const response = await manifestPdfGET(request(), context);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Hygiene manifest PDF request failed");
    expect(body.error).not.toContain("Firestore");
    expect(body.error).not.toContain("secret");
  });

  it("requires authentication before returning client packs", async () => {
    (requireAuthorizedUser as jest.Mock).mockRejectedValue(new AuthorizationError("unauthorized", 401));

    const response = await clientPackGET(request("https://teos.example.test/api/hygiene/manifests/TE-WM-1/client-pack"), context);

    expect(response.status).toBe(401);
    expect(getHygieneManifestPdfData).not.toHaveBeenCalled();
  });

  it("builds client packs from canonical server data", async () => {
    const response = await clientPackGET(request("https://teos.example.test/api/hygiene/manifests/TE-WM-1/client-pack?manifestId=OTHER"), context);
    const body = new Uint8Array(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(getHygieneManifestPdfData).toHaveBeenCalledWith(user, "TE-WM-1");
    expect(generateHygieneClientPackPdf).toHaveBeenCalledWith(data, null);
    expect(Array.from(body)).toEqual([37, 80, 68, 70]);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe("attachment; filename=\"Torque-Empire_Hygiene_Client_Site_Client-Pack_Waste-Manifest_TE-WM-1_2026-07-10.pdf\"");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store, max-age=0");
  });

  it("downloads governed certificate evidence through the lightweight storage helper", async () => {
    (getHygieneManifestPdfData as jest.Mock).mockResolvedValue({
      ...data,
      disposalEvidence: [
        {
          category: "Disposal Certificate",
          storagePath: "hygiene/evidence/TE-CLI-1/TE-COL-1/certificate.pdf",
          fileUrl: "hygiene/evidence/TE-CLI-1/TE-COL-1/certificate.pdf",
        },
      ],
    });

    const response = await clientPackGET(request("https://teos.example.test/api/hygiene/manifests/TE-WM-1/client-pack"), context);

    expect(response.status).toBe(200);
    expect(downloadFirebaseStorageObject).toHaveBeenCalledWith("hygiene/evidence/TE-CLI-1/TE-COL-1/certificate.pdf");
    expect(generateHygieneClientPackPdf).toHaveBeenCalledWith(expect.any(Object), Uint8Array.from(Buffer.from("certificate")));
  });

  it("keeps the client-pack route clear of Firebase Admin Storage imports", () => {
    const routeSource = fs.readFileSync(
      path.join(process.cwd(), "src/app/api/hygiene/manifests/[manifestId]/client-pack/route.ts"),
      "utf8",
    );

    expect(routeSource).not.toContain("getFirebaseStorageBucket");
    expect(routeSource).not.toContain("@/lib/firebase/admin");
    expect(routeSource).toContain("@/lib/firebase/storageRest");
  });

  it("returns safe 404 when a client pack manifest does not exist", async () => {
    (getHygieneManifestPdfData as jest.Mock).mockRejectedValue(new Error("Hygiene manifest was not found."));

    const response = await clientPackGET(request("https://teos.example.test/api/hygiene/manifests/TE-WM-1/client-pack"), context);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Hygiene manifest was not found.");
    expect(generateHygieneClientPackPdf).not.toHaveBeenCalled();
  });

  it("sanitizes client-pack server errors before returning them to clients", async () => {
    (getHygieneManifestPdfData as jest.Mock).mockRejectedValue(new Error("storagePath=hygiene/evidence/private.pdf"));

    const response = await clientPackGET(request("https://teos.example.test/api/hygiene/manifests/TE-WM-1/client-pack"), context);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Hygiene client pack request failed");
    expect(body.error).not.toContain("storagePath");
    expect(body.error).not.toContain("private.pdf");
  });
});
