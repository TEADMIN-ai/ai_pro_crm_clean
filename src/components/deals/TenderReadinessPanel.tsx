"use client";

import type { TenderEvaluation } from "@/types/tenderAudit";

interface Props {
  evaluation: TenderEvaluation;
  readinessUpdatedAt?: string;
}

const statusColor: Record<TenderEvaluation["complianceStatus"], string> = {
  PASS: "text-green-400",
  WARNING: "text-yellow-400",
  FAIL: "text-red-400",
};

export default function TenderReadinessPanel({
  evaluation,
  readinessUpdatedAt,
}: Props) {
  const score = evaluation.readinessScore;
  const hasMissingDocs = evaluation.missingRequirements.length > 0;

  let tenderLockStatus: "READY" | "RISK" | "BLOCKED" = "READY";
  let tenderLockColor = "text-green-400 border-green-500/40 bg-green-500/10";

  if (hasMissingDocs || score < 60) {
    tenderLockStatus = "BLOCKED";
    tenderLockColor = "text-red-400 border-red-500/40 bg-red-500/10";
  } else if (score < 80) {
    tenderLockStatus = "RISK";
    tenderLockColor = "text-orange-300 border-orange-500/40 bg-orange-500/10";
  }

  return (
    <div className="space-y-4 rounded-xl border border-cyan-700 bg-slate-950 p-5">
      <h2 className="text-lg font-semibold text-cyan-400">Tender Readiness</h2>

      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">Compliance Status</span>
        <span className={`font-semibold ${statusColor[evaluation.complianceStatus]}`}>
          {evaluation.complianceStatus}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">TenderLock Status</span>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${tenderLockColor}`}>
          {tenderLockStatus}
        </span>
      </div>

      <div>
        <p className="text-sm text-gray-400">Readiness Score</p>
        <p className="text-xl font-bold text-white">{score}%</p>
        {readinessUpdatedAt && (
          <p className="mt-1 text-xs text-gray-500">
            Last evaluated: {readinessUpdatedAt}
          </p>
        )}

        <div className="mt-2 h-2 w-full rounded bg-gray-700">
          <div
            className="h-2 rounded bg-green-500"
            style={{ width: `${score}%` }}
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
