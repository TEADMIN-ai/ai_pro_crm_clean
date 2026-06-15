import {
  type VehicleFinanceTrainingCategory,
  type VehicleFinanceTrainingTemplate,
  VEHICLE_FINANCE_TRAINING_CATEGORY_LABELS,
  VEHICLE_FINANCE_TRAINING_CATEGORIES,
  VEHICLE_FINANCE_TRAINING_STORAGE_FOLDERS,
} from "../types";

const ID_TEMPLATE: VehicleFinanceTrainingTemplate = {
  category: "ids",
  label: VEHICLE_FINANCE_TRAINING_CATEGORY_LABELS.ids,
  storageFolder: VEHICLE_FINANCE_TRAINING_STORAGE_FOLDERS.ids,
  requiredFields: ["firstName", "surname", "idNumber", "dateOfBirth", "gender", "nationality"],
  fields: [
    { key: "firstName", label: "First Name", kind: "name", aliases: ["first name", "given name", "given names"] },
    { key: "surname", label: "Surname", kind: "name", aliases: ["surname", "last name"] },
    { key: "idNumber", label: "ID Number", kind: "identifier", aliases: ["id number", "identity number", "id no"] },
    { key: "dateOfBirth", label: "Date of Birth", kind: "date", aliases: ["date of birth", "dob"] },
    { key: "gender", label: "Gender", kind: "text", aliases: ["gender", "sex"] },
    { key: "nationality", label: "Nationality", kind: "text", aliases: ["nationality", "citizenship"] },
  ],
};

const DRIVERS_LICENSE_TEMPLATE: VehicleFinanceTrainingTemplate = {
  category: "drivers-licences",
  label: VEHICLE_FINANCE_TRAINING_CATEGORY_LABELS["drivers-licences"],
  storageFolder: VEHICLE_FINANCE_TRAINING_STORAGE_FOLDERS["drivers-licences"],
  requiredFields: ["firstName", "surname", "idNumber", "licenceNumber", "issueDate", "expiryDate"],
  fields: [
    { key: "firstName", label: "First Name", kind: "name", aliases: ["first name", "given name", "given names"] },
    { key: "surname", label: "Surname", kind: "name", aliases: ["surname", "last name"] },
    { key: "idNumber", label: "ID Number", kind: "identifier", aliases: ["id number", "identity number", "id no"] },
    { key: "licenceNumber", label: "Licence Number", kind: "identifier", aliases: ["licence number", "license number", "driver licence number"] },
    { key: "issueDate", label: "Issue Date", kind: "date", aliases: ["issue date", "date issued"] },
    { key: "expiryDate", label: "Expiry Date", kind: "date", aliases: ["expiry date", "expires", "valid until"] },
  ],
};

const PAYSLIP_TEMPLATE: VehicleFinanceTrainingTemplate = {
  category: "payslips",
  label: VEHICLE_FINANCE_TRAINING_CATEGORY_LABELS.payslips,
  storageFolder: VEHICLE_FINANCE_TRAINING_STORAGE_FOLDERS.payslips,
  requiredFields: ["employerName", "employeeName", "employeeNumber", "grossSalary", "netSalary", "payDate"],
  fields: [
    { key: "employerName", label: "Employer Name", kind: "text", aliases: ["employer name", "employer", "company name"] },
    { key: "employeeName", label: "Employee Name", kind: "name", aliases: ["employee name", "name"] },
    { key: "employeeNumber", label: "Employee Number", kind: "identifier", aliases: ["employee number", "employee no", "staff number"] },
    { key: "grossSalary", label: "Gross Salary", kind: "money", aliases: ["gross salary", "gross pay", "earnings"] },
    { key: "netSalary", label: "Net Salary", kind: "money", aliases: ["net salary", "take home", "net pay"] },
    { key: "payDate", label: "Pay Date", kind: "date", aliases: ["pay date", "date paid", "period ending"] },
  ],
};

