import { auth } from "@/lib/firebase";

export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const headers = new Headers(init?.headers ?? {});
  const token = auth.currentUser ? await auth.currentUser.getIdToken(true) : null;

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(input, {
    ...init,
    headers,
  });
}
