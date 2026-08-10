import { readFileSync } from "fs";
import { NextRequest } from "next/server";
import type { UserRole } from "@/lib/auth/roleUtils";
import type { AuthorizedUser } from "@/lib/server/authz";

const mockRequireAuthorizedUser = jest.fn();
const mockAssertHygieneInternalAccess = jest.fn();
const mockFileExists = jest.fn();
const mockGetSignedUrl = jest.fn();
let mockDb: ReturnType<typeof createMockFirestore>;

class MockAuthorizationError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = "AuthorizationError";
    this.status = status;
  }
}

jest.mock("@/lib/server/authz", () => ({
  AuthorizationError: MockAuthorizationError,
  requireAuthorizedUser: (request: NextRequest) => mockRequireAuthorizedUser(request),
}));

jest.mock("@/lib/firebase/admin", () => ({
  getFirebaseAdmin: () => mockDb,
  getFirebaseStorageBucket: () => ({
    file: (storagePath: string) => ({
      exists: () => mockFileExists(storagePath),
      getSignedUrl: (options: unknown) => mockGetSignedUrl(storagePath, options),
    }),
  }),
}));

jest.mock("@/lib/hygiene/hygieneService", () => ({
  HYGIENE_COLLECTIONS: {
    collections: "hygieneCollections",
    signatures: "hygieneSignatures",
    evidencePhotos: "hygieneEvidencePhotos",
    complianceDocuments: "hygieneComplianceDocuments",
  },
  assertHygieneInternalAccess: (user: AuthorizedUser) => mockAssertHygieneInternalAccess(user),
}));

import { GET as HYGIENE_EVIDENCE_ACCESS } from "@/app/api/hygiene/evidence/access/route";
import { categoriseHistoricalHygieneEvidence } from "@/lib/master-data/migrationProposal";
import { classifyEvidenceStorageReference } from "@/lib/master-data/storagePathPolicy";

type StoredData = Record<string, Map<string, Record<string, unknown>>>;

function createMockFirestore(seed: StoredData = {}) {
  const store = seed;
  const ensure = (name: string) => {
    store[name] ??= new Map();
    return store[name];
  };
  return {
    collection: (name: string) => ({
      doc: (id: string) => ({
        async get() {
          const data = ensure(name).get(id);
          return { id, exists: Boolean(data), data: () => data };
        },
      }),
    }),
    _store: store,
  };
}

function seed(collection: string, id: string, data: Record<string, unknown>) {
  mockDb._store[collection] ??= new Map();
  mockDb._store[collection].set(id, data);
}

function request(path: string) {
  return new NextRequest(`https://teos.test${path}`);
}

function staff(overrides: Partial<AuthorizedUser> = {}): AuthorizedUser {
  return { uid: "staff-1", email: "staff@example.test", role: "staff" as UserRole, workspaceId: "workspace-a", ...overrides };
}

