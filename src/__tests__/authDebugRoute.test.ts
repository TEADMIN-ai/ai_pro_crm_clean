import { NextRequest } from "next/server";

const requireAuthorizedUser = jest.fn();

class MockAuthorizationError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthorizationError";
    this.status = status;
  }
}

jest.mock("@/lib/server/authz", () => ({
  AuthorizationError: MockAuthorizationError,
  requireAuthorizedUser: (...args: unknown[]) => requireAuthorizedUser(...args),
}));

jest.mock("firebase-admin/auth", () => ({
  getAuth: jest.fn(),
}));

jest.mock("@/lib/firebase/admin", () => ({
  getFirebaseAdmin: jest.fn(),
}));

import { GET, runtime } from "@/app/api/auth/debug/route";

describe("/api/auth/debug route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("uses the Node.js runtime for Firebase Admin-backed session verification", () => {
    expect(runtime).toBe("nodejs");
  });

  test("fails closed with JSON when authentication is missing", async () => {
    requireAuthorizedUser.mockRejectedValue(new MockAuthorizationError("unauthorized", 401));

    const response = await GET(new NextRequest("http://localhost/api/auth/debug"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
  });

  test("returns the verified server identity from requireAuthorizedUser", async () => {
    requireAuthorizedUser.mockResolvedValue({ uid: "user-123", role: "admin" });

    const response = await GET(new NextRequest("http://localhost/api/auth/debug"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      sessionExists: true,
      userId: "user-123",
    });
  });
});
