import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase/config";

/**
 * DEMO DATA SEEDER
 * ----------------
 * This file is SAFE for production builds.
 * Nothing runs automatically.
 * You must call seedDemoData() manually.
 */

export async function seedDemoData() {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  // --- Contractors ---
  await addDoc(collection(db, "contractors"), {
    name: "Demo Contractor",
    email: "demo@contractor.com",
    createdAt: serverTimestamp(),
  });

  // --- Tenders ---
  await addDoc(collection(db, "tenders"), {
    title: "Demo Tender",
    budget: 500000,
    status: "open",
    createdAt: serverTimestamp(),
  });

  // --- Car Sales ---
  await addDoc(collection(db, "car_sales"), {
    vehicle: "BMW",
    buyer: "Demo Buyer",
    price: 25000,
    status: "sold",
    createdAt: serverTimestamp(),
  });

  return { success: true };
}