describe("Master Data Phase 6 Hygiene evidence adoption cleanup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockFirestore();
    mockRequireAuthorizedUser.mockResolvedValue(staff());
    mockAssertHygieneInternalAccess.mockImplementation((user: AuthorizedUser) => {
      if (!["admin", "manager", "staff", "driver"].includes(user.role)) throw new MockAuthorizationError("unauthorized", 403);
    });
    mockFileExists.mockResolvedValue([true]);
    mockGetSignedUrl.mockResolvedValue(["https://signed.example/evidence"]);
    jest.spyOn(console, "info").mockImplementation(() => undefined);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("legacy references are classified without making signed URLs authoritative", () => {
    expect(classifyEvidenceStorageReference({ storagePath: "hygiene/evidence/COLLECT/path.jpg" })).toMatchObject({ classification: "DURABLE_STORAGE_PATH", reviewStatus: "ACCESS_READY" });
    expect(classifyEvidenceStorageReference({ fileUrl: "https://storage.googleapis.com/bucket/object?token=legacy" })).toMatchObject({ classification: "LEGACY_SIGNED_URL", reviewStatus: "REVIEW_REQUIRED" });
    expect(classifyEvidenceStorageReference({ fileUrl: "gs://bucket/hygiene/evidence/path.jpg" })).toMatchObject({ classification: "LEGACY_SIGNED_URL", reviewStatus: "REVIEW_REQUIRED" });
    expect(classifyEvidenceStorageReference({})).toMatchObject({ classification: "UNRESOLVED_LEGACY_REFERENCE", reviewStatus: "REVIEW_REQUIRED" });
  });

  test("legacy signed URL alone cannot bypass Hygiene collection validation or server access", async () => {
    seed("hygieneCollections", "TE-COL-1", { collectionId: "TE-COL-1", clientId: "TE-CLI-1", siteId: "TE-SIT-1" });
    seed("hygieneSignatures", "TE-SIG-LEGACY", {
      signatureId: "TE-SIG-LEGACY",
      collectionId: "TE-COL-1",
      clientId: "TE-CLI-1",
      siteId: "TE-SIT-1",
      signatureFileUrl: "https://storage.googleapis.com/bucket/legacy-signature.png?token=legacy",
      signatureStoragePath: null,
    });

    const response = await HYGIENE_EVIDENCE_ACCESS(request("/api/hygiene/evidence/access?kind=signature&recordId=TE-SIG-LEGACY&collectionId=TE-COL-1"));
    const payload = await response.json();
    expect(response.status).toBe(409);
    expect(payload).toMatchObject({ reviewStatus: "REVIEW_REQUIRED", classification: "LEGACY_SIGNED_URL" });
    expect(mockGetSignedUrl).not.toHaveBeenCalled();
  });

  test("recoverable durable-path legacy photo opens through server access", async () => {
    seed("hygieneCollections", "TE-COL-1", { collectionId: "TE-COL-1", clientId: "TE-CLI-1", siteId: "TE-SIT-1" });
    seed("hygieneEvidencePhotos", "TE-EP-RECOVERABLE", {
      photoId: "TE-EP-RECOVERABLE",
      collectionId: "TE-COL-1",
      clientId: "TE-CLI-1",
      siteId: "TE-SIT-1",
      category: "Site Arrival",
      fileUrl: "hygiene/evidence/TE-CLI-1/TE-COL-1/TE-EP-RECOVERABLE-photo.jpg",
    });

    const response = await HYGIENE_EVIDENCE_ACCESS(request("/api/hygiene/evidence/access?kind=photo&recordId=TE-EP-RECOVERABLE&collectionId=TE-COL-1"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ accessMode: "signed_url", accessUrl: "https://signed.example/evidence" });
  });

  test("Hygiene UI source uses server-authorized access instead of raw governed evidence URLs", () => {
    const source = readFileSync("src/components/hygiene/HygieneDivisionClient.tsx", "utf8");
    expect(source).toContain("API_ROUTES.HYGIENE_EVIDENCE_ACCESS");
    expect(source).not.toContain("src={photo.fileUrl}");
    expect(source).not.toContain("href={photo.fileUrl}");
    expect(source).not.toContain("href={document.fileUrl}");
  });

  test("historical Hygiene evidence migration proposal is classification-only", () => {
    expect(categoriseHistoricalHygieneEvidence({ recordReference: "photo-1", storagePath: "hygiene/evidence/a/b/file.jpg", documentId: "MDOC-1", hasTrustedRelationship: true }).category).toBe("already_governed");
    expect(categoriseHistoricalHygieneEvidence({ recordReference: "photo-2", storagePath: "hygiene/evidence/a/b/file.jpg", hasTrustedRelationship: true }).category).toBe("storage_path_recoverable");
    expect(categoriseHistoricalHygieneEvidence({ recordReference: "photo-3", fileUrl: "https://storage.example/legacy.jpg", hasTrustedRelationship: true }).category).toBe("legacy_signed_url_recoverable");
    expect(categoriseHistoricalHygieneEvidence({ recordReference: "photo-4", fileUrl: "https://storage.example/legacy.jpg" }).category).toBe("relationship_review_required");
    expect(categoriseHistoricalHygieneEvidence({ recordReference: "photo-5" }).category).toBe("missing_evidence");
  });
});
