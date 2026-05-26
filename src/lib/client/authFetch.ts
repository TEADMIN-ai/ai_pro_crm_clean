import { auth } from "@/lib/firebase";

function getStoredAuthToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const sessionToken =
    typeof window.sessionStorage?.getItem === "function"
      ? window.sessionStorage.getItem("authToken")
      : null;
  if (sessionToken) {
    return sessionToken;
  }

  return typeof window.localStorage?.getItem === "function"
    ? window.localStorage.getItem("authToken")
    : null;
}

export async function authFetch(url: string, options: RequestInit = {}) {
  const user = auth.currentUser;
  let token: string | null = null;

  if (user) {
    token = await user.getIdToken();
    console.log("Sending token:", token.substring(0, 20));
  } else {
    token = getStoredAuthToken();
  }

  const headers = new Headers(options.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const body = options.body;
  const shouldDefaultJsonContentType =
    body !== undefined &&
    !(body instanceof FormData) &&
    !headers.has("Content-Type");

  if (shouldDefaultJsonContentType) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(url, {
    ...options,
    headers,
  });
}
