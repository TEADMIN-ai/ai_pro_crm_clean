const set = jest.fn();
const doc = jest.fn(() => ({ id: "generated-contractor-id", set }));
const collection = jest.fn(() => ({ doc }));
const getFirebaseAdmin = jest.fn(() => ({ collection }));

jest.mock("@/lib/firebase/admin", () => ({
  getFirebaseAdmin: () => getFirebaseAdmin(),
}));

jest.mock("@/server/services/auditLogService", () => ({
  recordAuditLog: jest.fn(),
}));

import { createContractor } from "@/server/services/contractorService";

function writtenContractor() {
  return set.mock.calls[0][0] as Record<string, unknown>;
}

describe("contractorService business identity creation", () => {
  beforeEach(() => {
    set.mockReset().mockResolvedValue(undefined);
    doc.mockClear();
    collection.mockClear();
    getFirebaseAdmin.mockClear();
  });

  it("rejects missing identity instead of writing Unnamed Contractor", async () => {
    await expect(createContractor({ email: "contractor@example.com" })).rejects.toThrow("Verified contractor business identity is required");
    expect(set).not.toHaveBeenCalled();
  });

  it("rejects placeholders and personal names as business identity", async () => {
    await expect(createContractor({ companyName: "Unknown" })).rejects.toThrow("Verified contractor business identity is required");
    await expect(createContractor({ companyName: "Mr K" })).rejects.toThrow("Verified contractor business identity is required");
    expect(set).not.toHaveBeenCalled();
  });

  it("rejects email local-part and document id as business identity", async () => {
    await expect(createContractor({ companyName: "contractor", email: "contractor@example.com" })).rejects.toThrow("Verified contractor business identity is required");
    await expect(createContractor({ companyName: "generated-contractor-id", id: "generated-contractor-id" })).rejects.toThrow("Verified contractor business identity is required");
    expect(set).not.toHaveBeenCalled();
  });

  it("writes verified legal name and preserves trading name fallback", async () => {
    await createContractor({ legalName: "Empire Civil Pty Ltd", tradingName: "Empire Civil", email: "ops@example.com" });
    expect(writtenContractor()).toEqual(expect.objectContaining({
      legalName: "Empire Civil Pty Ltd",
      tradingName: "Empire Civil",
      name: "Empire Civil Pty Ltd",
      identityResolved: true,
      identityStatus: "VERIFIED",
    }));
  });

  it("uses explicit trading name only when supplied as business identity", async () => {
    await createContractor({ tradingName: "Empire Civil Trading", email: "ops@example.com" });
    expect(writtenContractor()).toEqual(expect.objectContaining({
      tradingName: "Empire Civil Trading",
      companyName: "Empire Civil Trading",
      name: "Empire Civil Trading",
      identityResolved: true,
    }));
  });

  it("fails closed on conflicting business evidence", async () => {
    await expect(createContractor({
      legalName: "Empire Civil Pty Ltd",
      companyName: "Different Supplier Pty Ltd",
    })).rejects.toThrow("Contractor business identity evidence is conflicting");
    expect(set).not.toHaveBeenCalled();
  });

  it("can explicitly create unresolved records without names or default workspace", async () => {
    await createContractor({ allowUnresolvedIdentity: true, email: "contractor@example.com" }, { uid: "staff-1", email: "staff@example.com", role: "admin" });
    const contractor = writtenContractor();

    expect(contractor.identityResolved).toBe(false);
    expect(contractor.identityStatus).toBe("UNRESOLVED");
    expect(contractor.workspaceId).toBeNull();
    expect(contractor.companyName).toBeUndefined();
    expect(contractor.name).toBeUndefined();
    expect(JSON.stringify(contractor)).not.toContain("Unnamed Contractor");
  });
});

describe("contractorService unresolved identity sanitization", () => {
  beforeEach(() => {
    set.mockReset().mockResolvedValue(undefined);
    doc.mockClear();
    collection.mockClear();
    getFirebaseAdmin.mockClear();
  });

  it("strips unsafe business identity fields from explicitly unresolved records", async () => {
    await createContractor({
      allowUnresolvedIdentity: true,
      email: "contractor@example.com",
      legalName: "Mr K",
      tradingName: "Contractor",
      businessName: "contractor",
      companyName: "Unknown",
      name: "generated-contractor-id",
    }, { uid: "staff-1", email: "staff@example.com", role: "admin" });
    const contractor = writtenContractor();

    expect(contractor.identityResolved).toBe(false);
    expect(contractor.legalName).toBeUndefined();
    expect(contractor.tradingName).toBeUndefined();
    expect(contractor.businessName).toBeUndefined();
    expect(contractor.companyName).toBeUndefined();
    expect(contractor.name).toBeUndefined();
    expect(JSON.stringify(contractor)).not.toContain("Mr K");
    expect(JSON.stringify(contractor)).not.toContain("Unknown");
    expect(JSON.stringify(contractor)).not.toContain("Unnamed Contractor");
  });
});
