// src/config/heroRules.ts
export type HeroContext = {
  role: 'manager' | 'staff' | 'deals';
  totalDeals?: number;
  unassignedDeals?: number;
  isMonthEnd?: boolean;
};

export function getHeroImage(context: HeroContext): string {
  const { role, totalDeals = 0, unassignedDeals = 0, isMonthEnd } = context;

  // Manager logic
  if (role === 'manager') {
    if (isMonthEnd) return '/images/hero-manager-campaign.jpg';
    if (unassignedDeals >= 5) return '/images/hero-manager-attention.jpg';
    if (totalDeals === 0) return '/images/hero-manager-empty.jpg';
    return '/images/hero-manager.jpg';
  }

  // Staff logic (future-ready)
  if (role === 'staff') {
    return '/images/hero-staff.jpg';
  }

  // Deals logic
  if (role === 'deals') {
    return '/images/hero-deals.jpg';
  }

  return '/images/hero-manager.jpg';
}