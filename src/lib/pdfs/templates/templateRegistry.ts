import type { CompanyProfile } from "@/lib/autofill/buildCompanyProfile";
import type { SbdFormKey } from "@/lib/pdfs/templates/sbdSchema";

export type TemplateFieldMap = Partial<Record<string, keyof CompanyProfile>>;

export type TemplateOverlayField = {
  profileKey: keyof CompanyProfile;
  page: number;
  x: number;
  y: number;
  size?: number;
  maxWidth?: number;
  lineHeight?: number;
};

export type TemplateOverlayMap = Record<string, TemplateOverlayField>;

export type TemplateRegistryEntry = {
  templateKey: SbdFormKey;
  pdfRelativePath: string;
  fieldMap?: TemplateFieldMap;
  overlayMap?: TemplateOverlayMap;
};

const COMMON_FIELD_MAP: TemplateFieldMap = {
  companyName: "companyName",
  regNumber: "regNumber",
  vatNumber: "vatNumber",
  taxPin: "taxPin",
  cidb: "cidb",
  csdNumber: "csdNumber",
  bankingDetails: "bankingDetails",
  directors: "directors",
  address: "address",
  contactPerson: "contactPerson",
  email: "email",
  phone: "phone",
};

const SBD8_OVERLAY_MAP: TemplateOverlayMap = {
  companyName: {
    profileKey: "companyName",
    page: 0,
    x: 118,
    y: 622,
    size: 11,
    maxWidth: 360,
  },
  regNumber: {
    profileKey: "regNumber",
    page: 0,
    x: 118,
    y: 596,
    size: 11,
    maxWidth: 220,
  },
  directors: {
    profileKey: "directors",
    page: 0,
    x: 118,
    y: 570,
    size: 10,
    maxWidth: 420,
    lineHeight: 12,
  },
  vatNumber: {
    profileKey: "vatNumber",
    page: 0,
    x: 118,
    y: 544,
    size: 11,
    maxWidth: 240,
  },
  taxPin: {
    profileKey: "taxPin",
    page: 0,
    x: 118,
    y: 518,
    size: 11,
    maxWidth: 240,
  },
};

const SBD1_OVERLAY_MAP: TemplateOverlayMap = {
  companyName: {
    profileKey: "companyName",
    page: 0,
    x: 148,
    y: 431.2,
    size: 10,
    maxWidth: 415.5,
  },
  postalAddress: {
    profileKey: "address",
    page: 0,
    x: 148,
    y: 413.7,
    size: 10,
    maxWidth: 415.5,
  },
  streetAddress: {
    profileKey: "address",
    page: 0,
    x: 148,
    y: 396.2,
    size: 10,
    maxWidth: 415.5,
  },
  telephone: {
    profileKey: "phone",
    page: 0,
    x: 239,
    y: 380.7,
    size: 10,
    maxWidth: 207,
  },
  cellphone: {
    profileKey: "phone",
    page: 0,
    x: 148,
    y: 337,
    size: 10,
    maxWidth: 415.5,
  },
  email: {
    profileKey: "email",
    page: 0,
    x: 149,
    y: 290,
    size: 10,
    maxWidth: 415.5,
  },
  vatNumber: {
    profileKey: "vatNumber",
    page: 0,
    x: 148,
    y: 258,
    size: 10,
    maxWidth: 415.5,
  },
  taxPin: {
    profileKey: "taxPin",
    page: 0,
    x: 238,
    y: 186.8,
    size: 10,
    maxWidth: 62,
  },
  csdNumber: {
    profileKey: "csdNumber",
    page: 0,
    x: 436,
    y: 185.8,
    size: 10,
    maxWidth: 131,
  },
};

export const TEMPLATE_REGISTRY: Record<SbdFormKey, TemplateRegistryEntry> = {
  sbd1: {
    templateKey: "sbd1",
    pdfRelativePath: "src/lib/pdfs/templates/tender-packs/sbd1.pdf",
    fieldMap: COMMON_FIELD_MAP,
    overlayMap: SBD1_OVERLAY_MAP,
  },
  sbd2: {
    templateKey: "sbd2",
    pdfRelativePath: "src/lib/pdfs/templates/tender-packs/sbd2.pdf",
    fieldMap: COMMON_FIELD_MAP,
  },
  sbd3: {
    templateKey: "sbd3",
    pdfRelativePath: "src/lib/pdfs/templates/tender-packs/sbd3.pdf",
    fieldMap: COMMON_FIELD_MAP,
  },
  sbd4: {
    templateKey: "sbd4",
    pdfRelativePath: "src/lib/pdfs/templates/tender-packs/sbd4.pdf",
    fieldMap: COMMON_FIELD_MAP,
  },
  sbd5: {
    templateKey: "sbd5",
    pdfRelativePath: "src/lib/pdfs/templates/tender-packs/sbd5.pdf",
    fieldMap: COMMON_FIELD_MAP,
  },
  sbd6: {
    templateKey: "sbd6",
    pdfRelativePath: "src/lib/pdfs/templates/tender-packs/sbd6.pdf",
    fieldMap: COMMON_FIELD_MAP,
  },
  sbd7: {
    templateKey: "sbd7",
    pdfRelativePath: "src/lib/pdfs/templates/tender-packs/sbd7.pdf",
    fieldMap: COMMON_FIELD_MAP,
  },
  sbd8: {
    templateKey: "sbd8",
    pdfRelativePath: "src/lib/pdfs/templates/tender-packs/sbd8.pdf",
    fieldMap: COMMON_FIELD_MAP,
    overlayMap: SBD8_OVERLAY_MAP,
  },
  sbd9: {
    templateKey: "sbd9",
    pdfRelativePath: "src/lib/pdfs/templates/tender-packs/sbd9.pdf",
    fieldMap: COMMON_FIELD_MAP,
  },
  annexures: {
    templateKey: "annexures",
    pdfRelativePath: "src/lib/pdfs/templates/tender-packs/annexures.pdf",
    fieldMap: COMMON_FIELD_MAP,
  },
  addendums: {
    templateKey: "addendums",
    pdfRelativePath: "src/lib/pdfs/templates/tender-packs/addendums.pdf",
    fieldMap: COMMON_FIELD_MAP,
  },
};
