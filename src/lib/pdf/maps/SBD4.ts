export type SBD4FieldBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SBD4DirectorFieldRow = {
  name: SBD4FieldBox;
  id: SBD4FieldBox;
  entity: SBD4FieldBox;
};

export const SBD4_FIELDS = {
  companyName: {
    x: 140,
    y: 510,
    maxWidth: 320,
  },

  registrationNumber: {
    x: 140,
    y: 490,
    maxWidth: 220,
  },

  directorName: {
    x: 140,
    y: 430,
    maxWidth: 300,
  },

  directorId: {
    x: 140,
    y: 410,
    maxWidth: 220,
  },

  signatureName: {
    x: 140,
    y: 220,
    maxWidth: 300,
  },

  date: {
    x: 420,
    y: 220,
    maxWidth: 120,
  },
} as const;

export const SBD4_FIELD_MAP = {
  directors: [
    {
      name: { x: 118.35, y: 313.95, width: 110, height: 12 },
      id: { x: 239.175, y: 313.95, width: 110, height: 12 },
      entity: { x: 371.34, y: 313.95, width: 120, height: 12 },
    },
    {
      name: { x: 118.35, y: 285.95, width: 110, height: 12 },
      id: { x: 239.175, y: 285.95, width: 110, height: 12 },
      entity: { x: 371.34, y: 285.95, width: 120, height: 12 },
    },
  ],
  answer: { x: 472, y: 606, width: 30, height: 12 },
  name: { x: 278, y: 358, width: 170, height: 12 },
  date: { x: 282, y: 399, width: 120, height: 12 },
} as const satisfies {
  directors: readonly SBD4DirectorFieldRow[];
  answer: SBD4FieldBox;
  name: SBD4FieldBox;
  date: SBD4FieldBox;
};
