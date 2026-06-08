import { loadEnvConfig } from "@next/env";
import { getAuth } from "firebase-admin/auth";

loadEnvConfig(process.cwd());
void main();

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
if (!apiKey) {
  throw new Error("Missing Firebase Web API key");
}

async function idToken(uid: string) {
  const customToken = await getAuth().createCustomToken(uid);
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  const data = await response.json();
  if (!response.ok || !data.idToken) {
    throw new Error(`Token exchange failed for ${uid}: ${JSON.stringify(data)}`);
  }
  return data.idToken as string;
}

async function call(label: string, token: string, method: string, path: string, body?: unknown) {
  const response = await fetch(`http://localhost:3001${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  console.log(JSON.stringify({
    label,
    status: response.status,
    ok: response.ok,
    error: data?.error ?? null,
    role: data?.role ?? data?.user?.role ?? null,
    contractorId: data?.contractorId ?? data?.user?.contractorId ?? null,
    requestId: data?.request?.id ?? null,
    requestStatus: data?.request?.status ?? null,
    packId: data?.packId ?? null,
    hasDownloadURL: Boolean(data?.downloadURL ?? data?.request?.downloadURL),
  }));
  return { response, data };
}

async function main() {
  await import("../src/lib/firebase/admin");

  const users = {
    admin: "weafIuxbamYoEoJaSytAvumVxK62",
    staff: "ekUvq3lC7HUEwICe5rcCQBWovSF3",
    contractor: "vOwPwNDdKwhvJLS9dl33AQ3bIBk1",
  };

  const tokens = {
    admin: await idToken(users.admin),
    staff: await idToken(users.staff),
    contractor: await idToken(users.contractor),
  };

  await call("admin /api/me", tokens.admin, "GET", "/api/me");
  await call("staff /api/me", tokens.staff, "GET", "/api/me");
  await call("contractor /api/me", tokens.contractor, "GET", "/api/me");

  const created = await call("contractor create request", tokens.contractor, "POST", "/api/tender-pack/requests", {
    contractorId: users.contractor,
    dealId: "Re3fBGNKsHEzWrbaBoYv",
    note: "Production rollout sprint validation 2026-06-08",
  });
  const requestId = created.data?.request?.id;
  if (!requestId) {
    throw new Error("Request creation did not return request id");
  }

  await call("staff mark under review", tokens.staff, "PATCH", `/api/tender-pack/requests/${requestId}`, {
    status: "under_review",
  });
  await call("staff approve", tokens.staff, "PATCH", `/api/tender-pack/requests/${requestId}`, {
    status: "approved",
  });
  await call("staff generate blocked", tokens.staff, "POST", "/api/tender-pack/generate", {
    dealId: "Re3fBGNKsHEzWrbaBoYv",
    requestId,
  });
  await call("admin generate", tokens.admin, "POST", "/api/tender-pack/generate", {
    dealId: "Re3fBGNKsHEzWrbaBoYv",
    requestId,
  });
  await call("contractor view generated request", tokens.contractor, "GET", `/api/tender-pack/requests/${requestId}`);
}
