import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import PwaInstaller from "@/components/pwa/PwaInstaller";
import { TORQUE_EMPIRE_BRAND } from "@/lib/branding/identity";
import { TORQUE_EMPIRE_COMPANY_PROFILE } from "@/lib/corporate/companyProfile";
import type { Metadata, Viewport } from "next";

const appTitle = TORQUE_EMPIRE_COMPANY_PROFILE.tradingName;
const appDescription = `${TORQUE_EMPIRE_COMPANY_PROFILE.companyName} - ${TORQUE_EMPIRE_COMPANY_PROFILE.tagline}`;

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? TORQUE_EMPIRE_COMPANY_PROFILE.website),
  applicationName: TORQUE_EMPIRE_COMPANY_PROFILE.tradingName,
  title: {
    default: appTitle,
    template: `%s | ${TORQUE_EMPIRE_COMPANY_PROFILE.tradingName}`,
  },
  description: appDescription,
  keywords: ["Torque Empire", "South Africa", "professional services", "technology", "TEOS", "procurement", "telecommunications", "hygiene"],
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large", "max-video-preview": -1 } },
  appleWebApp: {
    capable: true,
    title: TORQUE_EMPIRE_COMPANY_PROFILE.tradingName,
    statusBarStyle: "black-translucent",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon", sizes: "512x512", type: "image/png" },
      { url: "/corporate/logo/favicon.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon", sizes: "180x180", type: "image/png" }],
    shortcut: ["/icon"],
  },
  openGraph: {
    type: "website",
    locale: "en_ZA",
    url: TORQUE_EMPIRE_COMPANY_PROFILE.website,
    siteName: TORQUE_EMPIRE_COMPANY_PROFILE.tradingName,
    title: TORQUE_EMPIRE_COMPANY_PROFILE.tradingName,
    description: appDescription,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: TORQUE_EMPIRE_COMPANY_PROFILE.tradingName }],
  },
  twitter: {
    card: "summary_large_image",
    title: TORQUE_EMPIRE_COMPANY_PROFILE.tradingName,
    description: appDescription,
    images: ["/opengraph-image"],
  },
};

export const viewport: Viewport = {
  themeColor: TORQUE_EMPIRE_BRAND.colors.blue,
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <PwaInstaller />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}

