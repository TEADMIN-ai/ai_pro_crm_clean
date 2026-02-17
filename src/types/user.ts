export type UserRole = "admin" | "staff" | "contractor";

export interface AppUser {
  uid: string;
  email: string;
  role: UserRole;
  companyId: string;
  createdAt: any; // Firestore Timestamp
}

