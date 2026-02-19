export type ContractorStatus =
  | "active"
  | "pending"
  | "suspended"

export interface Contractor {
  id: string
  companyName: string
  contactPerson: string
  email: string
  phone: string
  status: ContractorStatus
  createdAt: number
  createdBy: string
}
