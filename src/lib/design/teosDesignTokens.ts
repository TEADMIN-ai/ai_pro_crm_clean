export const teosDesignTokens = {
  color: {
    primary: {
      600: "#0B63CE",
      700: "#084C9E",
    },
    secondary: {
      600: "#0F766E",
      700: "#115E59",
    },
    success: {
      50: "#DCFCE7",
      600: "#15803D",
      700: "#166534",
    },
    warning: {
      50: "#FEF3C7",
      600: "#B45309",
      700: "#92400E",
    },
    danger: {
      50: "#FEE2E2",
      600: "#DC2626",
      700: "#991B1B",
    },
    info: {
      50: "#E0F2FE",
      600: "#0369A1",
      700: "#075985",
    },
    neutral: {
      50: "#F8FAFC",
      100: "#F1F5F9",
      200: "#E2E8F0",
      500: "#64748B",
      700: "#334155",
      900: "#0F172A",
      950: "#020617",
    },
    surface: {
      white: "#FFFFFF",
    },
  },
  typography: {
    pageTitle: { fontSize: "28px", lineHeight: "36px", fontWeight: 700 },
    pageSubtitle: { fontSize: "15px", lineHeight: "24px", fontWeight: 400 },
    sectionHeading: { fontSize: "18px", lineHeight: "28px", fontWeight: 650 },
    subsectionHeading: { fontSize: "15px", lineHeight: "22px", fontWeight: 650 },
    kpiLabel: { fontSize: "12px", lineHeight: "16px", fontWeight: 700, letterSpacing: "0.08em" },
    kpiValue: { fontSize: "30px", lineHeight: "36px", fontWeight: 750 },
    body: { fontSize: "14px", lineHeight: "22px", fontWeight: 400 },
    bodyStrong: { fontSize: "14px", lineHeight: "22px", fontWeight: 600 },
    caption: { fontSize: "12px", lineHeight: "16px", fontWeight: 500 },
    buttonLabel: { fontSize: "14px", lineHeight: "20px", fontWeight: 650 },
  },
  space: {
    1: "4px",
    2: "8px",
    3: "12px",
    4: "16px",
    5: "20px",
    6: "24px",
    8: "32px",
  },
  radius: {
    sm: "6px",
    md: "8px",
    lg: "12px",
    xl: "16px",
    full: "999px",
  },
  shadow: {
    sm: "0 1px 2px rgba(15, 23, 42, 0.06)",
    md: "0 8px 24px rgba(15, 23, 42, 0.08)",
    lg: "0 18px 48px rgba(15, 23, 42, 0.10)",
    focus: "0 0 0 4px rgba(11, 99, 206, 0.18)",
  },
  component: {
    card: {
      paddingDesktop: "20px",
      paddingMobile: "16px",
      gap: "16px",
      radius: "12px",
    },
    button: {
      heightDesktop: "40px",
      heightMobile: "44px",
      paddingX: "16px",
      paddingY: "10px",
      radius: "8px",
    },
    table: {
      rowMinHeight: "44px",
      cellPaddingX: "16px",
      cellPaddingY: "12px",
    },
    form: {
      inputHeightDesktop: "40px",
      inputHeightMobile: "44px",
      fieldGap: "16px",
      labelGap: "8px",
    },
  },
  status: {
    success: { surface: "#DCFCE7", border: "#86EFAC", text: "#166534", dot: "#16A34A" },
    warning: { surface: "#FEF3C7", border: "#FCD34D", text: "#92400E", dot: "#D97706" },
    danger: { surface: "#FEE2E2", border: "#FCA5A5", text: "#991B1B", dot: "#DC2626" },
    info: { surface: "#E0F2FE", border: "#7DD3FC", text: "#075985", dot: "#0284C7" },
    neutral: { surface: "#F1F5F9", border: "#CBD5E1", text: "#334155", dot: "#64748B" },
  },
} as const;

export type TeosDesignTokens = typeof teosDesignTokens;
