import type { ReactNode } from "react";

type Props = {
  title: string;
  count?: number;
  emptyLabel: string;
  children?: ReactNode;
};

export default function OpportunityWorkspaceSection({ title, count, emptyLabel, children }: Props) {
  const hasChildren = Boolean(children);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
        {typeof count === "number" ? (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
            {count}
          </span>
        ) : null}
      </div>
      <div className="mt-3">
        {hasChildren ? (
          children
        ) : (
          <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-500">
            {emptyLabel}
          </p>
        )}
      </div>
    </section>
  );
}
