export interface Contractor {
  id: string;
  name?: string | null;
  companyName?: string | null;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  createdAt?: number | null;
  createdBy?: string | null;
}
