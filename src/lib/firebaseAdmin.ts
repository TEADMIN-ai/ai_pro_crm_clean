import { getAdminAuth, getAdminStorage, getFirebaseAdmin } from "@/lib/firebase/admin";

export const adminAuth = getAdminAuth();
export const adminDb = getFirebaseAdmin();
export const adminStorage = getAdminStorage();
