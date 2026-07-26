import { NextRequest } from "next/server";

const requireAuthorizedUser = jest.fn();
const contractorDocs: Array<{
  id: string;
  data: Record<string, unknown>;
  documents?: Array<{ id: string; data: Record<string, unknown> }>;
}> = [];

class MockAuthorizationError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

jest.mock("firebase-admin/auth", () => ({ getAuth: jest.fn() }));

jest.mock("@/lib/server/authz", () => ({
  AuthorizationError: MockAuthorizationError,
  assertPrivilegedRole: (user: { role?: string }) => {
    if (!["admin", "manager", "staff"].includes(user.role ?? "")) {
      throw new MockAuthorizationError("unauthorized", 403);
    }
  },
  requireAuthorizedUser: (...args: unknown[]) => requireAuthorizedUser(...args),
}));

jest.mock("@/lib/firebase/admin", () => ({
  getFirebaseAdmin: () => ({
    collection: (name: string) => {
      if (name !== "contractors") throw new Error(`Unexpected collection ${name}`);
      return {
        get: jest.fn(async () => ({
          docs: contractorDocs.map((doc) => ({
            id: doc.id,
            data: () => doc.data,
          })),
        })),
        doc: jest.fn((contractorId: string) => ({
          collection: jest.fn(() => ({
            get: jest.fn(async () => ({
              docs: (contractorDocs.find((doc) => doc.id === contractorId || doc.data.contractorId === contractorId)?.documents ?? []).map((doc) => ({
                id: doc.id,
                data: () => doc.data,
              })),
            })),
          })),
        })),
      };
    },
  }),
}));

jest.mock("@/server/services/auditLogService", () => ({ recordAuditLog: jest.fn() }));
jest.mock("@/lib/contractors/contractorAuthLink", () => ({ ensureContractorAuthLinkage: jest.fn() }));
jest.mock("@/lib/email/contractorOnboardingEmail", () => ({ sendContractorOnboardingEmail: jest.fn() }));

import { GET } from "@/app/api/contractors/route";

const publicContractorKeys = [
  "id",
  "contractorId",
  "workspaceId",
  "companyName",
  "tradingName",
  "contractorReference",
  "registrationNumber",
  "csdNumber",
  "status",
  "overallStatus",
  "documentSummary",
  "assignmentSummary",
  "reviewSummary",
  "identityStatus",
  "identityResolved",
  "identityMatchStatus",
  "documentCompletenessScore",
  "complianceDecisionStatus",
  "readinessScore",
  "readinessDecisionStatus",
  "assignmentAllowed",
  "blockingReasons",
  "externalVerificationStatus",
  "csdValidationStatus",
  "evaluatedAt",
  "logicVersion",
  "stale",
  "historicalDecision"
];

function request(path: string) {
  return new NextRequest(`http://localhost${path}`);
}

function verifiedDocument(type: string) {
  return {
    id: type,
    data: {
      contractorId: "internal-id",
      documentType: type,
      fileUrl: `https://example.com/${type}.pdf`,
      verified: true,
      verifiedAt: Date.parse("2026-07-22T08:00:00.000Z"),
      updatedAt: Date.parse("2026-07-22T08:00:00.000Z"),
    },
  };
}

function addLegacyMrKRecord() {
  contractorDocs.push({
    id: "internal-id",
    data: {
      id: "internal-id",
      contractorId: "internal-id",
      companyName: "Mr K",
      contactPerson: "Mr K",
      userId: "internal-user-id",
      uid: "internal-user-id",
      authUid: "internal-user-id",
      email: "redacted@example.com",
      status: "restored",
      workspaceId: "workspace-a",
      complianceScore: 100,
      complianceStatus: "complete",
      readinessStatus: "READY",
      readinessDecisionStatus: "READY",
      readinessScore: 100,
      documents: {},
      sarsTcsSummary: { status: "PENDING" },
      recordClassification: "PRODUCTION",
      taxpayerName: "TORQUE EMPIRE",
      csdNumber: "MISREPRESENT",
      overallStatus: "Approved / Compliant",
      futureRawFirestoreField: "must-not-leak",
    },
    documents: [
      verifiedDocument("cipc"),
      verifiedDocument("bbbee"),
      verifiedDocument("taxClearance"),
      verifiedDocument("coida"),
      verifiedDocument("bankConfirmation"),
    ],
  });
}

describe("/api/contractors canonical repository route projection", () => {
  beforeEach(() => {
    contractorDocs.length = 0;
    jest.clearAllMocks();
    requireAuthorizedUser.mockResolvedValue({ uid: "staff-1", role: "staff", workspaceId: "workspace-a" });
  });

  test("default route serializes canonical fail-closed contractor decisions", async () => {
    addLegacyMrKRecord();

    const response = await GET(request("/api/contractors"));
    const body = await response.json();
    const contractor = body[0];

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0, must-revalidate");
    expect(response.headers.get("x-teos-contractor-contract-version")).toBe("contractor-repository-public-v2");
    expect(Object.keys(contractor).sort()).toEqual([...publicContractorKeys].sort());
    expect(contractor).toMatchObject({
      id: "internal-id",
      contractorId: "internal-id",
      workspaceId: "workspace-a",
      identityStatus: "CONFLICT",
      identityMatchStatus: "CONFLICT",
      readinessScore: null,
      assignmentAllowed: false,
      overallStatus: "Blocked / Identity conflict",
      csdValidationStatus: "INVALID",
      externalVerificationStatus: "PENDING",
    });
    expect(contractor.readinessDecisionStatus).not.toBe("READY");
    expect(contractor.assignmentSummary).toMatchObject({ status: "BLOCKED", assignmentAllowed: false });
    expect(contractor.reviewSummary.reviewRequiredCount).toBe(0);
    expect(contractor.documentSummary.docsMissing).toBe(0);
    expect(contractor.historicalDecision).toMatchObject({
      readinessScore: 100,
      readinessStatus: "READY",
      complianceStatus: "complete",
      overallStatus: "Approved / Compliant",
    });
    expect(contractor.blockingReasons).toEqual(expect.arrayContaining([
      "SARS taxpayer name does not match contractor business identity",
      "SARS TCS PIN has not been verified live",
      "CSD supplier number is not verified as valid",
    ]));
    expect(contractor).not.toHaveProperty("authUid");
    expect(contractor).not.toHaveProperty("userId");
    expect(contractor).not.toHaveProperty("uid");
    expect(contractor).not.toHaveProperty("futureRawFirestoreField");
  });

  test("deal assignment selector path uses the same sanitized repository contract", async () => {
    addLegacyMrKRecord();
    contractorDocs.push({
      id: "contractor-valid",
      data: {
        id: "contractor-valid",
        contractorId: "contractor-valid",
        workspaceId: "workspace-a",
        role: "contractor",
        status: "active",
        legalName: "Empire Civil Pty Ltd",
        tradingName: "Empire Civil",
        identityResolved: true,
        identityStatus: "VERIFIED",
      },
      documents: [],
    });

    const response = await GET(request("/api/contractors?purpose=dealAssignmentSelector"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0, must-revalidate");
    expect(JSON.stringify(body)).not.toContain("internal-user-id");
    expect(JSON.stringify(body)).not.toContain("redacted@example.com");
    expect(JSON.stringify(body)).not.toContain("futureRawFirestoreField");
    expect(body.contractors).toEqual([
      expect.objectContaining({
        contractorId: "contractor-valid",
        workspaceId: "workspace-a",
        label: "Empire Civil Pty Ltd",
      }),
    ]);
  });
});
