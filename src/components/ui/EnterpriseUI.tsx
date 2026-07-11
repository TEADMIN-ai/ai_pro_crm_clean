"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode, TableHTMLAttributes } from "react";

export type EnterpriseTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "completed"
  | "inProgress"
  | "pending"
  | "review"
  | "critical"
  | "notStarted";
export type EnterpriseActionVariant = "primary" | "secondary" | "success" | "warning" | "danger";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function getEnterpriseTone(value: string): EnterpriseTone {
  if (["Active", "Approved", "Completed", "Passed", "Paid", "Compliance Green", "Certificate Received", "Ready", "READY"].includes(value)) {
    return "success";
  }

  if (["Pending", "Scheduled", "Disposal Pending", "Compliance Warning", "In Progress", "Review", "RISK"].includes(value)) {
    return "warning";
  }

  if (["Overdue", "Compliance Expired", "Failed", "Blocked", "Rejected", "BLOCKED"].includes(value)) {
    return "danger";
  }

  return "neutral";
}

export function EnterpriseStatusBadge({
  value,
  tone,
  className,
}: {
  value: ReactNode;
  tone?: EnterpriseTone;
  className?: string;
}) {
  const resolvedTone = tone ?? (typeof value === "string" ? getEnterpriseTone(value) : "neutral");

  return (
    <span className={cx("tex-status-badge", className)} data-tone={resolvedTone}>
      {value}
    </span>
  );
}

export function EnterprisePanel({
  title,
  eyebrow,
  action,
  children,
  className,
}: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("tex-card overflow-hidden", className)}>
      <div className="flex flex-col gap-3 border-b border-[color:var(--tex-border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {eyebrow ? <p className="tex-eyebrow">{eyebrow}</p> : null}
          <h2 className="mt-1 text-xl font-bold text-[color:var(--tex-text-strong)]">{title}</h2>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function EnterpriseEmptyState({
  title,
  detail = "No records are available for this view.",
  className,
}: {
  title: string;
  detail?: string;
  className?: string;
}) {
  return (
    <div className={cx("tex-empty-state", className)}>
      <p className="font-semibold text-[color:var(--tex-text-strong)]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[color:var(--tex-text-muted)]">{detail}</p>
    </div>
  );
}

export function EnterpriseKpiCard({
  label,
  value,
  helper,
  trend,
  className,
}: {
  label: string;
  value: ReactNode;
  helper?: ReactNode;
  trend?: ReactNode;
  className?: string;
}) {
  return (
    <article className={cx("tex-metric-card", className)}>
      <p className="tex-metric-label">{label}</p>
      <div className="tex-metric-value mt-3">{value}</div>
      {helper ? <p className="tex-copy mt-3 text-sm">{helper}</p> : null}
      {trend ? <p className="mt-4 text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--tex-accent)]">{trend}</p> : null}
    </article>
  );
}

export const enterpriseActionLinkClass =
  "tex-action-button tex-action-button--secondary px-3 py-1.5 text-xs";

type EnterpriseActionButtonProps = {
  children: ReactNode;
  href?: string;
  variant?: EnterpriseActionVariant;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function EnterpriseActionButton({
  children,
  href,
  variant = "secondary",
  className,
  ...buttonProps
}: EnterpriseActionButtonProps) {
  const classes = cx(
    "tex-action-button",
    variant === "secondary" && "tex-action-button--secondary",
    variant === "danger" && "tex-action-button--danger",
    variant === "success" && "tex-action-button--success",
    variant === "warning" && "tex-action-button--warning",
    className
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" className={classes} {...buttonProps}>
      {children}
    </button>
  );
}

export function EnterpriseCard({
  children,
  className,
  interactive = false,
  ...props
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
} & HTMLAttributes<HTMLElement>) {
  return <section className={cx("tex-card", interactive && "tex-card--interactive", className)} {...props}>{children}</section>;
}

export function EnterpriseIdentityHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <header className="identity-card-header">
      <div>
        <h1 className="identity-title">{title}</h1>
        {subtitle ? <p className="identity-subtitle">{subtitle}</p> : null}
      </div>
      {children ? <div className="identity-actions">{children}</div> : null}
    </header>
  );
}

export function EnterpriseTable({
  children,
  className,
  wrapperClassName,
  ...props
}: {
  children: ReactNode;
  className?: string;
  wrapperClassName?: string;
} & TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className={cx("enterprise-table-wrap", wrapperClassName)}>
      <table className={cx("enterprise-table", className)} {...props}>{children}</table>
    </div>
  );
}

export function EnterpriseLoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <EnterpriseCard className="animate-pulse" aria-live="polite" role="status">
      <span className="text-sm font-medium text-[color:var(--tex-text-muted)]">{label}</span>
    </EnterpriseCard>
  );
}

export function EnterpriseTabs({
  items,
  active,
  className,
}: {
  items: Array<{ key: string; label: ReactNode; href: string }>;
  active: string;
  className?: string;
}) {
  return (
    <nav className={cx("flex gap-2 overflow-x-auto pb-1", className)} aria-label="Section navigation">
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          className={cx(
            "rounded-full border px-3 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--tex-focus)]",
            item.key === active
              ? "border-[color:var(--tex-nav-active-border)] bg-[color:var(--tex-nav-active-bg)] text-[color:var(--tex-text-strong)]"
              : "border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] text-[color:var(--tex-text-muted)] hover:bg-[color:var(--tex-surface-muted)]"
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
