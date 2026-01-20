type HeroContext = {
  role: 'manager' | 'staff' | 'deals';
  totalDeals?: number;
  unassignedDeals?: number;
  isMonthEnd?: boolean;
};

export function getHeroImage(context: HeroContext): string {
  const { role, totalDeals = 0, unassignedDeals = 0 } = context;

  // 🔒 MANAGER HERO LOGIC
  if (role === 'manager') {
    // If there are unassigned deals, highlight attention
    if (unassignedDeals > 0) {
      return '/images/hero-manager.jpg';
    }

    // Default manager hero
    return '/images/hero-manager.jpg';
  }

  // 🔒 STAFF HERO
  if (role === 'staff') {
    return '/images/hero-staff.jpg';
  }

  // 🔒 DEALS PIPELINE HERO
  if (role === 'deals') {
    return '/images/deals-banner.png';
  }

  // 🔒 FALLBACK (absolute safety)
  return '/images/hero-manager.jpg';
}