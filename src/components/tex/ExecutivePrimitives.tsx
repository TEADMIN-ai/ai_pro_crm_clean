import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import {
  EnterpriseCard,
  EnterpriseKpiCard,
  EnterpriseStatusBadge,
  type EnterpriseActionVariant,
  type EnterpriseTone,
} from "@/components/ui/EnterpriseUI";

type ModuleAccent =
  | "dashboard"
  | "qs"
  | "supplier"
  | "procurement"
  | "hygiene"
  | "vehicle-finance"
  | "ai"
  | "admin";

type Tone = EnterpriseTone;

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function DashboardShell({
  module,
  focus = false,
  children,
  className,
}: {
  module: ModuleAccent;
  focus?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div data-module={module} className={cx("tex-shell", focus && "tex-shell--focus", className)}>
      {children}
    </div>
  );
}

export function ModuleHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cx("tex-module-header", className)}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-4xl">
          <p className="tex-eyebrow">{eyebrow}</p>
          <h1 className="tex-title mt-3">{title}</h1>
          {description ? <p className="tex-copy mt-3 max-w-3xl text-sm">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children ? <div className="mt-5">{children}</div> : null}
    </header>
  );
}

export function DashboardCard({
  children,
  className,
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return <EnterpriseCard className={className} interactive={interactive}>{children}</EnterpriseCard>;
}

export function MetricCard({
  label,
  value,
  description,
  trend,
  className,
}: {
  label: string;
  value: ReactNode;
  description?: ReactNode;
  trend?: ReactNode;
  className?: string;
}) {
  return <EnterpriseKpiCard label={label} value={value} helper={description} trend={trend} className={className} />;
}
export function StatusBadge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return <EnterpriseStatusBadge value={children} tone={tone} className={className} />;
}
export function InsightPanel({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("tex-insight-panel", className)}>
      {title ? <p className="tex-eyebrow">{title}</p> : null}
      <div className={title ? "mt-3" : undefined}>{children}</div>
    </section>
  );
}

type ActionButtonProps = {
  href?: string;
  variant?: EnterpriseActionVariant;
  children: ReactNode;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function ActionButton({ href, variant = "primary", children, className, ...buttonProps }: ActionButtonProps) {
  const classes = cx("tex-action-button", variant === "secondary" && "tex-action-button--secondary", className);

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

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("tex-empty-state", className)}>
      <p className="font-semibold text-[color:var(--tex-text-strong)]">{title}</p>
      {description ? <p className="mt-2 text-sm">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function MediaCard({
  title,
  description,
  src,
  poster,
  alt,
  mediaType = "image",
  meta,
  className,
}: {
  title: string;
  description?: string;
  src?: string;
  poster?: string;
  alt?: string;
  mediaType?: "image" | "video";
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <article className={cx("tex-media-card", className)}>
      <div className="tex-media-card__frame">
        {mediaType === "video" && src ? (
          <video className="h-full w-full object-cover" controls preload="metadata" poster={poster}>
            <source src={src} />
          </video>
        ) : src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt ?? title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm font-semibold text-[color:var(--tex-text-muted)]">
            Media-ready executive card
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-[color:var(--tex-text-strong)]">{title}</h3>
        {description ? <p className="tex-copy mt-2 text-sm">{description}</p> : null}
        {meta ? <div className="mt-3">{meta}</div> : null}
      </div>
    </article>
  );
}

export function AIRecommendationCard({
  title,
  confidence,
  children,
  actions,
  className,
}: {
  title: string;
  confidence?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <article className={cx("tex-ai-card", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="tex-eyebrow">AI Recommendation</p>
          <h3 className="mt-2 font-semibold text-[color:var(--tex-text-strong)]">{title}</h3>
        </div>
        {confidence ? <StatusBadge tone="info">{confidence}</StatusBadge> : null}
      </div>
      <div className="tex-copy mt-3 text-sm">{children}</div>
      {actions ? <div className="mt-4 flex flex-wrap gap-2">{actions}</div> : null}
    </article>
  );
}
