type Props = {
  totalDeals: number;
  readyDeals: number;
  submitted: number;
};

export default function InsightsPanel({
  totalDeals,
  readyDeals,
  submitted,
}: Props) {
  const readinessRate =
    totalDeals > 0 ? Math.round((readyDeals / totalDeals) * 100) : 0;

  return (
    <div className="space-y-3 rounded-xl bg-[#111827] p-4">
      <h2 className="text-lg font-semibold text-white">System Insights</h2>

      <p className="text-sm text-slate-400">
        You have <span className="font-medium text-white">{totalDeals}</span>{" "}
        total deals.
      </p>

      <p className="text-sm text-slate-400">
        <span className="font-medium text-green-400">{readyDeals}</span> deals
        are ready for submission.
      </p>

      <p className="text-sm text-slate-400">
        Readiness rate:{" "}
        <span className="font-medium text-blue-400">{readinessRate}%</span>
      </p>

      <p className="text-sm text-slate-400">
        Submitted: <span className="font-medium text-white">{submitted}</span>
      </p>
    </div>
  );
}
