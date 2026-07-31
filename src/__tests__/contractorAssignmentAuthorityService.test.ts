import { evaluateContractorAssignmentAuthority } from "@/server/services/contractorAssignmentAuthorityService";

const getFirebaseAdmin = jest.fn();
jest.mock("@/lib/firebase/admin", () => ({ getFirebaseAdmin: () => getFirebaseAdmin() }));

type R = Record<string, unknown>;
type Store = Record<string, Record<string, R>>;
const logicVersion = "contractor-repository-decision-v1";
const actor = { uid: "staff-1", email: "staff@example.com", role: "staff" as const };
const dealId = "deal-1";
const contractorId = "c1";
function snap(id: string, data?: R) { return { id, exists: Boolean(data), data: () => data }; }

function db(initial: Store) {
  const store: Store = structuredClone(initial);
  const writes: string[] = [];
  const read = (path: string) => store[path] ?? {};
  const query = (path: string, filters: Array<{ field: string; value: unknown }> = [], max: number | null = null): unknown => ({
    where: (field: string, _op: string, value: unknown) => query(path, [...filters, { field, value }], max),
    limit: (n: number) => query(path, filters, n),
    orderBy: jest.fn().mockReturnThis(),
    get: jest.fn(async () => { let e = Object.entries(read(path)); for (const f of filters) e = e.filter(([, d]) => d[f.field] === f.value); if (max !== null) e = e.slice(0, max); return { docs: e.map(([id, data]) => snap(id, data)) }; }),
  });
  const collection = (path: string): unknown => ({
    doc: (id: string) => ({
      get: jest.fn(async () => snap(id, read(path)[id])),
      set: jest.fn(async (data: R) => { store[path] = store[path] ?? {}; store[path][id] = data; writes.push(path + "/" + id); }),
      collection: (name: string) => collection(path + "/" + id + "/" + name),
    }),
    add: jest.fn(async (data: R) => { const id = "auto-" + (Object.keys(read(path)).length + 1); store[path] = store[path] ?? {}; store[path][id] = data; writes.push(path + "/" + id); return { id }; }),
    where: (field: string, _op: string, value: unknown) => query(path, [{ field, value }]),
    limit: (n: number) => query(path, [], n),
    orderBy: jest.fn().mockReturnThis(),
    get: jest.fn(async () => ({ docs: Object.entries(read(path)).filter(([, v]) => v !== undefined).map(([id, data]) => snap(id, data)) })),
  });
  return { collection: jest.fn(collection), store, writes };
}
function deal(o: R = {}) { return { id: dealId, workspaceId: "workspace-a", opportunityExecution: { currentPhase: "MATCHING_REQUIRED", requirementsReviewed: true, requirements: { reviewed: true, taxRequirement: true, csdRequirement: true, bbbeeRequirement: false, coidaRequirement: false, bankingRequirement: false, compulsoryReturnables: ["Tax compliance", "CSD"] } }, tenderAnalysis: { requiredCertificates: ["Tax compliance", "CSD"] }, ...o }; }
function contractor(o: R = {}) { return { id: contractorId, contractorId, legalName: "Clean Co Pty Ltd", companyName: "Clean Co Pty Ltd", workspaceId: "workspace-a", status: "active", csdNumber: "MAAA1234567", companyRegistrationNumber: "2020/123456/07", decisionEvaluatedAt: "2026-07-17T09:59:00.000Z", decisionLogicVersion: logicVersion, updatedAt: "2026-07-17T09:00:00.000Z", documentVault: [doc("taxClearance")], sarsTcsSummary: sars(), ...o }; }
function doc(t: string, o: R = {}) { return { id: t, contractorId, workspaceId: "workspace-a", documentType: t, fileUrl: "https://x/" + t + ".pdf", verified: true, verifiedAt: "2026-07-17T09:20:00.000Z", uploadedAt: "2026-07-17T09:10:00.000Z", expiresAt: Date.parse("2026-09-01T00:00:00.000Z"), status: "verified", ...o }; }
function docs(o: Record<string, R> = {}) { return { cipc: doc("cipc", o.cipc), bbbee: doc("bbbee", o.bbbee), taxClearance: doc("taxClearance", o.taxClearance), coida: doc("coida", o.coida), bankConfirmation: doc("bankConfirmation", o.bankConfirmation), csd: doc("csd", o.csd) }; }
function sars(o: R = {}) { return { id: "sars-1", workspaceId: "workspace-a", contractorId, taxReferenceNumber: "999", registeredTaxpayerName: "Clean Co Pty Ltd", pinLastFour: "1234", pinStatus: "ACTIVE", consentConfirmed: true, verificationStatus: "VERIFIED_COMPLIANT", source: "SARS_SOQS", verifiedAt: "2026-07-17T09:30:00.000Z", recheckDueAt: "2026-08-17T09:30:00.000Z", taxpayerNameMatch: "MATCH", taxReferenceMatch: "MATCH", registrationNumberMatch: "MATCH", contractorIdentityMatch: "MATCH", mismatchReasons: [], verificationEvidenceHash: "hash", createdAt: "2026-07-17T09:00:00.000Z", updatedAt: "2026-07-17T09:30:00.000Z", createdBy: "staff-1", version: 1, auditTrail: [], ...o }; }
function seed(o: { deal?: R; contractor?: R; documents?: Record<string, R>; sars?: R | null; actorWorkspaceId?: string } = {}) { const sr = o.sars === undefined ? sars() : o.sars; return db({ users: { "staff-1": { workspaceId: o.actorWorkspaceId ?? "workspace-a" } }, deals: { [dealId]: o.deal ?? deal() }, contractors: { [contractorId]: o.contractor ?? contractor() }, ["contractors/" + contractorId + "/documents"]: o.documents ?? docs(), ["contractors/" + contractorId + "/sarsTcs"]: sr ? { "sars-1": sr } : {}, opportunityExecutionWorkspaces: {}, submissionReviews: {}, auditLogs: {}, ["deals/" + dealId + "/activity"]: {} }); }
async function evalDecision(database = seed(), nextActor: typeof actor | { uid: string; email: string; role: "contractor" } = actor) { getFirebaseAdmin.mockReturnValue(database); return evaluateContractorAssignmentAuthority({ dealId, contractorReference: contractorId, actor: nextActor, targetPhase: "COMPLIANCE_REVIEW" }); }
describe("contractor assignment authority service", () => {
  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date("2026-07-17T10:00:00.000Z")); getFirebaseAdmin.mockReset(); });
  afterEach(() => jest.useRealTimers());
  test("allows assignment only from bounded canonical subcollection evidence", async () => {
    const database = seed();
    const decision = await evalDecision(database);
    expect(decision.status).toBe("ALLOWED");
    expect(decision.blockers).toEqual([]);
    expect(decision.contractorId).toBe(contractorId);
    expect(decision.decisionLogicVersion).toBe(logicVersion);
    expect(database.writes).toEqual([]);
  });
  test("does not accept legacy embedded document arrays as assignment evidence", async () => {
    const database = seed({ documents: {} });
    const decision = await evalDecision(database);
    expect(decision.status).toBe("BLOCKED");
    expect(decision.blockers.join(" ")).toContain("document is missing or unverified");
    expect(database.writes).toEqual([]);
  });
  test.each([
    ["unauthorized POST actor", seed(), { ...actor, role: "contractor" as const }, "Privileged actor role is required"],
    ["unresolved identity", seed({ contractor: contractor({ legalName: null, companyName: contractorId }) }), actor, "Contractor identity is unresolved"],
    ["unresolved workspace", seed({ contractor: contractor({ workspaceId: null }) }), actor, "Contractor workspace is unresolved"],
    ["workspace mismatch", seed({ contractor: contractor({ workspaceId: "workspace-b" }) }), actor, "Contractor workspace does not match deal workspace"],
    ["archived contractor", seed({ contractor: contractor({ archived: true }) }), actor, "Contractor is archived"],
    ["stale readiness", seed({ contractor: contractor({ decisionLogicVersion: "old" }) }), actor, "Stored readiness/compliance summary has missing or outdated logic version"],
    ["assignmentAllowed false", seed({ documents: docs({ taxClearance: { verified: false, verifiedAt: null, status: "uploaded" } }) }), actor, "Canonical repository assignment authority is not ALLOWED"],
    ["missing document", seed({ documents: { ...docs(), bbbee: undefined as unknown as R } as Record<string, R> }), actor, "bbbee document is missing or unverified"],
    ["expired document", seed({ documents: docs({ bbbee: { status: "expired", expiresAt: Date.parse("2026-07-01T00:00:00.000Z") } }) }), actor, "One or more compliance documents are expired"],
    ["invalid CSD", seed({ contractor: contractor({ csdNumber: "MISREPRESENT" }) }), actor, "CSD supplier number is not verified as valid"],
    ["missing SARS", seed({ sars: null }), actor, "SARS TCS supporting evidence is missing"],
    ["review-required SARS", seed({ sars: sars({ verificationStatus: "REVIEW_REQUIRED" }) }), actor, "SARS TCS verification requires review"],
    ["wrong deal phase", seed({ deal: deal({ opportunityExecution: { currentPhase: "REQUIREMENTS_REVIEW", requirementsReviewed: false, requirements: { reviewed: false, taxRequirement: true, csdRequirement: true, compulsoryReturnables: ["Tax compliance", "CSD"] } } }) }), actor, "Deal phase is REQUIREMENTS_REVIEW, not MATCHING_REQUIRED"],
  ])("blocks %s", async (_name, database, nextActor, blocker) => {
    const decision = await evalDecision(database, nextActor);
    expect(decision.status).toBe("BLOCKED");
    expect(decision.blockers).toContain(blocker);
    expect(database.writes).toEqual([]);
  });
});
