export type UserRole = "admin" | "staff" | "contractor";

export interface AppUser {
  uid: string;
  email: string;
  role: UserRole;
  contractorId?: string;
  status?: string;
  name?: string;
  createdAt: any; // Firestore Timestamp
}

