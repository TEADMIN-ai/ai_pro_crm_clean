import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import PwaInstaller from "@/components/pwa/PwaInstaller";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://www.torqueempire.net"),
  applicationName: "Torque Empire AI Pro CRM",
  title: {
    default: "Torque Empire AI Pro CRM",
    template: "%s | Torque Empire",
  },
  description: "Torque Empire AI Pro CRM executive operations workspace.",
  appleWebApp: {
    capable: true,
    title: "Torque Empire",
    statusBarStyle: "black-translucent",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico"],
  },
  openGraph: {
    title: "Torque Empire AI Pro CRM",
    description: "Executive operations workspace for Torque Empire.",
    images: [{ url: "/icons/icon-512.png", width: 512, height: 512, alt: "Torque Empire app icon" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#071426",
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
