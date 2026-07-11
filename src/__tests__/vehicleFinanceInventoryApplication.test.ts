const requireAuthorizedUser = jest.fn();
const createVehicleFinanceApplication = jest.fn();
const sendVehicleFinanceApplicationNotification = jest.fn();
const getAvailableInventoryVehicle = jest.fn();
const getFirebaseAdmin = jest.fn();

jest.mock("@/lib/server/authz", () => {
  const actual = jest.requireActual("@/lib/server/authz");
  return {
    ...actual,
    requireAuthorizedUser: (...args: unknown[]) => requireAuthorizedUser(...args),
  };
});

jest.mock("@/lib/firebase/admin", () => ({
  getFirebaseAdmin: (...args: unknown[]) => getFirebaseAdmin(...args),
}));

jest.mock("@/lib/vehicleFinance/vehicleFinanceService", () => ({
  createVehicleFinanceApplication: (...args: unknown[]) => createVehicleFinanceApplication(...args),
  listVehicleFinanceApplications: jest.fn(),
}));

jest.mock("@/lib/vehicle-finance/notifications/vehicleFinanceApplicationNotification", () => ({
  sendVehicleFinanceApplicationNotification: (...args: unknown[]) => sendVehicleFinanceApplicationNotification(...args),
}));

jest.mock("@/lib/vehicle-finance/inventory/durableInventorySync", () => ({
  getAvailableInventoryVehicle: (...args: unknown[]) => getAvailableInventoryVehicle(...args),
}));

import { POST } from "@/app/api/vehicle-finance/applications/route";

function createDb(existing = false) {
  return {
    collection: jest.fn((name: string) => {
      if (name === "vehicleFinanceApplications") {
        return {
          where: jest.fn(() => ({
            limit: jest.fn(() => ({
              get: jest.fn(async () => existing ? { empty: false, docs: [{ id: "application-existing", data: () => ({ clientSubmissionId: "submission-1" }) }] } : { empty: true, docs: [] }),
            })),
          })),
        };
      }
      return {};
    }),
  };
}

describe("vehicle finance application inventory linkage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAuthorizedUser.mockResolvedValue({ uid: "staff-1", role: "staff", email: "staff@example.com" });
    createVehicleFinanceApplication.mockResolvedValue({ applicationId: "application-1" });
    sendVehicleFinanceApplicationNotification.mockResolvedValue({
      sent: true,
      skipped: false,
      skipReason: null,
      attempts: 1,
      resendResponseId: "email-1",
      recipients: ["lawrence@roarcarssa.com", "zetania@roarcarssa.com"],
      replyTo: "staff@example.com",
      subject: "New Vehicle Finance Application",
      dashboardLink: "https://example.com/dashboard/vehicle-finance/applications/application-1",
      error: null,
      queuedForRetry: false,
    });
    getFirebaseAdmin.mockReturnValue(createDb(false));
  });

  test("uses the synchronized inventory record instead of trusting client vehicle fields", async () => {
    getAvailableInventoryVehicle.mockResolvedValue({
      sourceVehicleId: "stock-1",
      title: "2022 BMW 320i",
      price: 500000,
      priceNumber: 500000,
      year: 2022,
      mileage: 40000,
      mileageNumber: 40000,
      imageUrl: "https://roarcarssa.com/images/bmw.jpg",
      listingUrl: "https://roarcarssa.com/vehicle/bmw-320i",
      source: "roarcarssa.com",
    });

    const response = await POST(
      new Request("http://localhost/api/vehicle-finance/applications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customerId: "customer-1",
          vehicleId: "untrusted-id",
          vehicleInventoryId: "stock-1",
          clientSubmissionId: "submission-1",
          vehicleTitle: "Untrusted title",
          vehiclePrice: 1,
          dealerName: "Roar Cars",
          dealValue: 500000,
        }),
      }) as never,
    );

    expect(response.status).toBe(201);
    expect(createVehicleFinanceApplication).toHaveBeenCalledWith(
      expect.objectContaining({
        vehicleId: "stock-1",
        vehicleInventoryId: "stock-1",
        clientSubmissionId: "submission-1",
        vehicleTitle: "2022 BMW 320i",
        vehiclePrice: 500000,
        inventorySource: "roarcarssa.com",
      }),
      expect.objectContaining({ actorId: "staff-1" }),
    );
    expect(sendVehicleFinanceApplicationNotification).toHaveBeenCalledWith(
      expect.objectContaining({ application: { applicationId: "application-1" } }),
    );
  });

  test("skips notification when the client submission already exists", async () => {
    getFirebaseAdmin.mockReturnValue(createDb(true));

    const response = await POST(
      new Request("http://localhost/api/vehicle-finance/applications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customerId: "customer-1",
          vehicleId: "untrusted-id",
          clientSubmissionId: "submission-1",
          dealerName: "Roar Cars",
          dealValue: 500000,
        }),
      }) as never,
    );

    expect(response.status).toBe(201);
    expect(createVehicleFinanceApplication).toHaveBeenCalled();
    expect(sendVehicleFinanceApplicationNotification).not.toHaveBeenCalled();
  });
});
