import Link from "next/link";
import {
  DashboardCard,
  DashboardShell,
  InsightPanel,
  ModuleHeader,
} from "@/components/tex/ExecutivePrimitives";
import { QS_COLLECTIONS, QS_MATERIAL_CATEGORY_SEEDS, QS_STANDARD_UNITS } from "@/lib/qs";

const QS_NAV_AREAS = [
  { label: "Material Intelligence Centre", href: "/dashboard/qs/materials" },
  { label: "BOQ Intelligence Engine", href: "/dashboard/qs/boq" },
  { label: "Intelligent Estimating", href: "/dashboard/qs/estimates" },
  { label: "Supplier Intelligence", href: "/dashboard/qs/suppliers" },
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
    <DashboardShell module="qs" focus>
      <div className="tex-container max-w-5xl">
        <ModuleHeader
          eyebrow="Torque Empire QS Engine"
          title="Material Intelligence Foundation"
          description="Enterprise-grade material intelligence, BOQ extraction, estimating, and supplier commercial intelligence for price, quality, delivery, stock, risk, and margin decisions."
        />

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {QS_NAV_AREAS.map((area) => (
            <Link key={area.href} href={area.href} className="tex-card tex-card--interactive block no-underline">
              <h2 className="text-sm font-semibold text-[color:var(--tex-text-strong)]">{area.label}</h2>
              <p className="tex-copy mt-2 text-sm">Open operational workspace.</p>
            </Link>
          ))}
        </div>

        <section className="mt-6">
          <h2 className="tex-eyebrow">Import Engine</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {QS_IMPORT_AREAS.map((area) => (
              <DashboardCard key={area}>
                <h3 className="text-sm font-semibold text-[color:var(--tex-text-strong)]">{area}</h3>
                <p className="tex-copy mt-2 text-sm">Import architecture placeholder.</p>
              </DashboardCard>
            ))}
          </div>
        </section>

        <div className="mt-6 grid gap-3 lg:grid-cols-3">
          <InsightPanel title="Firestore Collections">
            <p className="text-sm">
              Materials, suppliers, supplier prices, material prices, price history, units, brands,
              categories, and availability are separated for scale.
            </p>
            <p className="mt-3 font-mono text-xs text-[color:var(--tex-accent-strong)]">{Object.values(QS_COLLECTIONS).join(" | ")}</p>
          </InsightPanel>

          <DashboardCard>
            <h2 className="text-sm font-semibold text-[color:var(--tex-text-strong)]">Seed Libraries</h2>
            <p className="tex-copy mt-2 text-sm">
              {QS_MATERIAL_CATEGORY_SEEDS.length} material categories and {QS_STANDARD_UNITS.length} standard
              units are defined for future seeding.
            </p>
          </DashboardCard>

          <DashboardCard>
            <h2 className="text-sm font-semibold text-[color:var(--tex-text-strong)]">Learning Hooks</h2>
            <p className="tex-copy mt-2 text-sm">
              Models include historical cost, previous quote, supplier performance, project similarity,
              and AI extraction metadata hooks.
            </p>
          </DashboardCard>
        </div>
      </div>
    </DashboardShell>
  );
}
