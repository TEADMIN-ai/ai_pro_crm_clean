'use client';

import HeroBanner from './HeroBanner';
import { useAuthContext } from '@/context/AuthContext';

export default function RoleHeroBanner() {
  const { user } = useAuthContext();

  if (!user) return null;

  switch (user.role) {
    case 'admin':
      return (
        <HeroBanner
          title="Admin Control Center"
          subtitle="System-wide visibility, governance, and performance oversight."
          image="/images/admin-banner.png"
        />
      );

    case 'manager':
      return (
        <HeroBanner
          title="Manager Dashboard"
          subtitle="Monitor your team, deals, SLAs, and revenue performance."
          image="/images/manager-banner.png"
        />
      );

    case 'staff':
      return (
        <HeroBanner
          title="My Deals"
          subtitle="Focus on assigned deals and close them faster."
          image="/images/staff-banner.png"
        />
      );

    default:
      return null;
  }
}