const BANK_STATEMENT_TEMPLATE: VehicleFinanceTrainingTemplate = {
  category: "bank-statements",
  label: VEHICLE_FINANCE_TRAINING_CATEGORY_LABELS["bank-statements"],
  storageFolder: VEHICLE_FINANCE_TRAINING_STORAGE_FOLDERS["bank-statements"],
  requiredFields: ["bankName", "accountHolder", "accountNumber", "statementPeriod", "closingBalance"],
  fields: [
    { key: "bankName", label: "Bank Name", kind: "text", aliases: ["bank name", "bank", "financial institution"] },
    { key: "accountHolder", label: "Account Holder", kind: "name", aliases: ["account holder", "account name", "customer name"] },
    { key: "accountNumber", label: "Account Number", kind: "identifier", aliases: ["account number", "acc no", "account no"] },
    { key: "statementPeriod", label: "Statement Period", kind: "period", aliases: ["statement period", "period", "from", "to"] },
    { key: "closingBalance", label: "Closing Balance", kind: "money", aliases: ["closing balance", "ending balance", "balance carried forward"] },
  ],
};

const PROOF_OF_ADDRESS_TEMPLATE: VehicleFinanceTrainingTemplate = {
  category: "proof-of-address",
  label: VEHICLE_FINANCE_TRAINING_CATEGORY_LABELS["proof-of-address"],
  storageFolder: VEHICLE_FINANCE_TRAINING_STORAGE_FOLDERS["proof-of-address"],
  requiredFields: ["customerName", "address", "documentDate"],
  fields: [
    { key: "customerName", label: "Customer Name", kind: "name", aliases: ["customer name", "name"] },
    { key: "address", label: "Address", kind: "text", aliases: ["address", "residential address", "physical address"] },
    { key: "documentDate", label: "Document Date", kind: "date", aliases: ["document date", "date", "issued"] },
  ],
};

const EMPLOYMENT_LETTER_TEMPLATE: VehicleFinanceTrainingTemplate = {
  category: "employment-letters",
  label: VEHICLE_FINANCE_TRAINING_CATEGORY_LABELS["employment-letters"],
  storageFolder: VEHICLE_FINANCE_TRAINING_STORAGE_FOLDERS["employment-letters"],
  requiredFields: ["employerName", "employeeName", "position", "salary", "employmentDate"],
  fields: [
    { key: "employerName", label: "Employer Name", kind: "text", aliases: ["employer", "company", "company name"] },
    { key: "employeeName", label: "Employee Name", kind: "name", aliases: ["employee name", "name"] },
    { key: "position", label: "Position", kind: "text", aliases: ["position", "job title", "role"] },
    { key: "salary", label: "Salary", kind: "money", aliases: ["salary", "remuneration", "package", "annual salary"] },
    { key: "employmentDate", label: "Employment Date", kind: "date", aliases: ["employment date", "start date", "commencement date"] },
  ],
};

export const VEHICLE_FINANCE_TRAINING_TEMPLATES: Record<VehicleFinanceTrainingCategory, VehicleFinanceTrainingTemplate> = {
  ids: ID_TEMPLATE,
  "drivers-licences": DRIVERS_LICENSE_TEMPLATE,
  payslips: PAYSLIP_TEMPLATE,
  "bank-statements": BANK_STATEMENT_TEMPLATE,
  "proof-of-address": PROOF_OF_ADDRESS_TEMPLATE,
  "employment-letters": EMPLOYMENT_LETTER_TEMPLATE,
};

export function getVehicleFinanceTrainingTemplate(category: VehicleFinanceTrainingCategory): VehicleFinanceTrainingTemplate {
  return VEHICLE_FINANCE_TRAINING_TEMPLATES[category];
}

export function getVehicleFinanceTrainingCategoryLabel(category: VehicleFinanceTrainingCategory): string {
  return VEHICLE_FINANCE_TRAINING_CATEGORY_LABELS[category];
}

export function getVehicleFinanceTrainingCategories(): VehicleFinanceTrainingCategory[] {
  return [...VEHICLE_FINANCE_TRAINING_CATEGORIES];
}

