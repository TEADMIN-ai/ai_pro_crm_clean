import { teosDesignTokens } from "@/lib/design/teosDesignTokens";

const tokens = teosDesignTokens;

export const empireColors = {
  background: tokens.color.neutral[50],
  surface: tokens.color.surface.white,
  card: tokens.color.surface.white,
  border: tokens.color.neutral[200],
  primary: tokens.color.primary[600],
  primaryGlow: tokens.shadow.focus,
  accent: tokens.color.primary[700],
  accentGlow: tokens.shadow.md,
  success: tokens.color.success[600],
  warning: tokens.color.warning[600],
  danger: tokens.color.danger[700],
  info: tokens.color.primary[600],
  review: tokens.color.warning[700],
  notStarted: tokens.color.neutral[500],
  textPrimary: tokens.color.neutral[900],
  textSecondary: tokens.color.neutral[700],
};

export const empireStatusColors = {
  completed: { bg: tokens.status.success.surface, border: tokens.status.success.border, text: tokens.status.success.text },
  inProgress: { bg: tokens.status.info.surface, border: tokens.status.info.border, text: tokens.status.info.text },
  pending: { bg: tokens.status.warning.surface, border: tokens.status.warning.border, text: tokens.status.warning.text },
  review: { bg: tokens.status.warning.surface, border: tokens.status.warning.border, text: tokens.status.warning.text },
  critical: { bg: tokens.status.danger.surface, border: tokens.status.danger.border, text: tokens.status.danger.text },
  notStarted: { bg: tokens.status.neutral.surface, border: tokens.status.neutral.border, text: tokens.status.neutral.text },
} as const;
