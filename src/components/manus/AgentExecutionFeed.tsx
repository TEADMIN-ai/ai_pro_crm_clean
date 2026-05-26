"use client";

import { useEffect, useState } from "react";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import type { WorkflowStep } from "@/lib/manus/types/manus.types";

export function AgentExecutionFeed(props: {
  steps: WorkflowStep[];
  workflowId?: string;
  refreshMs?: number;
}) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const agentSteps = props.steps.filter((step) => step.actor && step.actor !== "system");

  useEffect(() => {
    if (!props.workflowId || props.refreshMs === 0) {
      return;
    }

    const refreshMs = props.refreshMs ?? 15000;
    const timer = window.setInterval(() => {
      setIsRefreshing(true);
      setLastRefreshedAt(new Date().toISOString());
      window.setTimeout(() => setIsRefreshing(false), 300);
    }, refreshMs);

    return () => window.clearInterval(timer);
  }, [props.refreshMs, props.workflowId]);

  return (
    <Card className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Agent Feed</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">Live Workflow Activity</h3>
          <p className="mt-1 text-sm text-slate-600">Polling-safe execution visibility for active dry-run workflows.</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge tone={isRefreshing ? "info" : "neutral"}>{isRefreshing ? "Refreshing" : "Idle"}</Badge>
          {lastRefreshedAt ? <span className="text-xs text-slate-500">{new Date(lastRefreshedAt).toLocaleTimeString()}</span> : null}
        </div>
      </div>
      <div className="mt-5 space-y-3">
        {agentSteps.length === 0 ? (
          <p className="text-sm text-slate-500">No agent executions recorded yet.</p>
        ) : (
          agentSteps.map((step) => (
            <div key={step.id} className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{step.actor}</p>
                  <p className="mt-1 text-sm text-slate-600">{step.title}</p>
                </div>
                <div className="flex items-center gap-2">
                  {typeof step.retries === "number" && step.retries > 0 ? <Badge tone="warning">Retries {step.retries}</Badge> : null}
                  <Badge tone={step.status === "completed" ? "success" : step.status === "failed" ? "danger" : "info"}>
                    {step.status}
                  </Badge>
                </div>
              </div>
              {step.error ? <p className="mt-3 text-sm text-rose-700">{step.error}</p> : null}
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

export default AgentExecutionFeed;
