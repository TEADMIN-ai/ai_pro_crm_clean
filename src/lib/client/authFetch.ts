import { auth } from "@/lib/firebase";

function getStoredAuthToken(): string | null {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return null;
  }

  const token = localStorage.getItem("authToken");
  return typeof token === "string" && token.trim() ? token.trim() : null;
}

export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const headers = new Headers(init?.headers ?? {});
  const token = auth.currentUser ? await auth.currentUser.getIdToken(true) : getStoredAuthToken();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(input, {
    ...init,
    headers,
  });
}
