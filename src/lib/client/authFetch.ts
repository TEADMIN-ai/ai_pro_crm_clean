export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("authToken")
      : null;

  const headers = new Headers(init?.headers ?? {});

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(input, {
    ...init,
    headers,
  });

  return response;
}