import { useMemo } from 'react';
import { HERO_CAMPAIGNS, HeroCampaign } from '@/config/heroCampaigns';

function isWithinDateRange(
  campaign: HeroCampaign,
  today: Date
): boolean {
  if (!campaign.startDate && !campaign.endDate) return true;

  const start = campaign.startDate ? new Date(campaign.startDate) : null;
  const end = campaign.endDate ? new Date(campaign.endDate) : null;

  if (start && today < start) return false;
  if (end && today > end) return false;

  return true;
}

export function useHeroCampaign(role: 'manager' | 'staff' | 'deals') {
  return useMemo(() => {
    const today = new Date();

    // Priority: active campaigns by date
    const activeCampaign = HERO_CAMPAIGNS.find(
      (c) =>
        c.roles.includes(role) &&
        isWithinDateRange(c, today)
    );

    // Fallback: first role-based default
    return (
      activeCampaign ||
      HERO_CAMPAIGNS.find((c) => c.roles.includes(role))
    );
  }, [role]);
}

