const UNIT_ALIASES: Record<string, string> = {
  each: "Each",
  ea: "Each",
  unit: "Each",
  box: "Box",
  bx: "Box",
  pack: "Pack",
  pkt: "Pack",
  bag: "Bag",
  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",
  kgs: "kg",
  ton: "Ton",
  tonne: "Ton",
  tons: "Ton",
  litre: "Litre",
  liter: "Litre",
  litres: "Litre",
  l: "Litre",
  m: "m",
  metre: "m",
  meter: "m",
  "square metres": "m²",
  "square meters": "m²",
  "square metre": "m²",
  "square meter": "m²",
  sqm: "m²",
  "m2": "m²",
  "m²": "m²",
  "cubic metres": "m³",
  "cubic meters": "m³",
  "cubic metre": "m³",
  "cubic meter": "m³",
  cbm: "m³",
  "m3": "m³",
  "m³": "m³",
  roll: "Roll",
  bundle: "Bundle",
  pair: "Pair",
  sheet: "Sheet",
};

export function normalizeImportedUnit(value: string | null | undefined, profileMappings: Record<string, string> = {}) {
  const raw = value?.trim();
  if (!raw) {
    return null;
  }

  const mapped = profileMappings[raw] ?? profileMappings[raw.toLowerCase()];
  if (mapped) {
    return mapped;
  }

  return UNIT_ALIASES[raw.toLowerCase()] ?? raw;
}
