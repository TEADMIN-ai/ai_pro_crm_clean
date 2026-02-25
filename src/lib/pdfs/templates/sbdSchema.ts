export type SbdFormKey =
  | "sbd1"
  | "sbd2"
  | "sbd3"
  | "sbd4"
  | "sbd5"
  | "sbd6"
  | "sbd7"
  | "sbd8"
  | "sbd9"
  | "annexures"
  | "addendums";

export type SbdFieldKey =
  | "companyName"
  | "regNumber"
  | "vatNumber"
  | "taxPin"
  | "cidb"
  | "csdNumber"
  | "bankingDetails"
  | "directors"
  | "address"
  | "contactPerson"
  | "email"
  | "phone";

export type SbdFieldDefinition = {
  key: SbdFieldKey;
  required: boolean;
  label: string;
};

export type SbdFormDefinition = {
  key: SbdFormKey;
  requiredFields: SbdFieldKey[];
  optionalFields: SbdFieldKey[];
};

export const SBD_FIELD_DEFINITIONS: Record<SbdFieldKey, SbdFieldDefinition> = {
  companyName: { key: "companyName", required: true, label: "Company Name" },
  regNumber: { key: "regNumber", required: true, label: "Registration Number" },
  vatNumber: { key: "vatNumber", required: false, label: "VAT Number" },
  taxPin: { key: "taxPin", required: false, label: "Tax PIN" },
  cidb: { key: "cidb", required: false, label: "CIDB Number" },
  csdNumber: { key: "csdNumber", required: false, label: "CSD Number" },
  bankingDetails: { key: "bankingDetails", required: true, label: "Banking Details" },
  directors: { key: "directors", required: true, label: "Directors" },
  address: { key: "address", required: true, label: "Address" },
  contactPerson: { key: "contactPerson", required: true, label: "Contact Person" },
  email: { key: "email", required: true, label: "Email" },
  phone: { key: "phone", required: true, label: "Phone" },
};

export const SBD_SCHEMA: Record<SbdFormKey, SbdFormDefinition> = {
  sbd1: {
    key: "sbd1",
    requiredFields: ["companyName", "regNumber", "contactPerson", "email", "phone", "address"],
    optionalFields: ["vatNumber", "taxPin", "cidb", "csdNumber"],
  },
  sbd2: {
    key: "sbd2",
    requiredFields: ["companyName", "regNumber", "directors", "address"],
    optionalFields: ["vatNumber", "taxPin", "cidb"],
  },
  sbd3: {
    key: "sbd3",
    requiredFields: ["companyName", "regNumber", "bankingDetails"],
    optionalFields: ["vatNumber", "taxPin", "csdNumber"],
  },
  sbd4: {
    key: "sbd4",
    requiredFields: ["companyName", "directors", "contactPerson", "email"],
    optionalFields: ["phone", "address"],
  },
  sbd5: {
    key: "sbd5",
    requiredFields: ["companyName", "regNumber", "taxPin"],
    optionalFields: ["vatNumber", "csdNumber", "cidb"],
  },
  sbd6: {
    key: "sbd6",
    requiredFields: ["companyName", "regNumber", "contactPerson"],
    optionalFields: ["email", "phone", "address"],
  },
  sbd7: {
    key: "sbd7",
    requiredFields: ["companyName", "regNumber", "address", "contactPerson"],
    optionalFields: ["phone", "email"],
  },
  sbd8: {
    key: "sbd8",
    requiredFields: ["companyName", "directors", "regNumber"],
    optionalFields: ["taxPin", "vatNumber"],
  },
  sbd9: {
    key: "sbd9",
    requiredFields: ["companyName", "regNumber", "contactPerson", "email"],
    optionalFields: ["phone", "address", "bankingDetails"],
  },
  annexures: {
    key: "annexures",
    requiredFields: ["companyName", "regNumber"],
    optionalFields: ["cidb", "csdNumber", "bankingDetails", "directors", "address"],
  },
  addendums: {
    key: "addendums",
    requiredFields: ["companyName", "regNumber", "contactPerson"],
    optionalFields: ["email", "phone", "address"],
  },
};

export const SBD_TEMPLATE_KEYS = Object.keys(SBD_SCHEMA) as SbdFormKey[];
