import { collection, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Contractor, ContractorTier } from "@/types/contractor";

export interface CreateContractorInput {
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  status?: Contractor["status"];
  tier?: ContractorTier;
  submissionsUsed?: number;
  submissionsLimit?: number;
}

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

function clean(value: string): string {
  return value.trim();
}

function normalizeTier(value: ContractorTier | undefined): ContractorTier {
  return value ?? "basic";
}

function defaultSubmissionLimitForTier(tier: ContractorTier): number {
  switch (tier) {
    case "bronze":
      return 5;
    case "silver":
      return 15;
    case "gold":
      return 50;
    case "platinum":
      return 250;
    case "basic":
    default:
      return 1;
  }
}

export async function createContractor(
  input: CreateContractorInput,
  createdBy: string
): Promise<Contractor> {
  const companyName = clean(input.companyName);
  const contactPerson = clean(input.contactPerson);
  const email = clean(input.email);
  const phone = clean(input.phone);
  const owner = clean(createdBy);

  if (!companyName) throw new Error("Company name is required");
  if (!contactPerson) throw new Error("Contact person is required");
  if (!email) throw new Error("Email is required");
  if (!phone) throw new Error("Phone is required");
  if (!owner) throw new Error("CreatedBy is required");

  try {
    const contractorRef = doc(collection(db, "contractors"));
    const tier = normalizeTier(input.tier);
    const rawContractor = {
      companyName,
      contactPerson,
      email,
      phone,
      status: input.status ?? "pending",
      tier,
      submissionsUsed: input.submissionsUsed ?? 0,
      submissionsLimit: input.submissionsLimit ?? defaultSubmissionLimitForTier(tier),
      createdAt: Date.now(),
      createdBy: owner,
    };
    const contractor = normalizeContractor(contractorRef.id, rawContractor);

    await setDoc(contractorRef, contractor);
    return contractor;
  } catch (error) {
    console.error("Failed to create contractor:", error);
    throw new Error("Failed to create contractor");
  }
}
