import fs from "node:fs/promises";
import path from "node:path";
import { jsPDF } from "jspdf";
import { getFirebaseAdmin, getFirebaseStorageBucket } from "@/lib/firebase/admin";

const BASE_URL = process.env.TE_PRODUCTION_BASE_URL?.trim() || "https://ai-pro-crm-clean.vercel.app";
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
const OUTPUT_DIR = process.env.TE_RC1_OUTPUT_DIR?.trim() || "output/production-baseline/2026-06-28-reconciliation";
const EMAIL_DOMAIN = process.env.TE_QA_EMAIL_DOMAIN?.trim() || "qa.torqueempire.local";

type QaUser = {
  key: string;
  role: string;
  passwordEnv: string;
  checks: { name: string; path: string; expected: number[] }[];
};

const USERS: QaUser[] = [
  { key: "admin", role: "admin", passwordEnv: "TE_QA_ADMIN_PASSWORD", checks: [{ name: "dashboard-summary", path: "/api/dashboard/summary", expected: [200] }] },
  { key: "manager", role: "manager", passwordEnv: "TE_QA_MANAGER_PASSWORD", checks: [{ name: "contractors", path: "/api/contractors", expected: [200] }] },
  { key: "staff", role: "staff", passwordEnv: "TE_QA_STAFF_PASSWORD", checks: [{ name: "deals", path: "/api/deals", expected: [200] }] },
  { key: "driver", role: "driver", passwordEnv: "TE_QA_DRIVER_PASSWORD", checks: [{ name: "hygiene-jobs", path: "/api/hygiene/jobs", expected: [200] }] },
  {
    key: "contractor",
    role: "contractor",
    passwordEnv: "TE_QA_CONTRACTOR_PASSWORD",
    checks: [{ name: "contractor-onboarding", path: "/api/contractors/qa-v1-contractor-verified/onboarding", expected: [200] }],
  },
  {
    key: "vehicle-finance",
    role: "vehicleFinanceStaff",
    passwordEnv: "TE_QA_VEHICLE_FINANCE_PASSWORD",
    checks: [{ name: "vehicle-finance-overview", path: "/api/vehicle-finance/overview", expected: [200] }],
  },
  {
    key: "roar",
    role: "ROAR_CARS_STAFF",
    passwordEnv: "TE_QA_ROAR_PASSWORD",
    checks: [{ name: "roar-inventory", path: "/api/vehicle-finance/roar-inventory", expected: [200] }],
  },
];

function qaEmail(key: string): string {
  return `qa-v1-${key}@${EMAIL_DOMAIN}`.toLowerCase();
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required env ${name}`);
  return value;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { text: text.slice(0, 1000) };
  }
}

function cookieFromSetCookie(header: string | null): string | null {
  if (!header) return null;
  const session = header.split(",").find((part) => part.trim().startsWith("session=")) ?? header;
  return session.split(";")[0] ?? null;
}

async function signIn(email: string, password: string) {
  if (!API_KEY) throw new Error("Missing NEXT_PUBLIC_FIREBASE_API_KEY");
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(API_KEY)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const body = await readJson(response) as { idToken?: string; refreshToken?: string; localId?: string };
  if (!response.ok || !body.idToken) {
    throw new Error(`Firebase sign-in failed for ${email}: ${response.status}`);
  }
  return body;
}

async function api(pathname: string, token: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${BASE_URL}${pathname}`, { ...init, headers });
}

async function createSession(token: string) {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: token }),
  });
  const body = await readJson(response);
  return {
    status: response.status,
    ok: response.ok,
    cookie: cookieFromSetCookie(response.headers.get("set-cookie")),
    body,
  };
}

async function makePdfBlob() {
  const pdf = new jsPDF();
  pdf.text("Torque Empire RC1 production evidence payslip", 20, 20);
  pdf.text("Employee: QA Finance Applicant", 20, 32);
  pdf.text("Gross salary: R32000.00", 20, 44);
  pdf.text("Net salary: R28500.00", 20, 56);
  const bytes = pdf.output("arraybuffer");
  return new Blob([bytes], { type: "application/pdf" });
}

