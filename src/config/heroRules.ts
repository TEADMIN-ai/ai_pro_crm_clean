export type HeroContext = {
  role: "admin" | "manager" | "staff" | "deals";
  totalDeals?: number;
  unassignedDeals?: number;
  isMonthEnd?: boolean;
};

export function getHeroImage(context: HeroContext): string {
  const { role, totalDeals = 0, unassignedDeals = 0 } = context;

  // 🔒 ADMIN HERO (can reuse manager visual for now)
  if (role === "admin") {
    return "/images/hero-manager.jpg";
  }

  // 🔒 MANAGER HERO
  if (role === "manager") {
    if (unassignedDeals > 0) {
      return "/images/hero-manager.jpg";
    }
    return "/images/hero-manager.jpg";
  }

  // 🔒 STAFF HERO
  if (role === "staff") {
    return "/images/hero-staff.jpg";
  }

  // 🔒 DEALS PIPELINE HERO
  if (role === "deals") {
    return "/images/deals-banner.png";
  }

  // 🔒 ABSOLUTE FALLBACK
  return "/images/hero-manager.jpg";
}

