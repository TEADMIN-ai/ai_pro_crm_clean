import { API_ROUTES } from "@/lib/routes";
import { authFetch } from "@/lib/client/authFetch";
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
  const response = await authFetch(API_ROUTES.CONTRACTORS, {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch contractors: ${response.status}`);
  }

  const payload: unknown = await response.json();
  if (
    typeof payload !== "object" ||
    payload === null ||
    !Array.isArray((payload as { contractors?: unknown[] }).contractors)
  ) {
    throw new Error("Malformed contractor response");
  }
  const source = (payload as { contractors: unknown[] }).contractors;

  return source.map((item: unknown) => {
    const id = getString(item, "id") ?? "";
    return normalizeContractor(id, item);
  });
}
