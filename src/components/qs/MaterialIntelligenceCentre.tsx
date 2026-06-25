import Link from "next/link";
import type { ReactNode } from "react";

type CentreSection =
  | "overview"
  | "imports"
  | "categories"
  | "suppliers"
  | "brands"
  | "units"
  | "validation"
  | "history";

type MaterialRow = {
  materialId: string;
  sku: string;
  name: string;
  category: string;
  supplier: string;
  brand: string;
  unit: string;
  currentPrice: string;
  province: string;
  status: string;
  lastUpdated: string;
};

const centreRoutes: { section: CentreSection; href: string; label: string; description: string }[] = [
  {
    section: "overview",
    href: "/dashboard/qs/materials",
    label: "Materials",
    description: "Material grid, search, and operational KPIs",
  },
  {
    section: "imports",
    href: "/dashboard/qs/materials/imports",
    label: "Imports",
    description: "CSV, XLSX, and JSON catalogue intake",
  },
  {
    section: "categories",
    href: "/dashboard/qs/materials/categories",
    label: "Categories",
    description: "Category hierarchy and approval readiness",
  },
  {
    section: "suppliers",
    href: "/dashboard/qs/materials/suppliers",
    label: "Suppliers",
    description: "Supplier catalogue coverage and import health",
  },
  {
    section: "brands",
    href: "/dashboard/qs/materials/brands",
    label: "Brands",
    description: "Brand and manufacturer controls",
  },
  {
    section: "units",
    href: "/dashboard/qs/materials/units",
    label: "Units",
    description: "Standard units, aliases, and conversions",
  },
  {
    section: "validation",
    href: "/dashboard/qs/materials/validation",
    label: "Validation",
    description: "Approval queues for import exceptions",
  },
  {
    section: "history",
    href: "/dashboard/qs/materials/history",
    label: "Price History",
    description: "Historical supplier price intelligence",
  },
];

const kpis = [
  { label: "Total Materials", value: "128,420", tone: "cyan", detail: "Search index ready" },
  { label: "Active Suppliers", value: "342", tone: "emerald", detail: "Province coverage tracked" },
  { label: "Today's Imports", value: "7", tone: "sky", detail: "Import audit enabled" },
  { label: "Pending Validation", value: "219", tone: "amber", detail: "Queued for admin review" },
  { label: "Failed Imports", value: "38", tone: "rose", detail: "Failed rows retained" },
  { label: "Price Updates", value: "4,812", tone: "violet", detail: "History never overwritten" },
  { label: "Unknown Categories", value: "16", tone: "orange", detail: "Approval required" },
  { label: "Unknown Suppliers", value: "11", tone: "fuchsia", detail: "Supplier review pending" },
];

const materials: MaterialRow[] = [
  {
    materialId: "MAT-000184",
    sku: "CEM-42N-50KG",
    name: "Cement 42.5N 50kg",
    category: "Concrete",
    supplier: "Builders Warehouse",
    brand: "AfriSam",
    unit: "Bag",
    currentPrice: "R109.95",
    province: "Gauteng",
    status: "Active",
    lastUpdated: "2026-06-24",
  },
  {
    materialId: "MAT-000219",
    sku: "BRK-MAXI-7MPA",
    name: "Maxi Brick 7MPa",
    category: "Bricks",
    supplier: "Cashbuild",
    brand: "Corobrik",
    unit: "Each",
    currentPrice: "R4.85",
    province: "National",
    status: "Active",
    lastUpdated: "2026-06-22",
  },
  {
    materialId: "MAT-000287",
    sku: "STL-Y12-6M",
    name: "Y12 Reinforcing Steel 6m",
    category: "Steel",
    supplier: "Macsteel",
    brand: "Macsteel",
    unit: "Length",
    currentPrice: "R92.40",
    province: "KwaZulu-Natal",
    status: "Active",
    lastUpdated: "2026-06-20",
  },
  {
    materialId: "MAT-000331",
    sku: "PLB-PVC-110",
    name: "PVC Pipe 110mm",
    category: "Plumbing",
    supplier: "Plumblink",
    brand: "Marley",
    unit: "m",
    currentPrice: "R68.20",
    province: "Western Cape",
    status: "Review",
    lastUpdated: "2026-06-18",
  },
];

