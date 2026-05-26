export default function ContractorsPage() {
  const demoContractors = [
    {
      id: "CTR-001",
      name: "ABC Construction",
      status: "READY",
      compliance: "Complete",
    },
    {
      id: "CTR-002",
      name: "Delta Civils",
      status: "RISK",
      compliance: "Missing Tax Clearance",
    },
    {
      id: "CTR-003",
      name: "Prime Projects",
      status: "BLOCKED",
      compliance: "No CIDB",
    },
  ];

  return (
    <div className="space-y-5 p-6 text-white">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight text-slate-50 sm:text-2xl">
          Contractor Management
        </h1>

        <p className="max-w-2xl text-sm text-slate-400">
          Overview of contractor readiness and compliance status
        </p>
      </div>

      <section className="contractor-status-strip">
        <div className="space-y-1">
          <p className="contractor-strip-label">Contractor Status</p>
          <p className="text-sm font-medium text-slate-100 sm:text-[15px]">
            1 ready, 1 at risk, 1 blocked - intervention required
          </p>
        </div>

        <div className="contractor-review-indicator">
          <span className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.65)]" />
          Active Review
        </div>
      </section>

      <div className="space-y-3">
        {demoContractors.map((c) => (
          <div
            key={c.id}
            className="p-4 rounded-xl border border-slate-800 bg-[#111827] hover:border-slate-600 hover:shadow-lg active:scale-[0.995] transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
            role="button"
            tabIndex={0}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-1">
                <p className="truncate text-base font-semibold tracking-tight text-slate-50 sm:text-[1.05rem]">
                  {c.name}
                </p>
                <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-slate-500">
                  {c.id}
                </p>
              </div>

              <div
                className={
                  c.status === "READY"
                    ? "contractor-status contractor-status-ready"
                    : c.status === "RISK"
                    ? "contractor-status contractor-status-risk"
                    : "contractor-status contractor-status-blocked"
                }
              >
                {c.status}
              </div>
            </div>

            <p className="mt-3 text-sm leading-6 text-slate-400">
              {c.compliance}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Last updated: a few seconds ago
            </p>
          </div>
        ))}
      </div>

      <section className="contractor-insight-panel">
        Operational insight: contractors missing compliance requirements are
        automatically surfaced before submission delays occur.
      </section>
    </div>
  );
}
