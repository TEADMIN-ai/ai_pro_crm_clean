import { getAuth } from "firebase/auth";

export async function authFetch(url: string, options: RequestInit = {}) {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    throw new Error("User not authenticated");
  }

  const token = await user.getIdToken(true);
  const headers = new Headers(options.headers);
  const hasContentType = headers.has("Content-Type");
  const isFormDataBody = typeof FormData !== "undefined" && options.body instanceof FormData;

  headers.set("Authorization", `Bearer ${token}`);

  if (!hasContentType && !isFormDataBody) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error("API ERROR RAW:", errorText);

    throw new Error(
      errorText || "Unknown API error  check backend logs"
    );
  }

  return res;
}
