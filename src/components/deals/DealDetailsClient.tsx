"use client";

import React from "react";
import DocumentVerificationReviewPanel from "./DocumentVerificationReviewPanel";

type DocumentAnalysis = {
  finalStatus?: "PASS" | "FAIL";
};

type Deal = {
  id?: string;
  title?: string;
  status?: string;
  createdAt?: string;
  documentAnalysis?: DocumentAnalysis;
};

interface Props {
  deal: Deal;
}

export default function DealDetailsClient({ deal }: Props) {
  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
        <h1 className="text-xl font-bold text-white">
          {deal?.title || "Deal"}
        </h1>

        <p className="text-sm text-gray-400">
          Status: {deal?.status || "unknown"}
        </p>

        {deal?.createdAt && (
          <p className="mt-1 text-xs text-gray-400">
            Created: {new Date(deal.createdAt).toLocaleString()}
          </p>
        )}
      </div>

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 text-gray-300">
            Deal content goes here...
          </div>
        </div>

        {/* RIGHT COLUMN — VERIFICATION */}
        <div className="lg:col-span-1">
          {deal?.id && (
            <DocumentVerificationReviewPanel dealId={deal.id} />
          )}
        </div>
      </div>
    </div>
  );
}