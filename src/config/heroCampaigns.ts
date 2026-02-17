export type HeroCampaign = {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  startDate?: string; // ISO date
  endDate?: string;   // ISO date
  roles: Array<'manager' | 'staff' | 'deals'>;
};

export const HERO_CAMPAIGNS: HeroCampaign[] = [
  {
    id: 'default-manager',
    title: 'Manager Dashboard',
    subtitle: 'Monitor deals, performance, and pipeline health.',
    image: '/images/hero-manager.jpg',
    roles: ['manager'],
  },
  {
    id: 'default-staff',
    title: 'Staff Dashboard',
    subtitle: 'Your assigned deals and daily actions.',
    image: '/images/hero-staff.jpg',
    roles: ['staff'],
  },
  {
    id: 'default-deals',
    title: 'Deals Pipeline',
    subtitle: 'Track, manage, and move deals through each stage.',
    image: '/images/deals-banner.png',
    roles: ['deals'],
  },

  // Example campaign (can be toggled by date)
  {
    id: 'q1-growth',
    title: 'Q1 Growth Campaign',
    subtitle: 'Focus on conversion and pipeline velocity.',
    image: '/images/banners/manager-banner.png',
    startDate: '2026-01-01',
    endDate: '2026-03-31',
    roles: ['manager'],
  },
];

