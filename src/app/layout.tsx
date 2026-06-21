import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import PwaInstaller from "@/components/pwa/PwaInstaller";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  applicationName: "Torque Empire",
  appleWebApp: {
    capable: true,
    title: "Torque Empire",
    statusBarStyle: "black-translucent",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/images/logos/TE%20IN%20Partnership%20With%20Roar%20logo.png",
    apple: "/images/logos/TE%20IN%20Partnership%20With%20Roar%20logo.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#102A56",
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
