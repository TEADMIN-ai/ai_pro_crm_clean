export type UserRole = "admin" | "staff" | "contractor" | "manager" | "auditor" | "viewer";

export interface AppUser {
  uid: string;
  email: string;
  role: UserRole;
  contractorId?: string;
  status?: string;
  name?: string;
  createdAt: any; // Firestore Timestamp
}

