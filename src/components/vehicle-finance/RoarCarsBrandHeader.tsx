"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type RoarCarsNavItem = {
  href: string;
  label: string;
  exact?: boolean;
  anchor?: boolean;
};

const NAV_ITEMS: RoarCarsNavItem[] = [
  { href: "/dashboard/vehicle-finance", label: "Vehicle Dashboard", exact: true },
  { href: "/dashboard/vehicle-finance/listings", label: "Vehicle Listings" },
  { href: "/dashboard/vehicle-finance/inventory", label: "Vehicle Inventory" },
  { href: "/dashboard/vehicle-finance/customers", label: "Customer Enquiries" },
  { href: "/dashboard/vehicle-finance/applications", label: "Finance Applications" },
  { href: "/dashboard/vehicle-finance#executive-overview", label: "Executive Overview", anchor: true },
];

export default function RoarCarsBrandHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b border-white/10 bg-[#030712]/95 text-white shadow-[0_14px_45px_rgba(2,6,23,0.35)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 md:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <Link href="/dashboard/vehicle-finance" className="group flex items-center gap-3 no-underline">
            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-sky-300/30 bg-sky-400/10 text-lg font-black tracking-[-0.08em] text-sky-100 shadow-[0_0_28px_rgba(56,189,248,0.16)]">
              RC
            </span>
            <span>
              <span className="block text-sm font-bold uppercase tracking-[0.22em] text-white">Roar Cars SA</span>
              <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.32em] text-sky-200/70">
                Born To Roar
              </span>
            </span>
          </Link>
          <span className="hidden rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-300 sm:inline-flex">
            Vehicle Division
          </span>
        </div>

        <nav aria-label="Roar Cars Vehicle Division" className="flex gap-2 overflow-x-auto pb-1">
          {NAV_ITEMS.map((item) => {
            const active = item.anchor
              ? false
              : item.exact
                ? pathname === "/dashboard/vehicle-finance"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.label}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap rounded-full border px-3.5 py-2 text-xs font-semibold no-underline transition sm:text-sm ${
                  active
                    ? "border-sky-300/35 bg-sky-300/12 text-sky-100 shadow-[0_8px_24px_rgba(56,189,248,0.12)]"
                    : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
