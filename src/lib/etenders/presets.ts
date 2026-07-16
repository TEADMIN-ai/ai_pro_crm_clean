import type { EtendersSectorPresetId } from "@/lib/etenders/types";

export const ETENDERS_SECTOR_PRESETS: Array<{
  id: EtendersSectorPresetId;
  label: string;
  keywords: string[];
  categories: string[];
}> = [
  {
    id: "hygiene-sanitary-waste",
    label: "Hygiene and sanitary-waste services",
    keywords: ["hygiene", "sanitary", "sanitary waste", "washroom", "pest"],
    categories: ["Services: General", "Services to buildings and landscape activities", "Waste collection, treatment and disposal activities; materials recovery"],
  },
  {
    id: "waste-collection-disposal",
    label: "Waste collection and disposal",
    keywords: ["waste", "refuse", "disposal", "recycling", "materials recovery"],
    categories: ["Waste collection, treatment and disposal activities; materials recovery", "Remediation activities and other waste management services"],
  },
  {
    id: "cleaning-facilities",
    label: "Cleaning and facilities services",
    keywords: ["cleaning", "facilities", "janitorial", "building services"],
    categories: ["Services: Functional (Including Cleaning and Security Services)", "Services to buildings and landscape activities"],
  },
  {
    id: "procurement-general-supplies",
    label: "Procurement and general supplies",
    keywords: ["supply", "supplies", "procurement", "consumables"],
    categories: ["Supplies: General", "Services: General"],
  },
  {
    id: "construction-maintenance",
    label: "Construction and maintenance",
    keywords: ["construction", "maintenance", "repair", "renovation"],
    categories: ["Construction", "Construction of buildings", "Specialised construction activities", "Repair and installation of machinery and equipment"],
  },
  {
    id: "civil-works",
    label: "Civil works",
    keywords: ["civil", "road", "stormwater", "earthworks", "infrastructure"],
    categories: ["Civil engineering", "Services: Civil"],
  },
  {
    id: "telecommunications-fibre",
    label: "Telecommunications and fibre",
    keywords: ["telecommunications", "fibre", "fiber", "network", "broadband"],
    categories: ["Telecommunications", "Information and communication"],
  },
  {
    id: "transport-logistics",
    label: "Transport and logistics",
    keywords: ["transport", "logistics", "fleet", "courier", "warehousing"],
    categories: ["Transportation and storage", "Land transport and transport via pipelines", "Postal and courier activities"],
  },
  {
    id: "water-sanitation",
    label: "Water and sanitation",
    keywords: ["water", "sanitation", "sewerage", "wastewater"],
    categories: ["Water collection, treatment and supply", "Water supply; sewerage, waste management and remediation activities", "Sewerage"],
  },
];

export function getEtendersSectorPreset(id?: string | null) {
  return ETENDERS_SECTOR_PRESETS.find((preset) => preset.id === id) ?? null;
}

