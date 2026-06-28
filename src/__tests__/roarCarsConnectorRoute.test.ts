const requireAuthorizedUser = jest.fn();
const retrySync = jest.fn();

jest.mock("@/lib/server/authz", () => {
  const actual = jest.requireActual("@/lib/server/authz");
  return {
    ...actual,
    requireAuthorizedUser: (...args: unknown[]) => requireAuthorizedUser(...args),
  };
});

jest.mock("@/lib/vehicle-finance/inventory/roarCarsConnector", () => ({
  retrySync: (...args: unknown[]) => retrySync(...args),
}));

jest.mock("@/lib/vehicle-finance/inventory/durableInventorySync", () => ({
  InventorySyncInProgressError: class InventorySyncInProgressError extends Error {},
}));

import { POST } from "@/app/api/vehicle-finance/inventory/connector/sync/route";

describe("Roar Cars connector route authorization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    retrySync.mockResolvedValue({ result: { status: "SUCCEEDED" }, config: {}, health: {} });
  });

  test("blocks non-staff connector sync access", async () => {
    requireAuthorizedUser.mockResolvedValue({ uid: "dealer-1", role: "dealerPilot", email: "dealer@example.com" });
    const response = await POST(new Request("http://localhost/api/vehicle-finance/inventory/connector/sync", { method: "POST" }) as never);
    expect(response.status).toBe(403);
    expect(retrySync).not.toHaveBeenCalled();
  });

  test("allows staff connector sync access", async () => {
    requireAuthorizedUser.mockResolvedValue({ uid: "staff-1", role: "ROAR_CARS_STAFF", email: "staff@example.com" });
    const response = await POST(new Request("http://localhost/api/vehicle-finance/inventory/connector/sync", { method: "POST" }) as never);
    expect(response.status).toBe(200);
    expect(retrySync).toHaveBeenCalledWith({ actorId: "staff-1", actorEmail: "staff@example.com", actorRole: "ROAR_CARS_STAFF" });
  });
});
