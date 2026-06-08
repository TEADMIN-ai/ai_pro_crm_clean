export type CalibrationOverride = {
  dx: number;
  dy: number;
  dw: number;
  dh: number;
};

export type CalibrationOverrideMap = Record<string, CalibrationOverride>;

export const SBD1_CALIBRATION_OVERRIDES: CalibrationOverrideMap = {
  company_name: {
    dx: 0,
    dy: -4,
    dw: 0,
    dh: 0,
  },
  postal_address: {
    dx: 0,
    dy: -4,
    dw: 0,
    dh: 0,
  },
  street_address: {
    dx: 0,
    dy: -4,
    dw: 0,
    dh: 0,
  },
  telephone: {
    dx: 0,
    dy: 0,
    dw: 0,
    dh: 0,
  },
  email: {
    dx: 115.7,
    dy: -67.5,
    dw: 163.07,
    dh: 0,
  },
  registration_number: {
    dx: 0,
    dy: -6,
    dw: 0,
    dh: 0,
  },
  vat_number: {
    dx: 0,
    dy: -4,
    dw: 0,
    dh: 0,
  },
  tax_pin: {
    dx: 0,
    dy: 0,
    dw: 0,
    dh: 0,
  },
  csd_number: {
    dx: 0,
    dy: 0,
    dw: 0,
    dh: 0,
  },
  foreign_supplier_yes: {
    dx: 0,
    dy: 0,
    dw: 0,
    dh: 0,
  },
  foreign_supplier_no: {
    dx: 0,
    dy: 0,
    dw: 0,
    dh: 0,
  },
  bbbee_status: {
    dx: 0,
    dy: -8,
    dw: 0,
    dh: 0,
  },
  supplier_type_pty_ltd: {
    dx: 0,
    dy: 4,
    dw: 0,
    dh: 0,
  },
  date: {
    dx: 0,
    dy: 10,
    dw: 0,
    dh: 0,
  },
};
