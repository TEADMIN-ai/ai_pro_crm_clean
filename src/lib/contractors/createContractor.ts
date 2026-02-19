import { collection, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Contractor } from "@/types/contractor";

export interface CreateContractorInput {
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  status?: Contractor["status"];
}

function clean(value: string): string {
  return value.trim();
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
    const contractor: Contractor = {
      id: contractorRef.id,
      companyName,
      contactPerson,
      email,
      phone,
      status: input.status ?? "pending",
      createdAt: Date.now(),
      createdBy: owner,
    };

    await setDoc(contractorRef, contractor);
    return contractor;
  } catch (error) {
    console.error("Failed to create contractor:", error);
    throw new Error("Failed to create contractor");
  }
}
