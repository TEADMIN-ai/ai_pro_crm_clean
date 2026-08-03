import { NextRequest } from "next/server"

const requireAuthorizedUser = jest.fn()
const resolveContractorForAccess = jest.fn()
const updateContractorById = jest.fn()
const logActivity = jest.fn()

class MockAuthorizationError extends Error {
  status: number

  constructor(message: string, status = 403) {
    super(message)
    this.status = status
  }
}

jest.mock("@/lib/server/authz", function () {
  return {
    AuthorizationError: MockAuthorizationError,
    assertCanAccessContractor: jest.fn(),
    isPrivilegedRole: function (role?: string) { return ["admin", "manager", "staff"].includes(role ? role : "") },
    requireAuthorizedUser: function (request: unknown) { return requireAuthorizedUser(request) },
  }
})

jest.mock("@/server/services/contractorService", function () {
  return {
    listContractorDocuments: jest.fn(),
    resolveContractorForAccess: function (input: unknown) { return resolveContractorForAccess(input) },
    updateContractorById: function (contractorId: unknown, updates: unknown) { return updateContractorById(contractorId, updates) },
  }
})

jest.mock("@/lib/activity/logActivity", function () {
  return {
    logActivity: function (input: unknown) { return logActivity(input) },
  }
})

import { PATCH } from "@/app/api/contractors/[contractorId]/route"

