import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

type BotInput = {
  name: string;
  email?: string;
  phone?: string;
  make?: string;
  model?: string;
  budgetMin?: number;
  budgetMax?: number;
  financeRequired: boolean;
  timeframe?: "immediate" | "30_days" | "60_days" | "unsure";
};

export async function createDealFromBot(
  input: BotInput,
  companyId: string
) {
  // 1. Create deal
  const dealRef = await addDoc(collection(db, "deals"), {
    title: `${input.make || "Vehicle"} enquiry`,
    status: "in_review",
    source: "ai_bot",
    companyId,

    assignedTo: null,
    priority: input.timeframe === "immediate" ? "high" : "normal",

    customer: {
      name: input.name,
      email: input.email || null,
      phone: input.phone || null,
    },

    vehicle: {
      make: input.make || null,
      model: input.model || null,
    },

    budget: {
      min: input.budgetMin || null,
      max: input.budgetMax || null,
    },

    financeRequired: input.financeRequired,
    timeframe: input.timeframe || "unsure",

    createdAt: serverTimestamp(),
  });

  // 2. Log activity
  await addDoc(collection(db, "deals", dealRef.id, "activity"), {
    type: "deal_created",
    actorUid: "system",
    companyId,
    payload: {
      source: "ai_bot",
    },
    createdAt: serverTimestamp(),
  });

  return dealRef.id;
}