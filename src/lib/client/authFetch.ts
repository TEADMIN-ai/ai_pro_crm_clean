import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";

const AUTH_WAIT_TIMEOUT_MS = 1200;
const AUTH_POLL_INTERVAL_MS = 50;

class AuthRequiredError extends Error {
  code: "AUTH_REQUIRED";

  constructor() {
    super("AUTH_REQUIRED");
    this.name = "AuthRequiredError";
    this.code = "AUTH_REQUIRED";
  }
}

export type AuthFetchSuccess = {
  ok: true;
  response: Response;
};

export type AuthFetchFailure = {
  ok: false;
  code: "AUTH" | "SERVER";
  message: string;
};

export type AuthFetchResult = AuthFetchSuccess | AuthFetchFailure;

function isAuthRequiredError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.name === "AuthRequiredError" ||
    error.message === "AUTH_REQUIRED" ||
    (typeof (error as { code?: unknown }).code === "string" &&
      (error as { code?: string }).code === "AUTH_REQUIRED")
  );
}

async function waitForAuthUser(timeoutMs = AUTH_WAIT_TIMEOUT_MS): Promise<User | null> {
  if (auth.currentUser) {
    return auth.currentUser;
  }

  return new Promise((resolve) => {
    let settled = false;
    let unsubscribe: (() => void) | null = null;

    const finish = (user: User | null) => {
      if (settled) {
        return;
      }

      settled = true;
      clearInterval(poll);
      clearTimeout(timer);
      if (unsubscribe) {
        unsubscribe();
      }
      resolve(user);
    };

    unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        finish(user);
      }
    });

    const poll = setInterval(() => {
      if (auth.currentUser) {
        finish(auth.currentUser);
      }
    }, AUTH_POLL_INTERVAL_MS);

    const timer = setTimeout(() => {
      finish(auth.currentUser ?? null);
    }, timeoutMs);
  });
}

export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<AuthFetchResult> {
  try {
    const user = await waitForAuthUser();

    if (!user) {
      throw new AuthRequiredError();
    }

    const token = await user.getIdToken();
    const headers = new Headers(init?.headers ?? {});
    headers.set("Authorization", `Bearer ${token}`);

    const response = await fetch(input, { ...init, headers });

    if (response.status === 401) {
      return { ok: false, code: "AUTH", message: "Login required" };
    }

    if (response.status >= 500) {
      return { ok: false, code: "SERVER", message: "Server error" };
    }

    return { ok: true, response };
  } catch (error) {
    if (isAuthRequiredError(error)) {
      return { ok: false, code: "AUTH", message: "Login required" };
    }

    return { ok: false, code: "SERVER", message: "Server error" };
  }
}
