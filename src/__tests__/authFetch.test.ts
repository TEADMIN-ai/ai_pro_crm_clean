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
  const storage = new Map<string, string>();

  beforeAll(() => {
    Object.defineProperty(globalThis, "window", {
      value: globalThis,
      writable: true,
    });

    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
        clear: () => {
          storage.clear();
        },
      },
      writable: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    mockAuth.currentUser = null;
    localStorage.clear();
  });

  test("attaches Authorization header when getIdToken resolves", async () => {
    localStorage.setItem("authToken", "token-123");

    const fetchMock = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await authFetch("/api/contractors", {
      headers: { "X-Test": "1" },
    });

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const fetchInit = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = new Headers(fetchInit.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-123");
    expect(headers.get("X-Test")).toBe("1");
  });

  test("returns native Response when no user token", async () => {
    localStorage.removeItem("authToken");

    const fetchMock = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await authFetch("/api/contractors");

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const fetchInit = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = new Headers(fetchInit.headers);
    expect(headers.get("Authorization")).toBeNull();
  });
});
