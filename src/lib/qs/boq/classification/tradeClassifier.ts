import type { QsBoqTrade } from "@/types/qs";

export const QS_BOQ_TRADES: QsBoqTrade[] = [
  "General",
  "Earthworks",
  "Concrete",
  "Brickwork",
  "Steel",
  "Roofing",
  "Doors",
  "Windows",
  "Electrical",
  "Lighting",
  "Plumbing",
  "Sanitary",
  "Painting",
  "Flooring",
  "Ceilings",
  "Drywall",
  "External Works",
  "Civil",
  "Landscaping",
  "Other",
];

const TRADE_KEYWORDS: Record<QsBoqTrade, string[]> = {
  General: ["prelim", "general", "site establishment", "supervision"],
  Earthworks: ["excavat", "earth", "trench", "backfill", "spoil", "compaction"],
  Concrete: ["concrete", "cement", "formwork", "slab", "foundation", "reinforced"],
  Brickwork: ["brick", "block", "masonry", "walling", "lintel"],
  Steel: ["steel", "rebar", "reinforcement", "mesh", "structural steel"],
  Roofing: ["roof", "truss", "sheeting", "gutter", "fascia"],
  Doors: ["door", "frame", "ironmongery"],
  Windows: ["window", "glazing", "aluminium frame"],
  Electrical: ["electrical", "cable", "db board", "socket", "conduit"],
  Lighting: ["light", "luminaire", "downlight", "fitting"],
  Plumbing: ["plumbing", "pipe", "valve", "water", "drain"],
  Sanitary: ["toilet", "basin", "sanitary", "urinal", "shower"],
  Painting: ["paint", "primer", "coat", "plaster primer"],
  Flooring: ["floor", "tile", "vinyl", "screed", "carpet"],
  Ceilings: ["ceiling", "cornice", "suspended"],
  Drywall: ["drywall", "partition", "gypsum", "stud"],
  "External Works": ["external", "paving", "kerb", "fence", "gate"],
  Civil: ["civil", "stormwater", "road", "culvert", "manhole"],
  Landscaping: ["landscape", "grass", "topsoil", "irrigation", "plant"],
  Other: [],
};

export function classifyBoqTrade(text: string): QsBoqTrade {
  const normalized = text.toLowerCase();
  let bestTrade: QsBoqTrade = "Other";
  let bestScore = 0;

  for (const [trade, keywords] of Object.entries(TRADE_KEYWORDS) as Array<[QsBoqTrade, string[]]>) {
    const score = keywords.reduce((total, keyword) => total + (normalized.includes(keyword) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestTrade = trade;
    }
  }

  return bestScore > 0 ? bestTrade : "Other";
}

export function getBoqTradeKeywords(trade: QsBoqTrade): string[] {
  return TRADE_KEYWORDS[trade] ?? [];
}