async function verifyRole(user: QaUser) {
  const email = qaEmail(user.key);
  const signInResult = await signIn(email, requireEnv(user.passwordEnv));
  const session = await createSession(signInResult.idToken!);
  const meResponse = await api("/api/me", signInResult.idToken!);
  const meBody = await readJson(meResponse);
  const logoutResponse = await api("/api/auth/logout", signInResult.idToken!, {
    method: "POST",
    headers: session.cookie ? { Cookie: session.cookie } : undefined,
  });

  const checks = [];
  for (const check of user.checks) {
    const response = await api(check.path, signInResult.idToken!, { cache: "no-store" });
    const body = await readJson(response);
    checks.push({
      name: check.name,
      path: check.path,
      status: response.status,
      ok: check.expected.includes(response.status),
      bodyKeys: body && typeof body === "object" ? Object.keys(body as Record<string, unknown>).slice(0, 20) : [],
    });
  }

  const relogin = await signIn(email, requireEnv(user.passwordEnv));
  return {
    key: user.key,
    role: user.role,
    email,
    uid: signInResult.localId ?? null,
    signIn: Boolean(signInResult.idToken),
    sessionCreated: session.ok && Boolean(session.cookie),
    meStatus: meResponse.status,
    me: meBody,
    logoutStatus: logoutResponse.status,
    relogin: Boolean(relogin.idToken),
    checks,
  };
}

