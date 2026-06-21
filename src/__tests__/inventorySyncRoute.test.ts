const requireAuthorizedUser = jest.fn();
const synchronizeRoarInventory = jest.fn();

jest.mock("@/lib/server/authz", () => {
  const actual = jest.requireActual("@/lib/server/authz");
  return {
    ...actual,
    requireAuthorizedUser: (...args: unknown[]) => requireAuthorizedUser(...args),
  };
});

jest.mock("@/lib/vehicle-finance/inventory/durableInventorySync", () => {
  class InventorySyncInProgressError extends Error {}
  return {
    InventorySyncInProgressError,
    synchronizeRoarInventory: (...args: unknown[]) => synchronizeRoarInventory(...args),
  };
});

import { GET, POST } from "@/app/api/vehicle-finance/inventory-sync/route";

describe("inventory synchronization route", () => {
  const previousCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = "test-cron-secret";
    synchronizeRoarInventory.mockResolvedValue({ status: "SUCCEEDED", totalVehiclesStored: 2 });
  });

  afterAll(() => {
    process.env.CRON_SECRET = previousCronSecret;
  });

  test("requires the configured cron bearer secret", async () => {
    const unauthorized = await GET(new Request("http://localhost/api/vehicle-finance/inventory-sync") as never);
    expect(unauthorized.status).toBe(401);

    const authorized = await GET(
      new Request("http://localhost/api/vehicle-finance/inventory-sync", {
        headers: { authorization: "Bearer test-cron-secret" },
      }) as never,
    );
    expect(authorized.status).toBe(200);
    expect(synchronizeRoarInventory).toHaveBeenCalledWith({ actorId: "vercel-cron", actorRole: "system" });
  });

  test("restricts manual synchronization to vehicle finance staff roles", async () => {
    requireAuthorizedUser.mockResolvedValue({ uid: "dealer-1", role: "dealerPilot", email: "dealer@example.com" });
    const denied = await POST(new Request("http://localhost/api/vehicle-finance/inventory-sync", { method: "POST" }) as never);
    expect(denied.status).toBe(403);

    requireAuthorizedUser.mockResolvedValue({ uid: "staff-1", role: "vehicleFinanceStaff", email: "staff@example.com" });
    const allowed = await POST(new Request("http://localhost/api/vehicle-finance/inventory-sync", { method: "POST" }) as never);
    expect(allowed.status).toBe(200);
  });
});
