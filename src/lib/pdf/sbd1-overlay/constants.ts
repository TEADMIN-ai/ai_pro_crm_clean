import type { SBD1OverlayDefaults, SBD1OverlayFieldPlacement } from "./types";

export const SBD1_TEMPLATE_PATH = "/templates/SBD1.pdf";
export const FIELD_FONT_SIZE = 9;
export const CHECKBOX_FONT_SIZE = 10;
export const MAX_COMPANY_NAME_LENGTH = 40;

export const SBD1_FIELD_PLACEMENTS: Record<string, SBD1OverlayFieldPlacement> = {
  companyName: {
    x: 148,
    y: 431.2,
    maxWidth: 415.5,
    mask: {
      x: 144.02,
      y: 426.67,
      width: 423.07,
      height: 14.52,
    },
  },
  companyAddressLine1: {
    x: 148,
    y: 413.7,
    maxWidth: 415.5,
    mask: {
      x: 144.02,
      y: 409.15,
      width: 423.07,
      height: 14.52,
    },
  },
  companyAddressLine2: {
    x: 148,
    y: 396.2,
    maxWidth: 415.5,
    mask: {
      x: 144.02,
      y: 391.63,
      width: 423.07,
      height: 14.64,
    },
  },
  contactNumberCode: {
    x: 158,
    y: 380.7,
    maxWidth: 66,
    mask: {
      x: 144.02,
      y: 376.63,
      width: 72.74,
      height: 14.52,
    },
  },
  contactNumberValue: {
    x: 239,
    y: 380.7,
    maxWidth: 207,
    mask: {
      x: 227.57,
      y: 376.63,
      width: 214.94,
      height: 14.52,
    },
  },
  email: {
    x: 149,
    y: 290,
    maxWidth: 415.5,
    mask: {
      x: 144.02,
      y: 285.41,
      width: 423.07,
      height: 14.52,
    },
  },
  vatNumber: {
    x: 148,
    y: 258,
    maxWidth: 415.5,
    mask: {
      x: 144.02,
      y: 241.25,
      width: 423.07,
      height: 43.68,
    },
  },
};

export const SBD1_CHECKBOX_PLACEMENTS = {
  YES: { x: 420, y: 215 },
  NO: { x: 465, y: 215 },
} as const;

export const SBD1_DATE_PLACEMENT: SBD1OverlayFieldPlacement = {
  x: 180,
  y: 190,
  maxWidth: 120,
  pageIndex: -1,
};

export const SBD1_OVERLAY_DEFAULTS: SBD1OverlayDefaults = {
  companyName: "Torque Empire Pty Ltd",
  companyAddressLine1: "33 Banberry Drive Eldorado Park Ext 3",
  companyAddressLine2: "33 Banberry Drive Eldorado Park Ext 3",
  contactNumber: "0695024909",
  email: "torqueempiresa@gmail.com",
  vatNumber: "N/A",
};
