import Link from "next/link";
import { QS_COLLECTIONS, QS_MATERIAL_CATEGORY_SEEDS, QS_STANDARD_UNITS } from "@/lib/qs";

const QS_NAV_AREAS = [
  { label: "Material Intelligence Centre", href: "/dashboard/qs/materials" },
  { label: "BOQ Intelligence Engine", href: "/dashboard/qs/boq" },
  { label: "Intelligent Estimating", href: "/dashboard/qs/estimates" },
  { label: "Material Imports", href: "/dashboard/qs/materials/imports" },
  { label: "Suppliers", href: "/dashboard/qs/materials/suppliers" },
  { label: "Categories", href: "/dashboard/qs/materials/categories" },
  { label: "Price History", href: "/dashboard/qs/materials/history" },
  { label: "Validation Queue", href: "/dashboard/qs/materials/validation" },
];

const QS_IMPORT_AREAS = [
  "Recent Imports",
  "Import Statistics",
  "Import History",
];

export default function QsDashboardPage() {
  return (
    <div className="p-6 text-white">
      <div className="max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">Torque Empire QS Engine</p>
        <h1 className="mt-3 text-2xl font-semibold">Material Intelligence Foundation</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Enterprise-grade material intelligence structure for supplier catalogues, historical pricing,
          provincial availability, future BOQ matching, and quote memory. AI reasoning and quotation
          calculations are intentionally deferred.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {QS_NAV_AREAS.map((area) => (
            <Link key={area.href} href={area.href} className="rounded-lg border border-white/10 bg-white/[0.03] p-4 transition hover:border-cyan-400/25 hover:bg-cyan-400/10">
              <h2 className="text-sm font-semibold text-slate-100">{area.label}</h2>
              <p className="mt-2 text-sm text-slate-500">Open operational workspace.</p>
            </Link>
          ))}
        </div>

        <section className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Import Engine</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {QS_IMPORT_AREAS.map((area) => (
              <section key={area} className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <h3 className="text-sm font-semibold text-slate-100">{area}</h3>
                <p className="mt-2 text-sm text-slate-500">Import architecture placeholder.</p>
              </section>
            ))}
          </div>
        </section>

        <div className="mt-6 grid gap-3 lg:grid-cols-3">
          <section className="rounded-lg border border-cyan-400/20 bg-cyan-400/10 p-4">
            <h2 className="text-sm font-semibold text-cyan-100">Firestore Collections</h2>
            <p className="mt-2 text-sm text-slate-300">
              Materials, suppliers, supplier prices, material prices, price history, units, brands,
              categories, and availability are separated for scale.
            </p>
            <p className="mt-3 font-mono text-xs text-cyan-100">{Object.values(QS_COLLECTIONS).join(" | ")}</p>
          </section>

          <section className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <h2 className="text-sm font-semibold text-slate-100">Seed Libraries</h2>
            <p className="mt-2 text-sm text-slate-400">
              {QS_MATERIAL_CATEGORY_SEEDS.length} material categories and {QS_STANDARD_UNITS.length} standard
              units are defined for future seeding.
            </p>
          </section>

          <section className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <h2 className="text-sm font-semibold text-slate-100">Learning Hooks</h2>
            <p className="mt-2 text-sm text-slate-400">
              Models include historical cost, previous quote, supplier performance, project similarity,
              and AI extraction metadata hooks.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
