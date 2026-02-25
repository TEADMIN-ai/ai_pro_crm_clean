const mockAuth = {
  currentUser: null as null | { getIdToken: jest.Mock<Promise<string>, []> },
};

const mockOnAuthStateChanged = jest.fn<
  () => void,
  [unknown, (user: unknown) => void]
>();

jest.mock("@/lib/firebase", () => ({
  auth: mockAuth,
}));

jest.mock("firebase/auth", () => ({
  onAuthStateChanged: (...args: [unknown, (user: unknown) => void]) =>
    mockOnAuthStateChanged(...args),
}));

import { authFetch } from "@/lib/client/authFetch";

describe("authFetch", () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    mockAuth.currentUser = null;
  });

  test("attaches Authorization header when getIdToken resolves", async () => {
    mockAuth.currentUser = {
      getIdToken: jest.fn().mockResolvedValue("token-123"),
    };

    const fetchMock = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await authFetch("/api/contractors", {
      headers: { "X-Test": "1" },
    });

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const fetchInit = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = new Headers(fetchInit.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-123");
    expect(headers.get("X-Test")).toBe("1");
  });

  test("returns AUTH error when no user", async () => {
    jest.useFakeTimers();
    mockAuth.currentUser = null;
    mockOnAuthStateChanged.mockImplementation((_auth, _callback) => () => {});

    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const pending = authFetch("/api/contractors");
    await jest.advanceTimersByTimeAsync(1300);
    const result = await pending;

    expect(result).toEqual({ ok: false, code: "AUTH", message: "Login required" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
