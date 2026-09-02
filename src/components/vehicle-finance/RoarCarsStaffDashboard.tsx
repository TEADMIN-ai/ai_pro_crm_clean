"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import { authFetch } from "@/lib/client/authFetch";
import { API_ROUTES } from "@/lib/routes";
import type { RoarInventoryResponse } from "@/types/roarInventory";

type DealerOverview = {
  metrics: {
    totalApplications: number;
    approvalRatio: number;
  };
};

const SHOWROOM_IMAGE = "/images/roar-cars-showroom.jpg";

function formatCurrency(value: number | null | undefined): string {
  return `R ${Number(value ?? 0).toLocaleString("en-ZA", { maximumFractionDigits: 0 })}`;
}

export default function RoarCarsStaffDashboard() {
  const [overview, setOverview] = useState<DealerOverview | null>(null);
  const [inventory, setInventory] = useState<RoarInventoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      authFetch(API_ROUTES.VEHICLE_FINANCE_OVERVIEW, { cache: "no-store", signal: controller.signal }),
      authFetch(API_ROUTES.VEHICLE_FINANCE_ROAR_INVENTORY, { cache: "no-store", signal: controller.signal }),
    ])
      .then(async ([overviewResponse, inventoryResponse]) => {
        if (!overviewResponse.ok || !inventoryResponse.ok) {
          throw new Error("Torque Empire Car Division operational data is temporarily unavailable");
        }

        const [overviewPayload, inventoryPayload] = await Promise.all([
          overviewResponse.json() as Promise<DealerOverview>,
          inventoryResponse.json() as Promise<RoarInventoryResponse>,
        ]);
        setOverview(overviewPayload);
        setInventory(inventoryPayload);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : "Torque Empire Car Division operational data is temporarily unavailable");
        }
      });

    return () => controller.abort();
  }, []);

  const vehiclesSold = inventory?.vehicles.filter((vehicle) => /sold/i.test(vehicle.status)).length ?? 0;
  const kpis = [
    ["Vehicles Available", inventory?.metrics.activeVehicles ?? 0],
    ["Vehicles Sold", vehiclesSold],
    ["Finance Applications", overview?.metrics.totalApplications ?? 0],
    ["Application Approval Rate", `${overview?.metrics.approvalRatio ?? 0}%`],
    ["Inventory Value", formatCurrency(inventory?.metrics.inventoryValue)],
  ] as const;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 pb-10 md:p-6 lg:p-8">
      <section className="relative min-h-[430px] overflow-hidden rounded-[32px] border border-sky-300/25 bg-slate-950 shadow-[0_28px_100px_rgba(2,8,23,0.55)]">
        <Image
          src={SHOWROOM_IMAGE}
          alt="Torque Empire Car Division vehicle showroom"
          fill
          sizes="(min-width: 1280px) 1200px, 100vw"
          className="object-cover object-center"
          priority
        />
        <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(2,6,23,0.97)_0%,rgba(2,8,23,0.78)_55%,rgba(2,8,23,0.25)_100%)]" />
        <div className="relative flex min-h-[430px] max-w-3xl flex-col justify-center px-6 py-12 sm:px-10 lg:px-14">
          <p className="text-xs font-bold uppercase tracking-[0.34em] text-sky-200">Torque Empire Car Division Operations Centre</p>
          <h1 className="mt-5 text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl lg:text-6xl">
            Vehicle inventory and finance operations.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-200 lg:text-lg">
            Manage available stock, publish listings, support customers, and move finance applications from enquiry to approval.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/dashboard/vehicle-finance/inventory" className="rounded-full bg-sky-300 px-5 py-3 text-sm font-semibold text-slate-950 no-underline transition hover:bg-sky-200">
              View inventory
            </Link>
            <Link href="/dashboard/vehicle-finance/applications" className="rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white no-underline transition hover:bg-white/15">
              Review applications
            </Link>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 px-5 py-4 text-sm text-amber-100" role="alert">
          {error}
        </div>
      ) : null}

      <section aria-label="Torque Empire Car Division operational KPIs" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {kpis.map(([label, value]) => (
          <Card key={label} className="min-h-[150px] border-sky-300/15 bg-slate-950/70">
            <p className="text-xs font-semibold uppercase tracking-[0.17em] text-sky-200/70">{label}</p>
            <p className="mt-5 text-3xl font-semibold tracking-[-0.04em] text-white">
              {typeof value === "number" ? value.toLocaleString("en-ZA") : value}
            </p>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          ["Inventory", "Monitor vehicle availability, status, pricing, and stock value.", "/dashboard/vehicle-finance/inventory"],
          ["Listings", "Review the customer-facing vehicle catalogue and listing quality.", "/dashboard/vehicle-finance/listings"],
          ["Finance", "Track customer applications and current approval performance.", "/dashboard/vehicle-finance/applications"],
        ].map(([title, description, href]) => (
          <Link key={title} href={href} className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6 text-white no-underline transition hover:border-sky-300/25 hover:bg-sky-300/[0.07]">
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">{description}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
