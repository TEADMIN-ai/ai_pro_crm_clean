const UNIT_ALIASES: Record<string, string> = {
  ea: "Each",
  each: "Each",
  item: "Each",
  no: "Each",
  nr: "Each",
  kg: "kg",
  kgs: "kg",
  kilogram: "kg",
  kilograms: "kg",
  ton: "Ton",
  tonne: "Ton",
  tonnes: "Ton",
  l: "Litre",
  litre: "Litre",
  litres: "Litre",
  m: "m",
  meter: "m",
  metre: "m",
  meters: "m",
  metres: "m",
  sqm: "m²",
  "m2": "m²",
  "m²": "m²",
  "square metre": "m²",
  "square metres": "m²",
  "square meter": "m²",
  "square meters": "m²",
  cube: "m³",
  "m3": "m³",
  "m³": "m³",
  "cubic metre": "m³",
  "cubic metres": "m³",
  roll: "Roll",
  rolls: "Roll",
  bag: "Bag",
  bags: "Bag",
  box: "Box",
  boxes: "Box",
  pack: "Pack",
  packs: "Pack",
  sheet: "Sheet",
  sheets: "Sheet",
  pair: "Pair",
  pairs: "Pair",
};

export function normalizeBoqUnit(unit?: string | null): string | null {
  const normalized = unit?.trim().toLowerCase().replace(/\./g, "");
  if (!normalized) {
    return null;
  }

  return UNIT_ALIASES[normalized] ?? unit?.trim() ?? null;
}
