export type UserRole = "admin" | "manager" | "staff";

export interface AppUser {
  uid: string;
  email: string;
  role: UserRole;
  companyId: string;
  createdAt: any; // Firestore Timestamp
}

