import Link from "next/link";
import { API_ROUTES } from "@/lib/routes";
import type { QsBoqDocument, QsBoqExtractionLog, QsBoqLineItem, QsBoqReviewQueueItem } from "@/types/qs";

type BoqWorkspaceProps = {
  view: "overview" | "review" | "history";
  documents: QsBoqDocument[];
  lineItems: QsBoqLineItem[];
  reviewQueue: QsBoqReviewQueueItem[];
  logs: QsBoqExtractionLog[];
};

const routes = [
  { href: "/dashboard/qs/boq", label: "BOQ Intelligence", view: "overview" },
  { href: "/dashboard/qs/boq/upload", label: "Upload", view: "upload" },
  { href: "/dashboard/qs/boq/review", label: "Review", view: "review" },
  { href: "/dashboard/qs/boq/history", label: "History", view: "history" },
  { href: "/dashboard/qs/estimates", label: "Estimate", view: "estimate" },
];

function Panel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
      {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "cyan" | "emerald" | "amber" | "rose" | "slate" }) {
  const tones = {
    cyan: "border-cyan-400/25 bg-cyan-400/10 text-cyan-100",
    emerald: "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
    amber: "border-amber-400/25 bg-amber-400/10 text-amber-100",
    rose: "border-rose-400/25 bg-rose-400/10 text-rose-100",
    slate: "border-white/10 bg-white/[0.04] text-slate-300",
  };

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

function Header({ active }: { active: string }) {
  return (
    <header className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">TE QS Engine</p>
        <h1 className="mt-3 text-2xl font-semibold text-white">BOQ Intelligence Engine</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Upload BOQs, RFQs, and Scopes of Work, extract structured line items, classify trades, normalize units,
          and prepare material matches for review before intelligent estimating.
        </p>
      </div>
      <nav className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" aria-label="BOQ Intelligence navigation">
        {routes.map((route) => (
          <Link
            key={route.href}
            href={route.href}
            className={`rounded-lg border p-3 text-sm font-semibold transition ${
              active === route.view
                ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-100"
                : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20"
            }`}
          >
            {route.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="rounded-lg border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">{label}</div>;
}

function Overview({ documents, lineItems, reviewQueue }: Pick<BoqWorkspaceProps, "documents" | "lineItems" | "reviewQueue">) {
  const kpis = [
    ["BOQ Documents", documents.length],
    ["Line Items Extracted", lineItems.length],
    ["Pending Review", reviewQueue.filter((item) => item.status === "pending").length],
    ["OCR Documents", documents.filter((item) => item.ocrUsed).length],
  ];

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(([label, value]) => (
          <section key={label} className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
            <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
          </section>
        ))}
      </div>
      <Panel title="Extraction Pipeline" description="Document understanding workflow prepared for future pricing handoff.">
        <div className="grid gap-3 md:grid-cols-4">
          {["Document stored", "OCR if required", "Structured parsing", "Trade detection", "Unit normalization", "Material matching", "Review queue", "Pricing-ready items"].map((step, index) => (
            <div key={step} className="rounded-lg border border-white/10 bg-slate-950/50 p-3">
              <p className="font-mono text-xs text-cyan-200">{String(index + 1).padStart(2, "0")}</p>
              <p className="mt-2 text-sm text-slate-200">{step}</p>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="BOQ Search" description="Search extracted BOQs by project, trade, material, document, or date.">
        <div className="grid gap-3 lg:grid-cols-5">
          {["Project", "Trade", "Material", "Document", "Date"].map((field) => (
            <input key={field} className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100" placeholder={field} />
          ))}
        </div>
      </Panel>
      <LineItemTable lineItems={lineItems} />
    </>
  );
}

function LineItemTable({ lineItems }: { lineItems: QsBoqLineItem[] }) {
  if (!lineItems.length) {
    return <EmptyState label="No BOQ line items have been extracted yet." />;
  }

  return (
    <Panel title="Extracted Line Items" description="Structured BOQ items with trade, material match, unit, and confidence.">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 text-xs uppercase tracking-[0.16em] text-slate-500">
            <tr>
              {["Line", "Section", "Trade", "Description", "Quantity", "Unit", "Detected Material", "Confidence", "Status"].map((column) => (
                <th key={column} className="whitespace-nowrap px-3 py-3 font-semibold">{column}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10 text-slate-300">
            {lineItems.map((item) => (
              <tr key={item.boqLineItemId}>
                <td className="px-3 py-3 font-mono text-xs text-cyan-100">{item.lineNumber}</td>
                <td className="whitespace-nowrap px-3 py-3">{item.section ?? "General"}</td>
                <td className="whitespace-nowrap px-3 py-3">{item.trade}</td>
                <td className="min-w-72 px-3 py-3 text-slate-100">{item.description}</td>
                <td className="whitespace-nowrap px-3 py-3">{item.quantity ?? "-"}</td>
                <td className="whitespace-nowrap px-3 py-3">{item.normalizedUnit ?? item.unit ?? "-"}</td>
                <td className="whitespace-nowrap px-3 py-3">{item.materialMatch.materialName ?? "Unknown Material"}</td>
                <td className="whitespace-nowrap px-3 py-3"><Badge tone={item.confidenceScore === "High" ? "emerald" : item.confidenceScore === "Medium" ? "amber" : "rose"}>{item.confidenceScore}</Badge></td>
                <td className="whitespace-nowrap px-3 py-3">{item.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function ReviewQueue({ reviewQueue }: { reviewQueue: QsBoqReviewQueueItem[] }) {
  return (
    <Panel title="BOQ Review Queue" description="Low-confidence or unknown-material rows require human review before future pricing.">
      {!reviewQueue.length ? (
        <EmptyState label="No BOQ items are waiting for review." />
      ) : (
        <div className="grid gap-3">
          {reviewQueue.map((item) => (
            <article key={item.boqReviewQueueId} className="rounded-lg border border-white/10 bg-slate-950/50 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">{item.reason}</h3>
                  <p className="mt-2 text-sm text-slate-400">{item.originalText}</p>
                </div>
                <Badge tone="amber">{item.suggestedAction}</Badge>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {["accept", "edit", "reject", "rematch"].map((action) => (
                  <form key={action} action={API_ROUTES.QS_BOQ_REVIEW} method="post">
                    <input type="hidden" name="reviewQueueId" value={item.boqReviewQueueId} />
                    <input type="hidden" name="action" value={action} />
                    <button className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold capitalize text-slate-300">{action}</button>
                  </form>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </Panel>
  );
}

function History({ documents, logs }: Pick<BoqWorkspaceProps, "documents" | "logs">) {
  return (
    <>
      <Panel title="BOQ Document History" description="Uploaded documents, parser source, OCR usage, and review status.">
        {!documents.length ? (
          <EmptyState label="No BOQ documents have been uploaded yet." />
        ) : (
          <div className="grid gap-3">
            {documents.map((document) => (
              <article key={document.boqDocumentId} className="rounded-lg border border-white/10 bg-slate-950/50 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">{document.fileName}</h3>
                    <p className="mt-1 text-sm text-slate-500">{document.projectName ?? "No project"} | {document.parserUsed} | {document.itemCount} items</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={document.ocrUsed ? "amber" : "cyan"}>{document.ocrUsed ? "OCR used" : "Direct text"}</Badge>
                    <Badge>{document.reviewStatus}</Badge>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </Panel>
      <Panel title="Extraction Audit" description="Uploaded by, extraction time, parser, confidence distribution, and review status.">
        <div className="grid gap-3 md:grid-cols-2">
          {logs.map((log) => (
            <div key={log.boqExtractionLogId} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
              <p className="text-sm font-semibold text-slate-100">{log.message}</p>
              <p className="mt-2 text-xs text-slate-500">
                {log.parserUsed} | {log.extractionTimeMs}ms | {log.itemsExtracted} items | {log.uploadedBy ?? "unknown user"}
              </p>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}

export default function BoqIntelligenceWorkspace({ view, documents, lineItems, reviewQueue, logs }: BoqWorkspaceProps) {
  return (
    <div className="p-6 text-white">
      <div className="max-w-7xl space-y-6">
        <Header active={view} />
        {view === "review" ? <ReviewQueue reviewQueue={reviewQueue} /> : null}
        {view === "history" ? <History documents={documents} logs={logs} /> : null}
        {view === "overview" ? <Overview documents={documents} lineItems={lineItems} reviewQueue={reviewQueue} /> : null}
      </div>
    </div>
  );
}