async function runVehicleFinanceWorkflow(token: string) {
  const clientSubmissionId = `rc1-${Date.now()}`;
  const createResponse = await api("/api/vehicle-finance/applications", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerId: "qa-v1-vf-customer",
      vehicleInventoryId: "qa-v1-roar-vehicle",
      dealerName: "Roar Cars QA",
      dealValue: 249900,
      clientSubmissionId,
    }),
  });
  const createBody = await readJson(createResponse) as { application?: { applicationId?: string } };
  const applicationId = createBody.application?.applicationId;
  if (!createResponse.ok || !applicationId) {
    throw new Error(`Vehicle finance application create failed: ${createResponse.status}`);
  }

  const duplicateResponse = await api("/api/vehicle-finance/applications", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerId: "qa-v1-vf-customer",
      vehicleInventoryId: "qa-v1-roar-vehicle",
      dealerName: "Roar Cars QA",
      dealValue: 249900,
      clientSubmissionId,
    }),
  });
  const duplicateBody = await readJson(duplicateResponse) as { application?: { applicationId?: string } };

  const formData = new FormData();
  formData.set("documentType", "payslip");
  formData.set("file", await makePdfBlob(), `rc1-${applicationId}-payslip.pdf`);
  const uploadResponse = await api(`/api/vehicle-finance/applications/${encodeURIComponent(applicationId)}/documents`, token, {
    method: "POST",
    body: formData,
  });
  const uploadBody = await readJson(uploadResponse) as { document?: { documentId?: string; signedUrl?: string; filePath?: string } };
  const documentId = uploadBody.document?.documentId;
  if (!uploadResponse.ok || !documentId) {
    throw new Error(`Vehicle finance document upload failed: ${uploadResponse.status}`);
  }

  const [detailResponse, documentsResponse, timelineResponse, verifyResponse] = await Promise.all([
    api(`/api/vehicle-finance/applications/${encodeURIComponent(applicationId)}`, token),
    api(`/api/vehicle-finance/applications/${encodeURIComponent(applicationId)}/documents`, token),
    api(`/api/vehicle-finance/applications/${encodeURIComponent(applicationId)}/timeline`, token),
    api(`/api/vehicle-finance/applications/${encodeURIComponent(applicationId)}/verify`, token, { method: "POST" }),
  ]);

  const [detailBody, documentsBody, timelineBody, verifyBody] = await Promise.all([
    readJson(detailResponse),
    readJson(documentsResponse),
    readJson(timelineResponse),
    readJson(verifyResponse),
  ]);

  const signedUrl = uploadBody.document?.signedUrl;
  const signedUrlResponse = signedUrl ? await fetch(signedUrl) : null;

  const db = getFirebaseAdmin();
  const [appSnapshot, docSnapshot, auditSnapshot, decisionSnapshot, eventSnapshot] = await Promise.all([
    db.collection("vehicleFinanceApplications").doc(applicationId).get(),
    db.collection("vehicleFinanceDocuments").doc(documentId).get(),
    db.collection("auditLogs").where("applicationId", "==", applicationId).limit(20).get(),
    db.collection("decisionLogs").where("applicationId", "==", applicationId).limit(20).get(),
    db.collection("vehicleFinanceApplicationEvents").where("applicationId", "==", applicationId).limit(20).get(),
  ]);

  const filePath = uploadBody.document?.filePath || (docSnapshot.data()?.filePath as string | undefined);
  const storageExists = filePath ? (await getFirebaseStorageBucket().file(filePath).exists())[0] : false;

  return {
    clientSubmissionId,
    applicationId,
    duplicateApplicationId: duplicateBody.application?.applicationId ?? null,
    duplicatePrevented: duplicateBody.application?.applicationId === applicationId,
    createStatus: createResponse.status,
    uploadStatus: uploadResponse.status,
    detailStatus: detailResponse.status,
    documentsStatus: documentsResponse.status,
    timelineStatus: timelineResponse.status,
    verifyStatus: verifyResponse.status,
    signedUrlStatus: signedUrlResponse?.status ?? null,
    firestore: {
      applicationExists: appSnapshot.exists,
      documentExists: docSnapshot.exists,
      storagePath: filePath ?? null,
      storageExists,
      auditIds: auditSnapshot.docs.map((doc) => doc.id),
      decisionIds: decisionSnapshot.docs.map((doc) => doc.id),
      eventIds: eventSnapshot.docs.map((doc) => doc.id),
    },
    responseShapes: {
      detailKeys: detailBody && typeof detailBody === "object" ? Object.keys(detailBody as Record<string, unknown>) : [],
      documentsKeys: documentsBody && typeof documentsBody === "object" ? Object.keys(documentsBody as Record<string, unknown>) : [],
      timelineKeys: timelineBody && typeof timelineBody === "object" ? Object.keys(timelineBody as Record<string, unknown>) : [],
      verifyKeys: verifyBody && typeof verifyBody === "object" ? Object.keys(verifyBody as Record<string, unknown>) : [],
    },
  };
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const roles = [];
  for (const user of USERS) {
    roles.push(await verifyRole(user));
  }

  const vfUser = USERS.find((user) => user.key === "vehicle-finance");
  if (!vfUser) throw new Error("Missing vehicle finance user spec");
  const vfSignIn = await signIn(qaEmail(vfUser.key), requireEnv(vfUser.passwordEnv));
  const vehicleFinanceWorkflow = await runVehicleFinanceWorkflow(vfSignIn.idToken!);

  const evidence = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    roles,
    vehicleFinanceWorkflow,
    passed:
      roles.every((role) => role.signIn && role.sessionCreated && role.meStatus === 200 && role.logoutStatus === 200 && role.relogin && role.checks.every((check) => check.ok)) &&
      vehicleFinanceWorkflow.duplicatePrevented &&
      vehicleFinanceWorkflow.firestore.applicationExists &&
      vehicleFinanceWorkflow.firestore.documentExists &&
      vehicleFinanceWorkflow.firestore.storageExists &&
      vehicleFinanceWorkflow.firestore.auditIds.length > 0 &&
      vehicleFinanceWorkflow.firestore.decisionIds.length > 0 &&
      vehicleFinanceWorkflow.firestore.eventIds.length > 0 &&
      [200, 201, 202].includes(vehicleFinanceWorkflow.uploadStatus) &&
      vehicleFinanceWorkflow.signedUrlStatus === 200,
  };

  const outputPath = path.join(OUTPUT_DIR, "authenticated-rc1-evidence.json");
  await fs.writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify({
    outputPath,
    passed: evidence.passed,
    applicationId: vehicleFinanceWorkflow.applicationId,
    documentIds: [vehicleFinanceWorkflow.firestore.storagePath],
  }, null, 2));

  if (!evidence.passed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[production-rc1-evidence] failed", error);
  process.exitCode = 1;
});
