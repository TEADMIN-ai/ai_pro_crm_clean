"use client";

import Image from "next/image";
import { ActionButton, MetricCard } from "@/components/tex/ExecutivePrimitives";
import type { EnterpriseKpiSnapshot } from "@/lib/kpis/enterpriseSnapshot";

export function TeosOperationsHubHeroFromSnapshot({ data }: { data: EnterpriseKpiSnapshot }) {
  return (
    <TeosOperationsHubHero
      data={data}
      readinessScore={String(data.readiness.averageScore) + "%"}
      submissionRate={String(data.submissions.conversionRate) + "%"}
    />
  );
}

export default function TeosOperationsHubHero({
  data,
  readinessScore,
  submissionRate,
}: {
  data: EnterpriseKpiSnapshot;
  readinessScore: string;
  submissionRate: string;
}) {
  const summary = data.dashboardSummary;

  return (
    <section className="tex-dark-surface-hero relative overflow-hidden rounded-[24px] border border-sky-200/20 bg-slate-950 shadow-[0_28px_80px_rgba(2,8,23,0.32)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_26%,rgba(14,165,233,0.22),transparent_34%),linear-gradient(135deg,rgba(2,6,23,0.98),rgba(15,23,42,0.94)_52%,rgba(8,47,73,0.9))]" />
      <div className="relative grid gap-8 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)] lg:items-center lg:p-8 xl:p-10">
        <div className="max-w-3xl">
          <p className="tex-dark-surface-hero__eyebrow text-xs font-semibold uppercase tracking-[0.26em]">TORQUE EMPIRE OPERATING SYSTEM</p>
          <h1 className="tex-dark-surface-hero__heading mt-4 max-w-4xl text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl">One intelligent operating hub. Four divisions. Total control.</h1>
          <p className="tex-dark-surface-hero__copy mt-5 max-w-2xl text-sm leading-7 sm:text-base">TEOS connects procurement, hygiene operations, contractor compliance and business intelligence through one controlled digital workspace.</p>

          <div className="mt-6 flex flex-wrap gap-3">
            <ActionButton href="/dashboard/opportunity-register" className="border border-white/10 bg-white text-slate-950 hover:bg-sky-50">Open Opportunity Register</ActionButton>
            <ActionButton href="/dashboard/contractors" variant="secondary" className="tex-dark-surface-hero__action-secondary hover:bg-white/15">Contractor Repository</ActionButton>
            <ActionButton href="/dashboard/hygiene" variant="secondary" className="tex-dark-surface-hero__action-secondary hover:bg-white/15">Hygiene Operations</ActionButton>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <MetricCard label="Avg Readiness" value={readinessScore} className="tex-dark-surface-hero__metric" />
            <MetricCard label="Submission Rate" value={submissionRate} className="tex-dark-surface-hero__metric" />
            <MetricCard label="Risk Watch" value={summary.risk} className="tex-dark-surface-hero__metric" />
          </div>
        </div>

        <figure className="relative mx-auto w-full max-w-[460px] lg:ml-auto">
          <div className="absolute -inset-3 rounded-[28px] bg-sky-400/18 blur-2xl" aria-hidden="true" />
          <div className="relative overflow-hidden rounded-[18px] border border-white/18 bg-slate-900/70 p-2 shadow-[0_24px_70px_rgba(14,165,233,0.18)]">
            <div className="overflow-hidden rounded-[12px] bg-slate-950">
              <Image
                src="/media/teos/teos-operations-hub-hero.webp"
                alt="Portrait brand concept visual of the Torque Empire Operations Hub digital workspace."
                width={1086}
                height={1448}
                sizes="(min-width: 1280px) 420px, (min-width: 1024px) 36vw, (min-width: 640px) 460px, 92vw"
                priority
                className="h-auto w-full object-contain"
              />
            </div>
            <figcaption className="border-t border-white/10 px-2 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
              Torque Empire Operations Hub - Brand Concept Visual
            </figcaption>
          </div>
        </figure>
      </div>
    </section>
  );
}
