import { getCorporateFromAddress } from "@/lib/corporate/companyProfile";

export const ROAR_CARS_FINANCE_NOTIFICATION_RECIPIENTS = [
  "lawrence@roarcarssa.com",
  "zetania@roarcarssa.com",
] as const;

export const ROAR_CARS_GENERAL_CONTACT_RECIPIENTS = [
  "carsales@roarcarssa.com",
  "info@roarcarssa.com",
] as const;

export type RoarCarsNotificationConfig = {
  financeApplications: string[];
  generalContact: string[];
  resendFromAddress: string;
  dashboardBaseUrl: string;
};

function parseEmailList(value: string | undefined, fallback: readonly string[]): string[] {
  const raw = value?.trim();
  if (!raw) {
    return [...fallback];
  }

  return raw
    .split(/[;,\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function getRoarCarsNotificationConfig(): RoarCarsNotificationConfig {
  return {
    financeApplications: parseEmailList(
      process.env.ROAR_CARS_FINANCE_NOTIFICATION_RECIPIENTS,
      ROAR_CARS_FINANCE_NOTIFICATION_RECIPIENTS,
    ),
    generalContact: parseEmailList(
      process.env.ROAR_CARS_GENERAL_CONTACT_RECIPIENTS,
      ROAR_CARS_GENERAL_CONTACT_RECIPIENTS,
    ),
    resendFromAddress: process.env.RESEND_FROM_EMAIL?.trim() || getCorporateFromAddress("support"),
    dashboardBaseUrl: process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://ai-pro-crm-clean.vercel.app",
  };
}
