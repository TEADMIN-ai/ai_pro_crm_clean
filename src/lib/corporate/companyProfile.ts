import { TORQUE_EMPIRE_BRAND, TORQUE_EMPIRE_BRAND_ASSETS } from "@/lib/branding/identity";

export type CorporateEmailKey = "info" | "director" | "support" | "accounts" | "sales";

export type SupportContact = {
  label: string;
  emailKey: CorporateEmailKey;
  purpose: string;
};

export type SocialLink = {
  label: string;
  href: string | null;
};

export const TORQUE_EMPIRE_COMPANY_PROFILE = {
  companyName: TORQUE_EMPIRE_BRAND.companyName,
  tradingName: TORQUE_EMPIRE_BRAND.brandName,
  tagline: "Four Divisions. One Vision. Total Excellence.",
  website: TORQUE_EMPIRE_BRAND.websiteUrl,
  logo: TORQUE_EMPIRE_BRAND_ASSETS.logoPrimaryPng,
  businessEmails: {
    info: "info@torqueempire.net",
    director: "chadwin@torqueempire.net",
    support: "support@torqueempire.net",
    accounts: "accounts@torqueempire.net",
    sales: "sales@torqueempire.net",
  },
  telephone: "069 502 4909",
  serviceArea: "South Africa",
  socialLinks: [
    { label: "LinkedIn", href: null },
    { label: "Facebook", href: null },
    { label: "X", href: null },
  ] satisfies SocialLink[],
  supportContacts: [
    {
      label: "General Enquiries",
      emailKey: "info",
      purpose: "Government, enterprise, supplier, and partnership enquiries.",
    },
    {
      label: "Director",
      emailKey: "director",
      purpose: "Executive and strategic stakeholder communication.",
    },
    {
      label: "Support",
      emailKey: "support",
      purpose: "Operational assistance and platform support.",
    },
    {
      label: "Accounts",
      emailKey: "accounts",
      purpose: "Billing, supplier, and account administration.",
    },
    {
      label: "Sales",
      emailKey: "sales",
      purpose: "Commercial discussions and service enquiries.",
    },
  ] satisfies SupportContact[],
  disclaimer:
    "This communication is intended for the named recipient and may contain confidential business information. If received in error, please notify Torque Empire and delete it. Torque Empire accepts no liability for unauthorised use or alteration of this communication.",
} as const;

export function getCorporateEmail(key: CorporateEmailKey): string {
  return TORQUE_EMPIRE_COMPANY_PROFILE.businessEmails[key];
}

export function getCorporateMailto(key: CorporateEmailKey, subject?: string): string {
  const email = getCorporateEmail(key);
  const query = subject ? `?subject=${encodeURIComponent(subject)}` : "";
  return `mailto:${email}${query}`;
}

export function getCorporateFromAddress(key: CorporateEmailKey = "support"): string {
  return `${TORQUE_EMPIRE_COMPANY_PROFILE.tradingName} <${getCorporateEmail(key)}>`;
}
