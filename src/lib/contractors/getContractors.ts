import { auth } from "@/lib/firebase";
import { API_ROUTES } from "@/lib/routes";
import type { Contractor } from "@/types/contractor";

function hasKey<K extends string>(value: object, key: K): value is Record<K, unknown> {
  return key in value;
}

function getString(data: unknown, key: string): string | null {
  if (typeof data !== "object" || data === null || !hasKey(data, key)) {
    return null;
  }

  const value = data[key];
  return typeof value === "string" ? value : null;
}

function getNumber(data: unknown, key: string): number | null {
  if (typeof data !== "object" || data === null || !hasKey(data, key)) {
    return null;
  }

  const value = data[key];
  return typeof value === "number" ? value : null;
}

function normalizeContractor(id: string, data: unknown): Contractor {
  return {
    id,
    name: getString(data, "name"),
    companyName: getString(data, "companyName"),
    contactPerson: getString(data, "contactPerson"),
    email: getString(data, "email"),
    phone: getString(data, "phone"),
    status: getString(data, "status"),
    createdAt: getNumber(data, "createdAt"),
    createdBy: getString(data, "createdBy"),
  };
}

export async function getContractors(): Promise<Contractor[]> {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("User not authenticated");
  }

  const token = await user.getIdToken(true);

  const res = await fetch(API_ROUTES.CONTRACTORS, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch contractors: ${text}`);
  }

  const payload = await res.json();

  if (
    typeof payload !== "object" ||
    payload === null ||
    !("contractors" in payload) ||
    !Array.isArray(payload.contractors)
  ) {
    throw new Error("Malformed contractor response");
  }

  return payload.contractors.map((item: unknown) => {
    const id = getString(item, "id") ?? "";
    return normalizeContractor(id, item);
  });
}
