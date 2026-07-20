const mockCookieSet = jest.fn();
const mockRequireAuth = jest.fn();

jest.mock("next/headers", () => ({ cookies: jest.fn(async () => ({ set: mockCookieSet })) }));
jest.mock("@/lib/server/requireAuth", () => ({ requireAuth: (...args: unknown[]) => mockRequireAuth(...args) }));

import { getLogoutSessionCookieOptions, POST } from "@/app/api/auth/logout/route";

describe("/api/auth/logout", () => {
  beforeEach(() => {
    mockCookieSet.mockClear();
    mockRequireAuth.mockClear();
  });

  test("returns success and clears session without requiring authentication", async () => {
    const response = await POST();
    await expect(response.json()).resolves.toEqual({ success: true });

    expect(response.status).toBe(200);
    expect(mockRequireAuth).not.toHaveBeenCalled();
    expect(mockCookieSet).toHaveBeenCalledWith("session", "", getLogoutSessionCookieOptions("test"));
  });

  test("uses the canonical session clearing cookie scope", async () => {
    const response = await POST();
    const options = mockCookieSet.mock.calls[0][2];

    expect(response.status).toBe(200);
    expect(mockCookieSet.mock.calls[0][0]).toBe("session");
    expect(mockCookieSet.mock.calls[0][1]).toBe("");
    expect(options).toEqual({ httpOnly: true, secure: false, sameSite: "lax", path: "/", maxAge: 0 });
    expect(options).not.toHaveProperty("domain");
  });

  test("marks the clearing cookie secure in production", () => {
    expect(getLogoutSessionCookieOptions("production")).toEqual({ httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
  });
});