function request(body: unknown) {
  return new NextRequest("http://localhost/api/contractors/contractor-a", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

function params(contractorId = "contractor-a") {
  return { params: Promise.resolve({ contractorId }) }
}

function resolvedContractor(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    contractorId: "contractor-a",
    storedReference: "contractor-a",
    referenceType: "firestore_document_id",
    workspaceId: "workspace-a",
    contractor: { id: "contractor-a", contractorId: "contractor-a", workspaceId: "workspace-a", ...overrides },
  }
}

function expectNoMutation() {
  expect(updateContractorById).not.toHaveBeenCalled()
  expect(logActivity).not.toHaveBeenCalled()
}


describe("PATCH contractor hardened access", function () {
  beforeEach(function () {
    jest.clearAllMocks()
    requireAuthorizedUser.mockResolvedValue({ uid: "staff-1", email: "staff@example.test", role: "staff", workspaceId: "workspace-a" })
    resolveContractorForAccess.mockResolvedValue(resolvedContractor())
  })

  it.each(["staff", "manager", "admin"])("allows same-workspace %s users to update safe fields", async function (role) {
    requireAuthorizedUser.mockResolvedValue({ uid: role + "-1", email: role + "@example.test", role, workspaceId: "workspace-a" })
    const response = await PATCH(request({ contactPerson: "Ops Lead", phone: "+27000000000", serviceCategories: ["hygiene"] }), params())
    expect(response.status).toBe(200)
    expect(resolveContractorForAccess).toHaveBeenCalledWith({ contractorReference: "contractor-a", actor: expect.objectContaining({ role, workspaceId: "workspace-a" }), expectedWorkspaceId: "workspace-a", logContext: "api.contractors.patch" })
    expect(updateContractorById).toHaveBeenCalledWith("contractor-a", { contactPerson: "Ops Lead", phone: "+27000000000", serviceCategories: ["hygiene"] })
    expect(logActivity).toHaveBeenCalledWith({ contractorId: "contractor-a", action: "Contractor updated", performedBy: role + "@example.test" })
  })

  it.each(["staff", "manager", "admin"])("rejects cross-workspace %s updates", async function (role) {
    requireAuthorizedUser.mockResolvedValue({ uid: role + "-1", email: role + "@example.test", role, workspaceId: "workspace-a" })
    resolveContractorForAccess.mockResolvedValue({ ok: false, failureReason: "cross_workspace", contractorId: "contractor-b", matchedField: "id", candidateCount: 1 })
    const response = await PATCH(request({ phone: "+27000000000" }), params("contractor-b"))
    expect(response.status).toBe(403)
    expectNoMutation()
  })

  it("rejects unauthenticated PATCH requests", async function () {
    requireAuthorizedUser.mockRejectedValue(new MockAuthorizationError("authentication required", 401))
    const response = await PATCH(request({ phone: "+27000000000" }), params())
    const body = await response.json()
    expect(response.status).toBe(401)
    expect(body.error).toBe("authentication required")
    expect(resolveContractorForAccess).not.toHaveBeenCalled()
    expectNoMutation()
  })


  it("handles missing ambiguous and unauthorised references before update", async function () {
    for (const item of [["not_found", 404], ["ambiguous", 404], ["unauthorized_contractor", 403]]) {
      jest.clearAllMocks()
      requireAuthorizedUser.mockResolvedValue({ uid: "staff-1", email: "staff@example.test", role: "staff", workspaceId: "workspace-a" })
      resolveContractorForAccess.mockResolvedValue({ ok: false, failureReason: item[0], contractorId: null, matchedField: null, candidateCount: item[0] === "ambiguous" ? 2 : 0 })
      const response = await PATCH(request({ phone: "+27000000000" }), params("contractor-ref"))
      expect(response.status).toBe(item[1])
      expectNoMutation()
    }
  })

  it("rejects contractor users and missing actor workspace before contractor resolution", async function () {
    for (const actor of [{ uid: "contractor-user", email: "owner@example.test", role: "contractor", workspaceId: "workspace-a", contractorId: "contractor-a" }, { uid: "staff-1", email: "staff@example.test", role: "staff" }]) {
      jest.clearAllMocks()
      requireAuthorizedUser.mockResolvedValue(actor)
      const response = await PATCH(request({ phone: "+27000000000" }), params())
      expect(response.status).toBe(403)
      expect(resolveContractorForAccess).not.toHaveBeenCalled()
      expectNoMutation()
    }
  })

  it("rejects missing target workspace and post-resolution workspace mismatch", async function () {
    for (const item of [["", "Contractor workspace is unresolved"], ["workspace-b", "Cross-workspace contractor update rejected"]]) {
      jest.clearAllMocks()
      requireAuthorizedUser.mockResolvedValue({ uid: "staff-1", email: "staff@example.test", role: "staff", workspaceId: "workspace-a" })
      resolveContractorForAccess.mockResolvedValue(resolvedContractor({ workspaceId: item[0] }))
      const response = await PATCH(request({ phone: "+27000000000" }), params())
      const body = await response.json()
      expect(response.status).toBe(403)
      expect(body.error).toBe(item[1])
      expectNoMutation()
    }
  })


  it.each(["workspaceId", "contractorId", "userId", "linkedUserId", "identityResolved", "legalName", "registrationNumber", "readinessScore", "complianceStatus", "assignmentAllowed", "recommendation", "sarsTcsSummary", "csdStatus", "approvedAt", "governance"])("rejects protected field %s before update", async function (field) {
    const response = await PATCH(request({ [field]: "blocked" }), params())
    const body = await response.json()
    expect(response.status).toBe(400)
    expect(body.error).toBe("Protected contractor fields cannot be updated through this route")
    expect(body.fields).toEqual([field])
    expectNoMutation()
  })

  it("rejects unknown and mixed safe protected updates before update", async function () {
    const unknown = await PATCH(request({ unsupportedField: "value" }), params())
    expect(unknown.status).toBe(400)
    expect(await unknown.json()).toEqual({ success: false, error: "Unsupported contractor update fields", fields: ["unsupportedField"] })
    expectNoMutation()
    jest.clearAllMocks()
    requireAuthorizedUser.mockResolvedValue({ uid: "staff-1", email: "staff@example.test", role: "staff", workspaceId: "workspace-a" })
    resolveContractorForAccess.mockResolvedValue(resolvedContractor())
    const mixed = await PATCH(request({ phone: "+27000000000", readinessScore: 100 }), params())
    expect(mixed.status).toBe(400)
    expect((await mixed.json()).fields).toEqual(["readinessScore"])
    expectNoMutation()
  })

  it("returns controlled errors without stack traces", async function () {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(function () { return undefined })
    updateContractorById.mockRejectedValue(new Error("firestore internal path"))
    const response = await PATCH(request({ phone: "+27000000000" }), params())
    const body = await response.json()
    expect(response.status).toBe(500)
    expect(body).toEqual({ success: false, error: "Update failed" })
    expect(JSON.stringify(body)).not.toContain("firestore internal path")
    expect(logActivity).not.toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})
