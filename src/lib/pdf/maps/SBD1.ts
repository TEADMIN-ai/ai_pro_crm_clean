export const SBD1_FIELDS = {
  companyName: {
    x: 135,
    y: 512,
    maxWidth: 300,
  },

  registrationNumber: {
    x: 135,
    y: 490,
    maxWidth: 200,
  },

  taxNumber: {
    x: 135,
    y: 468,
    maxWidth: 200,
  },

  tenderTitle: {
    x: 135,
    y: 445,
    maxWidth: 350,
  },

  tenderNumber: {
    x: 135,
    y: 422,
    maxWidth: 200,
  },

  contactPerson: {
    x: 135,
    y: 400,
    maxWidth: 250,
  },

  contactEmail: {
    x: 135,
    y: 378,
    maxWidth: 250,
  },

  contactPhone: {
    x: 135,
    y: 356,
    maxWidth: 200,
  },

  addressLine1: {
    x: 135,
    y: 334,
    maxWidth: 350,
  },

  addressLine2: {
    x: 135,
    y: 312,
    maxWidth: 350,
  },

  date: {
    x: 400,
    y: 200,
    maxWidth: 120,
  },

  signatureName: {
    x: 135,
    y: 200,
    maxWidth: 250,
  },
} as const;

export const SBD1_CHECKBOXES = {
  isVatVendorYes: { x: 400, y: 460 },
  isVatVendorNo: { x: 460, y: 460 },

  acceptsTermsYes: { x: 400, y: 300 },
  acceptsTermsNo: { x: 460, y: 300 },
} as const;