const suppliers = [
  { id: "builders-warehouse", name: "Builders Warehouse", province: "National", products: "24,820", materialCount: "18,240", lastImport: "2026-06-24", lastPriceUpdate: "2026-06-24", status: "Active" },
  { id: "cashbuild", name: "Cashbuild", province: "National", products: "18,930", materialCount: "14,205", lastImport: "2026-06-22", lastPriceUpdate: "2026-06-23", status: "Active" },
  { id: "macsteel", name: "Macsteel", province: "Gauteng, KZN", products: "9,410", materialCount: "7,860", lastImport: "2026-06-19", lastPriceUpdate: "2026-06-20", status: "Active" },
];

const validationQueues = [
  { queue: "Unknown Categories", count: 16, actions: "Approve, Reject, Edit" },
  { queue: "Unknown Suppliers", count: 11, actions: "Approve, Reject, Merge" },
  { queue: "Duplicate Materials", count: 84, actions: "Skip, Update, Replace, Merge" },
  { queue: "Invalid Units", count: 27, actions: "Edit, Map, Reject" },
  { queue: "Invalid VAT", count: 5, actions: "Edit, Reject" },
  { queue: "Missing Prices", count: 76, actions: "Edit, Approve, Reject" },
];

const categories = [
  { name: "Concrete", subcategories: "Cement, Admixtures, Ready Mix", displayOrder: 10, status: "Active" },
  { name: "Steel", subcategories: "Rebar, Mesh, Sections", displayOrder: 20, status: "Active" },
  { name: "Plumbing", subcategories: "Pipes, Fittings, Valves", displayOrder: 30, status: "Active" },
  { name: "Electrical", subcategories: "Cable, Lighting, Switchgear", displayOrder: 40, status: "Active" },
];

const brands = [
  { name: "AfriSam", manufacturer: "AfriSam South Africa", categories: "Concrete, Aggregates", status: "Active" },
  { name: "Corobrik", manufacturer: "Corobrik", categories: "Bricks, Pavers", status: "Active" },
  { name: "Marley", manufacturer: "Marley Pipe Systems", categories: "Plumbing", status: "Active" },
];

const units = [
  { unit: "Each", aliases: "ea, item, unit", conversion: "Standard count", status: "Active" },
  { unit: "kg", aliases: "kilogram, kgs", conversion: "1 kg", status: "Active" },
  { unit: "m²", aliases: "sqm, square metres, m2", conversion: "Area", status: "Active" },
  { unit: "m³", aliases: "cube, cubic metre, m3", conversion: "Volume", status: "Active" },
];

const history = [
  { material: "Cement 42.5N 50kg", supplier: "Builders Warehouse", price: "R109.95", effectiveDate: "2026-06-24", source: "supplierCatalogue", createdBy: "ops@torqueempire.co.za" },
  { material: "Maxi Brick 7MPa", supplier: "Cashbuild", price: "R4.85", effectiveDate: "2026-06-22", source: "import", createdBy: "admin@torqueempire.co.za" },
  { material: "Y12 Reinforcing Steel 6m", supplier: "Macsteel", price: "R92.40", effectiveDate: "2026-06-20", source: "supplierCatalogue", createdBy: "pricing@torqueempire.co.za" },
];

