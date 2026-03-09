"use client";

import type { TenderEvaluation } from "@/types/tenderAudit";

interface Props {
  evaluation: TenderEvaluation;
}

const statusColor: Record<TenderEvaluation["complianceStatus"], string> = {
  PASS: "text-green-400",
  WARNING: "text-yellow-400",
  FAIL: "text-red-400",
};

export default function TenderReadinessPanel({ evaluation }: Props) {
  return (
    <div className="space-y-4 rounded-xl border border-cyan-700 bg-slate-950 p-5">
      <h2 className="text-lg font-semibold text-cyan-400">Tender Readiness</h2>

      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">Compliance Status</span>
        <span className={`font-semibold ${statusColor[evaluation.complianceStatus]}`}>
          {evaluation.complianceStatus}
        </span>
      </div>

      <div>
        <p className="text-sm text-gray-400">Readiness Score</p>
        <p className="text-xl font-bold text-white">{evaluation.readinessScore}%</p>

        <div className="mt-2 h-2 w-full rounded bg-gray-700">
          <div
            className="h-2 rounded bg-green-500"
            style={{ width: `${evaluation.readinessScore}%` }}
          />
        </div>
      </div>

      {evaluation.riskFlags.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-yellow-400">Risk Flags</h3>
          {evaluation.riskFlags.map((flag) => (
            <p key={flag} className="text-sm text-yellow-300">
              Warning: {flag}
            </p>
          ))}
        </div>
      )}

      {evaluation.missingRequirements.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-red-400">Missing Requirements</h3>
          {evaluation.missingRequirements.map((requirement) => (
            <p key={requirement} className="text-sm text-red-300">
              Missing: {requirement}
            </p>
          ))}
        </div>
      )}

      {evaluation.recommendations.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-cyan-400">Recommendations</h3>
          {evaluation.recommendations.map((recommendation) => (
            <p key={recommendation} className="text-sm text-gray-300">
              Action: {recommendation}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
