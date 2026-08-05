
const mockDocGet = jest.fn(async () => ({ exists: true }));
const mockDoc = jest.fn(() => ({ get: mockDocGet }));
const mockCollection = jest.fn(() => ({ doc: mockDoc }));
const mockBucketExists = jest.fn(async () => [true]);
const mockBucket = jest.fn(() => ({ name: "torque-empire-teos-staging.firebasestorage.app", exists: mockBucketExists }));

jest.mock("@/lib/firebase/admin", () => ({
  getFirebaseAdmin: () => ({ collection: mockCollection }),
}));

jest.mock("firebase-admin/storage", () => ({
  getStorage: () => ({ bucket: mockBucket }),
}));

import { GET } from "@/app/api/health/route";

const BASE_ENV = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "test-api-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "torque-empire-ai-pro-crm-staging.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "torque-empire-ai-pro-crm-staging",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "torque-empire-teos-staging.firebasestorage.app",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "123456789",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:123456789:web:staging",
  FIREBASE_PROJECT_ID: "torque-empire-ai-pro-crm-staging",
  FIREBASE_CLIENT_EMAIL: "staging-admin@example.iam.gserviceaccount.com",
  FIREBASE_PRIVATE_KEY: "redacted-test-private-key",
  OPENAI_API_KEY: "redacted-openai-test-key",
};
describe("/api/health", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, ...BASE_ENV, VERCEL_ENV: "preview" };
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("uses a valid read-only Firestore document path and treats Preview Resend absence as not_configured", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(mockCollection).toHaveBeenCalledWith("_system");
    expect(mockDoc).toHaveBeenCalledWith("health");
    expect(body.readiness.firestoreStatus).toBe("ready");
    expect(body.readiness.storageStatus).toBe("ready");
    expect(body.readiness.emailStatus).toBe("not_configured");
    expect(body.services.email).toBe("not_configured");
  });

  it("keeps missing Resend unhealthy outside Preview", async () => {
    process.env.VERCEL_ENV = "production";

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.readiness.emailStatus).toBe("not_configured");
  });
});
