import type { CSSProperties, ReactNode } from "react";
import { teosDesignTokens } from "@/lib/design/teosDesignTokens";

export type OperationsTone = "neutral" | "success" | "warning" | "danger" | "info";

export type ExecutiveKpiItem = {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: OperationsTone;
};

export type ExecutiveSummaryItem = {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: OperationsTone;
};

export type OperationalHealthItem = {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: OperationsTone;
  progress?: number;
};

export type ExecutiveInsightItem = {
  title: string;
  body: ReactNode;
  confidence?: ReactNode;
  tone?: OperationsTone;
};

export type PriorityItem = {
  title: string;
  detail?: ReactNode;
  owner?: ReactNode;
  due?: ReactNode;
  tone?: OperationsTone;
};

export type ActivityTimelineItem = {
  title: string;
  detail?: ReactNode;
  time?: ReactNode;
  tone?: OperationsTone;
};

export type NotificationCentreItem = {
  title: string;
  detail?: ReactNode;
  meta?: ReactNode;
  tone?: OperationsTone;
};

export type WorkspaceStatusItem = {
  label: string;
  value: ReactNode;
  tone?: OperationsTone;
};

const tokens = teosDesignTokens;

const operationsStyle = {
  "--ops-primary": tokens.color.primary[600],
  "--ops-secondary": tokens.color.secondary[600],
  "--ops-border": tokens.color.neutral[200],
  "--ops-surface": tokens.color.surface.white,
  "--ops-surface-muted": tokens.color.neutral[50],
  "--ops-text": tokens.color.neutral[900],
  "--ops-text-muted": tokens.color.neutral[700],
  "--ops-text-subtle": tokens.color.neutral[500],
  "--ops-success": tokens.color.success[600],
  "--ops-warning": tokens.color.warning[600],
  "--ops-danger": tokens.color.danger[600],
  "--ops-info": tokens.color.info[600],
  "--ops-shadow": tokens.shadow.md,
} as CSSProperties;

const toneClasses: Record<OperationsTone, string> = {
  neutral: "border-slate-300 bg-slate-50 text-slate-900",
  success: "border-[color:var(--ops-success)] bg-emerald-50 text-emerald-950",
  warning: "border-[color:var(--ops-warning)] bg-amber-50 text-amber-950",
  danger: "border-[color:var(--ops-danger)] bg-red-50 text-red-950",
  info: "border-[color:var(--ops-info)] bg-sky-50 text-sky-950",
};

