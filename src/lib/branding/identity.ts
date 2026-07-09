export const TORQUE_EMPIRE_BRAND = {
  companyName: "Torque Empire (Pty) Ltd",
  brandName: "Torque Empire",
  platformName: "Torque Empire",
  shortName: "Torque Empire",
  tagline: "Four Divisions. One Vision. Total Excellence.",
  division: "TEOS Platform",
  websiteUrl: "https://www.torqueempire.net",
  description: "Torque Empire (Pty) Ltd is a South African technology and professional services company delivering procurement, hygiene, telecommunications, and TEOS business systems.",
  colors: {
    navy: "#07111f",
    blue: "#0b2f57",
    cobalt: "#1d4ed8",
    slate: "#475569",
    border: "#d9e2ec",
    surface: "#f4f7fb",
    text: "#07111f",
    textMuted: "#5b6878",
    white: "#ffffff",
    critical: "#b91c1c",
  },
} as const;

export const TORQUE_EMPIRE_BRAND_ASSETS = {
  logoPrimarySvg: "/corporate/logo/torque-empire-primary.svg",
  logoPrimaryPng: "/corporate/logo/torque-empire-primary.png",
  logoDarkPng: "/corporate/logo/torque-empire-dark.png",
  logoLightPng: "/corporate/logo/torque-empire-light.png",
  monogramSvg: "/corporate/logo/torque-empire-monogram.svg",
  faviconPng: "/corporate/logo/favicon.png",
} as const;

export type TorqueEmpireBrandAssetName = keyof typeof TORQUE_EMPIRE_BRAND_ASSETS;
