import type { ReactNode } from 'react';
import { EnterpriseEmptyState, EnterprisePanel, EnterpriseStatusBadge, type EnterpriseTone } from '@/components/ui/EnterpriseUI';

export type ExecutiveMonitoringWidgetKey = 'newOpportunitiesToday' | 'assignmentsToday' | 'tenderPacksGenerated' | 'submissionsToday' | 'pipelineGrowth' | 'awardForecast' | 'contractorUtilisation' | 'complianceAlerts' | 'highRiskOpportunities' | 'executiveActionQueue';

export type ExecutiveMonitoringWidgetDefinition = { key: ExecutiveMonitoringWidgetKey; label: string; sourceRequirement: string; note?: string };
export type ExecutiveMonitoringWidgetValue = { value: ReactNode; detail?: ReactNode; tone?: EnterpriseTone; status?: 'connected' | 'unavailable' | 'requires-source' };
export type ExecutiveMonitoringSnapshot = Partial<Record<ExecutiveMonitoringWidgetKey, ExecutiveMonitoringWidgetValue>>;

export const executiveMonitoringWidgetDefinitions: ExecutiveMonitoringWidgetDefinition[] = [
  { key: 'newOpportunitiesToday', label: 'New Opportunities Today', sourceRequirement: 'Executive opportunity intake feed' },
  { key: 'assignmentsToday', label: 'Assignments Today', sourceRequirement: 'Owner assignment event stream' },
  { key: 'tenderPacksGenerated', label: 'Tender Packs Generated', sourceRequirement: 'Tender pack generation events' },
  { key: 'submissionsToday', label: 'Submissions Today', sourceRequirement: 'Submission execution log' },
  { key: 'pipelineGrowth', label: 'Pipeline Growth', sourceRequirement: 'Pipeline movement trend' },
  { key: 'awardForecast', label: 'Award Forecast', sourceRequirement: 'Weighted award probability model' },
  { key: 'contractorUtilisation', label: 'Contractor Utilisation', sourceRequirement: 'Active contractor capacity and allocation' },
  { key: 'complianceAlerts', label: 'Compliance Alerts', sourceRequirement: 'Expiry and control alert feed' },
  { key: 'highRiskOpportunities', label: 'High Risk Opportunities', sourceRequirement: 'Risk scoring and exception feed' },
  { key: 'executiveActionQueue', label: 'Executive Action Queue', sourceRequirement: 'Executive follow-up task queue', note: 'Action handling remains outside presentation.' },
];

function resolveLabel(status: ExecutiveMonitoringWidgetValue['status'] | undefined) {
  if (status === 'connected') return 'Connected';
  if (status === 'unavailable') return 'Unavailable';
  return 'Source required';
}

function resolveTone(status: ExecutiveMonitoringWidgetValue['status'] | undefined, tone: EnterpriseTone | undefined): EnterpriseTone {
  if (status === 'connected') return tone ?? 'success';
  if (status === 'unavailable') return 'warning';
  return 'neutral';
}

function MonitoringWidget({ definition, metric }: { definition: ExecutiveMonitoringWidgetDefinition; metric?: ExecutiveMonitoringWidgetValue }) {
  const status = metric?.status ?? 'requires-source';
  return (
    <article className="tex-metric-card">
      <div className="flex items-start justify-between gap-3">
        <p className="tex-metric-label">{definition.label}</p>
        <EnterpriseStatusBadge tone={resolveTone(status, metric?.tone)} value={resolveLabel(status)} />
      </div>
      <div className="tex-metric-value mt-3">{metric?.value ?? '--'}</div>
      <p className="tex-copy mt-3 text-sm">{metric?.detail ?? definition.sourceRequirement}</p>
      {definition.note ? <p className="mt-2 text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--tex-text-muted)]">{definition.note}</p> : null}
    </article>
  );
}
export function ExecutiveMonitoringPanel({ snapshot, className }: { snapshot?: ExecutiveMonitoringSnapshot; className?: string }) {
  const queueDefinition = executiveMonitoringWidgetDefinitions.find((definition) => definition.key === 'executiveActionQueue');
  const queueMetric = snapshot?.executiveActionQueue;
  const queueTone = resolveTone(queueMetric?.status, queueMetric?.tone);

  return (
    <EnterprisePanel title="Executive Monitoring" eyebrow="Operational monitoring" className={className}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {executiveMonitoringWidgetDefinitions.filter((definition) => definition.key !== 'executiveActionQueue').map((definition) => (
          <MonitoringWidget key={definition.key} definition={definition} metric={snapshot?.[definition.key]} />
        ))}
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.72fr)]">
        <section className="rounded-xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface-muted)] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[color:var(--tex-text-strong)]">Queue state</p>
              <p className="mt-1 text-sm text-[color:var(--tex-text-muted)]">{queueMetric?.detail ?? 'Queue source required to render live activity.'}</p>
            </div>
            <EnterpriseStatusBadge tone={queueTone} value={resolveLabel(queueMetric?.status)} />
          </div>
          <div className="mt-4 grid gap-3">
            <div className="rounded-2xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface-muted)] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--tex-text-muted)]">Queue state</p>
              <p className="mt-2 text-sm leading-6 text-[color:var(--tex-text-muted)]">Connect the queue source to render live action records.</p>
            </div>
            <EnterpriseEmptyState title="Executive action source not connected" detail={queueDefinition?.sourceRequirement ?? 'Executive action queue source required'} />
          </div>
        </section>

        <section className="rounded-xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface-muted)] p-5">
          <div className="grid gap-3">
            <div className="rounded-2xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface-muted)] p-4">
              <p className="text-sm font-semibold text-[color:var(--tex-text-strong)]">Operational monitoring</p>
              <p className="mt-1 text-sm leading-6 text-[color:var(--tex-text-muted)]">Monitoring widgets are reusable view components driven by connected production sources.</p>
            </div>
            <div className="rounded-2xl border border-[color:var(--tex-border)] bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--tex-text-muted)]">Visible states</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <EnterpriseStatusBadge value="Source connected" tone="success" />
                <EnterpriseStatusBadge value="No API changes" tone="neutral" />
                <EnterpriseStatusBadge value="Reusable widgets" tone="info" />
              </div>
            </div>
          </div>
        </section>
      </div>
    </EnterprisePanel>
  );
}