const dotClasses: Record<OperationsTone, string> = {
  neutral: "bg-slate-500",
  success: "bg-[color:var(--ops-success)]",
  warning: "bg-[color:var(--ops-warning)]",
  danger: "bg-[color:var(--ops-danger)]",
  info: "bg-[color:var(--ops-info)]",
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function clampProgress(value: number | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return Math.max(0, Math.min(100, value));
}

function OperationsCard({
  title,
  eyebrow,
  children,
  action,
  className,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("rounded-xl border border-[color:var(--ops-border)] bg-[color:var(--ops-surface)] p-5 shadow-[var(--ops-shadow)]", className)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          {eyebrow ? <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--ops-text-subtle)]">{eyebrow}</p> : null}
          <h2 className="mt-1 text-lg font-bold text-[color:var(--ops-text)]">{title}</h2>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function ExecutiveSummaryStrip({
  title,
  summary,
  items,
  children,
  className,
}: {
  title: string;
  summary?: ReactNode;
  items?: ExecutiveSummaryItem[];
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx("rounded-xl border border-[color:var(--ops-border)] bg-[color:var(--ops-surface)] p-5 shadow-[var(--ops-shadow)]", className)}
      style={operationsStyle}
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--ops-secondary)]">Enterprise Operations Centre</p>
          <h1 className="mt-2 text-2xl font-bold text-[color:var(--ops-text)]">{title}</h1>
          {summary ? <p className="mt-3 max-w-4xl text-sm leading-6 text-[color:var(--ops-text-muted)]">{summary}</p> : null}
          {children ? <div className="mt-4">{children}</div> : null}
        </div>
        {items?.length ? (
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            {items.map((item) => (
              <div key={item.label} className={cx("rounded-lg border p-3", toneClasses[item.tone ?? "neutral"])}>
                <p className="text-xs font-bold uppercase tracking-[0.08em] opacity-80">{item.label}</p>
                <p className="mt-1 text-xl font-black">{item.value}</p>
                {item.detail ? <p className="mt-1 text-xs font-semibold opacity-85">{item.detail}</p> : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function ExecutiveKPIGrid({ items, className }: { items: ExecutiveKpiItem[]; className?: string }) {
  return (
    <section className={cx("grid gap-4 sm:grid-cols-2 xl:grid-cols-4", className)} style={operationsStyle}>
      {items.map((item) => (
        <article key={item.label} className="rounded-xl border border-[color:var(--ops-border)] bg-[color:var(--ops-surface)] p-5 shadow-[var(--ops-shadow)]">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--ops-text-subtle)]">{item.label}</p>
            <span className={cx("h-2.5 w-2.5 rounded-full", dotClasses[item.tone ?? "neutral"])} aria-hidden="true" />
          </div>
          <p className="mt-3 text-4xl font-black leading-none text-[color:var(--ops-text)]">{item.value}</p>
          {item.detail ? <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--ops-text-muted)]">{item.detail}</p> : null}
        </article>
      ))}
    </section>
  );
}

export function WorkspaceStatusBar({ items, className }: { items: WorkspaceStatusItem[]; className?: string }) {
  return (
    <section className={cx("rounded-xl border border-[color:var(--ops-border)] bg-[color:var(--ops-surface-muted)] p-3", className)} style={operationsStyle}>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-3 rounded-lg border border-[color:var(--ops-border)] bg-white px-3 py-2">
            <span className="min-w-0 truncate text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--ops-text-subtle)]">{item.label}</span>
            <span className={cx("inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-bold", toneClasses[item.tone ?? "neutral"])}>
              <span className={cx("h-1.5 w-1.5 rounded-full", dotClasses[item.tone ?? "neutral"])} aria-hidden="true" />
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function OperationalHealthPanel({ items, className }: { items: OperationalHealthItem[]; className?: string }) {
  return (
    <OperationsCard title="Operational Health" eyebrow="What is happening" className={className}>
      <div className="grid gap-3">
        {items.map((item) => {
          const progress = clampProgress(item.progress);
          return (
            <div key={item.label} className="rounded-lg border border-[color:var(--ops-border)] bg-[color:var(--ops-surface-muted)] p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-[color:var(--ops-text)]">{item.label}</p>
                  {item.detail ? <p className="mt-1 text-xs font-medium text-[color:var(--ops-text-muted)]">{item.detail}</p> : null}
                </div>
                <span className={cx("rounded-full border px-2.5 py-1 text-xs font-bold", toneClasses[item.tone ?? "neutral"])}>{item.value}</span>
              </div>
              {progress !== null ? (
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200" aria-label={`${progress}%`}>
                  <div className={cx("h-full rounded-full", dotClasses[item.tone ?? "neutral"])} style={{ width: `${progress}%` }} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </OperationsCard>
  );
}

export function AIInsightsPanel({ insights, className }: { insights: ExecutiveInsightItem[]; className?: string }) {
  return (
    <OperationsCard title="AI Insights" eyebrow="What needs attention" className={className}>
      <div className="grid gap-3">
        {insights.map((insight) => (
          <article key={insight.title} className={cx("rounded-lg border p-4", toneClasses[insight.tone ?? "info"])}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-bold">{insight.title}</h3>
              {insight.confidence ? <span className="rounded-full border border-current px-2 py-1 text-xs font-bold">{insight.confidence}</span> : null}
            </div>
            <div className="mt-2 text-sm font-medium leading-6 opacity-90">{insight.body}</div>
          </article>
        ))}
      </div>
    </OperationsCard>
  );
}

export function TodaysPrioritiesPanel({ priorities, className }: { priorities: PriorityItem[]; className?: string }) {
  return (
    <OperationsCard title="Today's Priorities" eyebrow="What should I do next" className={className}>
      <ol className="grid gap-3">
        {priorities.map((priority, index) => (
          <li key={`${priority.title}-${index}`} className="grid grid-cols-[32px_minmax(0,1fr)] gap-3 rounded-lg border border-[color:var(--ops-border)] bg-[color:var(--ops-surface-muted)] p-3">
            <span className={cx("flex h-8 w-8 items-center justify-center rounded-full text-xs font-black text-white", dotClasses[priority.tone ?? "neutral"])}>
              {index + 1}
            </span>
            <div>
              <p className="font-bold text-[color:var(--ops-text)]">{priority.title}</p>
              {priority.detail ? <p className="mt-1 text-sm leading-6 text-[color:var(--ops-text-muted)]">{priority.detail}</p> : null}
              {(priority.owner || priority.due) ? (
                <p className="mt-2 text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--ops-text-subtle)]">
                  {[priority.owner, priority.due].filter(Boolean).join(" | ")}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </OperationsCard>
  );
}

export function ActivityTimeline({ items, className }: { items: ActivityTimelineItem[]; className?: string }) {
  return (
    <OperationsCard title="Activity Timeline" eyebrow="Operational detail" className={className}>
      <ol className="relative grid gap-4 border-l border-[color:var(--ops-border)] pl-4">
        {items.map((item, index) => (
          <li key={`${item.title}-${index}`} className="relative">
            <span className={cx("absolute -left-[21px] top-1 h-3 w-3 rounded-full ring-4 ring-white", dotClasses[item.tone ?? "neutral"])} aria-hidden="true" />
            <div className="rounded-lg border border-[color:var(--ops-border)] bg-[color:var(--ops-surface-muted)] p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="font-bold text-[color:var(--ops-text)]">{item.title}</p>
                {item.time ? <span className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--ops-text-subtle)]">{item.time}</span> : null}
              </div>
              {item.detail ? <p className="mt-1 text-sm leading-6 text-[color:var(--ops-text-muted)]">{item.detail}</p> : null}
            </div>
          </li>
        ))}
      </ol>
    </OperationsCard>
  );
}

export function NotificationCentre({ notifications, className }: { notifications: NotificationCentreItem[]; className?: string }) {
  return (
    <OperationsCard title="Notification Centre" eyebrow="Exceptions and signals" className={className}>
      <div className="grid gap-3">
        {notifications.map((notification) => (
          <article key={notification.title} className={cx("rounded-lg border p-3", toneClasses[notification.tone ?? "neutral"])}>
            <div className="flex items-start justify-between gap-3">
              <p className="font-bold">{notification.title}</p>
              {notification.meta ? <span className="text-xs font-bold uppercase tracking-[0.08em] opacity-75">{notification.meta}</span> : null}
            </div>
            {notification.detail ? <p className="mt-1 text-sm font-medium leading-6 opacity-90">{notification.detail}</p> : null}
          </article>
        ))}
      </div>
    </OperationsCard>
  );
}
