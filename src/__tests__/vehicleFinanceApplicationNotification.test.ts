const resendSend = jest.fn();
const getFirebaseAdmin = jest.fn();

jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: (...args: unknown[]) => resendSend(...args),
    },
  })),
}));

jest.mock("@/lib/firebase/admin", () => ({
  getFirebaseAdmin: () => getFirebaseAdmin(),
}));

import { sendVehicleFinanceApplicationNotification } from "@/lib/vehicle-finance/notifications/vehicleFinanceApplicationNotification";

describe("vehicle finance application notifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.RESEND_API_KEY = "test-resend-key";
    process.env.RESEND_FROM_EMAIL = "Torque Empire <admin@torqueempire.net>";
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
  });

  afterEach(() => {
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  function createDb() {
    const add = jest.fn(async () => ({ id: "event-1" }));
    const auditAdd = jest.fn(async () => ({ id: "audit-1" }));
    const queueSet = jest.fn(async () => ({ id: "queue-1" }));
    const customerGet = jest.fn(async () => ({
      exists: true,
      id: "customer-1",
      data: () => ({
        firstName: "John",
        lastName: "Banks",
        phone: "+27 82 123 4567",
        email: "john.banks@example.com",
      }),
    }));
    const collection = jest.fn((name: string) => {
      if (name === "vehicleFinanceCustomers") {
        return { doc: jest.fn(() => ({ get: customerGet })) };
      }
      if (name === "vehicleFinanceApplicationEvents") {
        return { add };
      }
      if (name === "auditLogs") {
        return { add: auditAdd };
      }
      if (name === "vehicleFinanceNotificationQueue") {
        return { doc: jest.fn(() => ({ set: queueSet })) };
      }
      return { add: jest.fn() };
    });
    return { db: { collection }, add, auditAdd, queueSet };
  }

  test("sends to the configured vehicle finance recipients", async () => {
    const { db, add, auditAdd } = createDb();
    getFirebaseAdmin.mockReturnValue(db);
    resendSend.mockResolvedValue({ data: { id: "resend-1" }, error: null });

    const result = await sendVehicleFinanceApplicationNotification({
      application: {
        applicationId: "application-1",
        customerId: "customer-1",
        vehicleId: "vehicle-1",
        dealerName: "Roar Cars",
        dealValue: 250000,
        applicationStatus: "NEW",
        fraudScore: 100,
        verificationStatus: "PENDING",
        isDeleted: false,
        archived: false,
        inactive: false,
        createdVia: "web",
        createdAt: "2026-07-03T10:00:00.000Z",
        updatedAt: "2026-07-03T10:00:00.000Z",
      },
      actor: { actorId: "staff-1", actorRole: "staff", actorName: "staff@example.com" },
    });

    expect(result.sent).toBe(true);
    expect(result.recipients).toEqual(["lawrence@roarcarssa.com", "zetania@roarcarssa.com"]);
    expect(result.replyTo).toBe("john.banks@example.com");
    expect(result.dashboardLink).toBe("https://example.com/dashboard/vehicle-finance/applications/application-1");
    expect(resendSend).toHaveBeenCalledWith(expect.objectContaining({
      from: "Torque Empire <admin@torqueempire.net>",
      to: ["lawrence@roarcarssa.com", "zetania@roarcarssa.com"],
      subject: "New Vehicle Finance Application",
      replyTo: "john.banks@example.com",
    }));
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ operation: "Email Sent", applicationId: "application-1", status: "success" }));
    expect(auditAdd).toHaveBeenCalledWith(expect.objectContaining({ eventType: "VEHICLE_FINANCE_APPLICATION_NOTIFICATION", applicationId: "application-1" }));
  });

  test("queues a retry when the sender is not configured", async () => {
    delete process.env.RESEND_API_KEY;
    const { db, add, auditAdd, queueSet } = createDb();
    getFirebaseAdmin.mockReturnValue(db);

    const result = await sendVehicleFinanceApplicationNotification({
      application: {
        applicationId: "application-1",
        customerId: "customer-1",
        vehicleId: "vehicle-1",
        dealerName: "Roar Cars",
        dealValue: 250000,
        applicationStatus: "NEW",
        fraudScore: 100,
        verificationStatus: "PENDING",
        isDeleted: false,
        archived: false,
        inactive: false,
        createdVia: "web",
        createdAt: "2026-07-03T10:00:00.000Z",
        updatedAt: "2026-07-03T10:00:00.000Z",
      },
      actor: { actorId: "staff-1", actorRole: "staff", actorName: "staff@example.com" },
    });

    expect(result.sent).toBe(false);
    expect(result.queuedForRetry).toBe(true);
    expect(queueSet).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ operation: "Email Failed", applicationId: "application-1", status: "failure" }));
    expect(auditAdd).toHaveBeenCalledWith(expect.objectContaining({ eventType: "VEHICLE_FINANCE_APPLICATION_NOTIFICATION", applicationId: "application-1" }));
  });
});