function Panel({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    cyan: "border-cyan-400/25 bg-cyan-400/10 text-cyan-100",
    emerald: "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
    amber: "border-amber-400/25 bg-amber-400/10 text-amber-100",
    rose: "border-rose-400/25 bg-rose-400/10 text-rose-100",
    slate: "border-white/10 bg-white/[0.04] text-slate-300",
  };

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${tones[tone] ?? tones.slate}`}>
      {children}
    </span>
  );
}

function RouteHeader({ section }: { section: CentreSection }) {
  const current = centreRoutes.find((route) => route.section === section) ?? centreRoutes[0];

  return (
    <header>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">Material Intelligence Centre</p>
      <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">{current.label}</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            {current.description}. This workspace is wired for future AI material matching, BOQ parsing,
            supplier optimisation, quote generation, and historical learning without enabling those decisions yet.
          </p>
        </div>
        <Badge tone="cyan">Architecture only</Badge>
      </div>
    </header>
  );
}

function CentreNav({ section }: { section: CentreSection }) {
  return (
    <nav className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" aria-label="Material Intelligence Centre navigation">
      {centreRoutes.map((route) => {
        const active = route.section === section;

        return (
          <Link
            key={route.href}
            href={route.href}
            className={`rounded-lg border p-3 transition ${
              active
                ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-100"
                : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:bg-white/[0.05]"
            }`}
          >
            <span className="text-sm font-semibold">{route.label}</span>
            <span className="mt-1 block text-xs text-slate-500">{route.description}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function KpiGrid() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => (
        <section key={kpi.label} className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{kpi.label}</p>
          <p className="mt-3 text-2xl font-semibold text-white">{kpi.value}</p>
          <p className="mt-1 text-xs text-slate-500">{kpi.detail}</p>
        </section>
      ))}
    </div>
  );
}

function SearchControls() {
  return (
    <div className="grid gap-3 lg:grid-cols-[1.5fr_repeat(4,1fr)]">
      <input className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100" placeholder="Search material, supplier, SKU, barcode, brand, category" />
      <select className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-300" defaultValue="all">
        <option value="all">All categories</option>
        <option>Concrete</option>
        <option>Steel</option>
        <option>Plumbing</option>
      </select>
      <select className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-300" defaultValue="all">
        <option value="all">All suppliers</option>
        <option>Builders Warehouse</option>
        <option>Cashbuild</option>
      </select>
      <select className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-300" defaultValue="updated">
        <option value="updated">Sort: Last updated</option>
        <option>Name</option>
        <option>Current price</option>
      </select>
      <button className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-slate-200">
        Bulk actions ready
      </button>
    </div>
  );
}

function MaterialGrid() {
  return (
    <Panel title="Enterprise Material Grid" description="Search, sorting, filtering, pagination, and future bulk action surfaces.">
      <SearchControls />
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 text-xs uppercase tracking-[0.16em] text-slate-500">
            <tr>
              {["Material ID", "SKU", "Name", "Category", "Supplier", "Brand", "Unit", "Current Price", "Province", "Status", "Last Updated"].map((column) => (
                <th key={column} className="whitespace-nowrap px-3 py-3 font-semibold">{column}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10 text-slate-300">
            {materials.map((material) => (
              <tr key={material.materialId}>
                <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-cyan-100">{material.materialId}</td>
                <td className="whitespace-nowrap px-3 py-3 font-mono text-xs">{material.sku}</td>
                <td className="min-w-56 px-3 py-3 text-slate-100">{material.name}</td>
                <td className="whitespace-nowrap px-3 py-3">{material.category}</td>
                <td className="whitespace-nowrap px-3 py-3">{material.supplier}</td>
                <td className="whitespace-nowrap px-3 py-3">{material.brand}</td>
                <td className="whitespace-nowrap px-3 py-3">{material.unit}</td>
                <td className="whitespace-nowrap px-3 py-3">{material.currentPrice}</td>
                <td className="whitespace-nowrap px-3 py-3">{material.province}</td>
                <td className="whitespace-nowrap px-3 py-3"><Badge tone={material.status === "Active" ? "emerald" : "amber"}>{material.status}</Badge></td>
                <td className="whitespace-nowrap px-3 py-3">{material.lastUpdated}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <span>Showing 1-4 of 128,420 materials</span>
        <span>Pagination surface ready: Previous | Page 1 | Next</span>
      </div>
    </Panel>
  );
}

function ImportCentre() {
  const steps = ["Upload", "Choose Import Profile", "Preview", "Validation", "Import Summary", "Commit"];
  const previewRows = [
    ["Rows", "100,000+ record import architecture"],
    ["Mapped Columns", "Material, SKU, barcode, unit, price, supplier, category"],
    ["Detected Categories", "Concrete, Steel, Plumbing, Unknown"],
    ["Detected Suppliers", "Builders Warehouse, Cashbuild, Unknown"],
    ["Unknown Categories", "16 queued for approval"],
    ["Unknown Suppliers", "11 queued for supplier review"],
    ["Duplicate Materials", "84 duplicate candidates"],
    ["Warnings", "Unit alias and VAT corrections pending"],
    ["Errors", "Invalid rows rejected while valid rows continue"],
  ];

  return (
    <div className="space-y-4">
      <Panel title="Upload Workflow" description="CSV, XLSX, and JSON intake path for supplier and internal catalogues.">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {steps.map((step, index) => (
            <div key={step} className="rounded-lg border border-white/10 bg-slate-950/50 p-3">
              <p className="font-mono text-xs text-cyan-200">0{index + 1}</p>
              <p className="mt-2 text-sm font-semibold text-slate-100">{step}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-lg border border-dashed border-white/15 bg-slate-950/40 p-5 text-center">
          <p className="text-sm font-semibold text-slate-100">Drop CSV, XLSX, or JSON catalogue</p>
          <p className="mt-1 text-sm text-slate-500">Upload control placeholder. Production parser services are ready.</p>
        </div>
      </Panel>
      <Panel title="Import Preview" description="Mapped data quality and exception preview before commit.">
        <div className="grid gap-3 md:grid-cols-3">
          {previewRows.map(([label, value]) => (
            <div key={label} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</p>
              <p className="mt-2 text-sm text-slate-200">{value}</p>
            </div>
          ))}
        </div>
      </Panel>
      <AuditPanel />
    </div>
  );
}

function ValidationQueue() {
  return (
    <Panel title="Validation Queue" description="Administrator approval queues for imported catalogue exceptions.">
      <div className="grid gap-3 lg:grid-cols-2">
        {validationQueues.map((queue) => (
          <article key={queue.queue} className="rounded-lg border border-white/10 bg-slate-950/50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">{queue.queue}</h3>
                <p className="mt-1 text-sm text-slate-500">{queue.actions}</p>
              </div>
              <Badge tone={queue.count > 50 ? "rose" : "amber"}>{queue.count}</Badge>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {["Approve", "Reject", "Merge", "Edit"].map((action) => (
                <button key={action} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300">
                  {action}
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </Panel>
  );
}

function SupplierCentre() {
  return (
    <Panel title="Supplier Centre" description="Supplier catalogue coverage, material counts, and pricing freshness.">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 text-xs uppercase tracking-[0.16em] text-slate-500">
            <tr>
              {["Supplier", "Province", "Products", "Material Count", "Last Import", "Last Price Update", "Status", "Profile"].map((column) => (
                <th key={column} className="whitespace-nowrap px-3 py-3 font-semibold">{column}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10 text-slate-300">
            {suppliers.map((supplier) => (
              <tr key={supplier.id}>
                <td className="whitespace-nowrap px-3 py-3 text-slate-100">{supplier.name}</td>
                <td className="whitespace-nowrap px-3 py-3">{supplier.province}</td>
                <td className="whitespace-nowrap px-3 py-3">{supplier.products}</td>
                <td className="whitespace-nowrap px-3 py-3">{supplier.materialCount}</td>
                <td className="whitespace-nowrap px-3 py-3">{supplier.lastImport}</td>
                <td className="whitespace-nowrap px-3 py-3">{supplier.lastPriceUpdate}</td>
                <td className="whitespace-nowrap px-3 py-3"><Badge tone="emerald">{supplier.status}</Badge></td>
                <td className="whitespace-nowrap px-3 py-3">
                  <Link className="text-cyan-200 hover:text-cyan-100" href={`/dashboard/qs/materials/suppliers/${supplier.id}`}>
                    Open profile
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function ManagementTable({ title, description, rows }: { title: string; description: string; rows: Record<string, string | number>[] }) {
  const columns = Object.keys(rows[0] ?? {});

  return (
    <Panel title={title} description={description}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 text-xs uppercase tracking-[0.16em] text-slate-500">
            <tr>
              {columns.map((column) => (
                <th key={column} className="whitespace-nowrap px-3 py-3 font-semibold">{column}</th>
              ))}
              <th className="whitespace-nowrap px-3 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10 text-slate-300">
            {rows.map((row) => (
              <tr key={String(Object.values(row)[0])}>
                {columns.map((column) => (
                  <td key={column} className="whitespace-nowrap px-3 py-3">{row[column]}</td>
                ))}
                <td className="whitespace-nowrap px-3 py-3 text-cyan-200">Edit | Archive</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function PriceHistory() {
  return (
    <Panel title="Price History Timeline" description="Historical prices are appended for material learning and inflation tracking. No graphing in this sprint.">
      <div className="space-y-3">
        {history.map((entry) => (
          <article key={`${entry.material}-${entry.effectiveDate}`} className="rounded-lg border border-white/10 bg-slate-950/50 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">{entry.material}</h3>
                <p className="mt-1 text-sm text-slate-500">{entry.supplier} | {entry.source} | {entry.createdBy}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge tone="cyan">{entry.price}</Badge>
                <Badge>{entry.effectiveDate}</Badge>
              </div>
            </div>
          </article>
        ))}
      </div>
    </Panel>
  );
}

function GlobalSearchPanel() {
  return (
    <Panel title="Global Search" description="Search interface prepared for material, supplier, SKU, barcode, brand, and category lookup.">
      <div className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr]">
        <input className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100" placeholder="Search the material intelligence database" />
        <select className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-300" defaultValue="all">
          <option value="all">All entities</option>
          <option>Material</option>
          <option>Supplier</option>
          <option>Brand</option>
          <option>Category</option>
        </select>
        <button className="rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-sm font-semibold text-cyan-100">
          Search
        </button>
      </div>
    </Panel>
  );
}

function AuditPanel() {
  const rows = [
    ["Import History", "All materialImports records"],
    ["Failed Imports", "failedImports rows with reasons and suggested corrections"],
    ["Successful Imports", "Imported row counts and new material counts"],
    ["Duplicates", "Duplicate count and duplicate strategy"],
    ["Execution Time", "Import executionTimeMs"],
    ["Imported By", "User audit identity"],
  ];

  return (
    <Panel title="Audit Centre" description="Operational audit surfaces for import governance.">
      <div className="grid gap-3 md:grid-cols-3">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</p>
            <p className="mt-2 text-sm text-slate-200">{value}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function ServiceInterfaces() {
  const interfaces = ["AI Material Matching", "BOQ Parsing", "Supplier Optimisation", "Quote Generation", "Historical Learning"];

  return (
    <Panel title="Future Service Interfaces" description="Explicit integration surfaces reserved for later sprints.">
      <div className="flex flex-wrap gap-2">
        {interfaces.map((item) => (
          <Badge key={item} tone="cyan">{item}</Badge>
        ))}
      </div>
    </Panel>
  );
}

function SectionBody({ section }: { section: CentreSection }) {
  switch (section) {
    case "imports":
      return <ImportCentre />;
    case "categories":
      return <ManagementTable title="Category Manager" description="Manage categories, subcategories, icons, display order, and status." rows={categories} />;
    case "suppliers":
      return <SupplierCentre />;
    case "brands":
      return <ManagementTable title="Brand Manager" description="Manage brands and manufacturer catalogue readiness." rows={brands} />;
    case "units":
      return <ManagementTable title="Unit Library" description="Manage standard units, aliases, and future conversion rules." rows={units} />;
    case "validation":
      return <ValidationQueue />;
    case "history":
      return <PriceHistory />;
    case "overview":
    default:
      return (
        <>
          <KpiGrid />
          <GlobalSearchPanel />
          <MaterialGrid />
          <AuditPanel />
        </>
      );
  }
}

export function MaterialIntelligenceCentre({ section = "overview" }: { section?: CentreSection }) {
  return (
    <div className="p-6 text-white">
      <div className="max-w-7xl space-y-6">
        <RouteHeader section={section} />
        <CentreNav section={section} />
        <SectionBody section={section} />
        <ServiceInterfaces />
      </div>
    </div>
  );
}

export function SupplierProfilePlaceholder({ supplierId }: { supplierId: string }) {
  const supplier = suppliers.find((item) => item.id === supplierId) ?? suppliers[0];

  return (
    <div className="p-6 text-white">
      <div className="max-w-5xl space-y-6">
        <RouteHeader section="suppliers" />
        <CentreNav section="suppliers" />
        <Panel title={`${supplier.name} Supplier Profile`} description="Placeholder profile for catalogue coverage, import health, material linkage, and price history.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(supplier).map(([key, value]) => (
              <div key={key} className="rounded-lg border border-white/10 bg-slate-950/50 p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{key}</p>
                <p className="mt-2 text-sm text-slate-100">{value}</p>
              </div>
            ))}
          </div>
        </Panel>
        <ServiceInterfaces />
      </div>
    </div>
  );
}
