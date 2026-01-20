import { Deal } from '@/types/deal';

export const KPI_DEFINITIONS = [
  {
    key: 'totalDeals',
    label: 'Total Deals',
    roles: ['manager'],
    compute: (deals: Deal[]) => deals.length,
  },
  {
    key: 'unassigned',
    label: 'Unassigned',
    roles: ['manager'],
    compute: (deals: Deal[]) =>
      deals.filter(d => !d.ownerId).length,
  },
  {
    key: 'myDeals',
    label: 'My Deals',
    roles: ['staff'],
    compute: (deals: Deal[]) => deals.length,
  },
  {
    key: 'won',
    label: 'Won',
    roles: ['manager', 'staff'],
    compute: (deals: Deal[]) =>
      deals.filter(d => d.stage === 'won').length,
  },
  {
    key: 'lost',
    label: 'Lost',
    roles: ['manager', 'staff'],
    compute: (deals: Deal[]) =>
      deals.filter(d => d.stage === 'lost').length,
  },
];