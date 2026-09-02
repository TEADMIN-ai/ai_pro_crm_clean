"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import Badge from "@/components/ui/Badge";
import Card, { IdentityCardHeader } from "@/components/ui/Card";
import { ReturnButton } from "@/components/navigation/ReturnButton";
import { authFetch } from "@/lib/client/authFetch";
import { API_ROUTES } from "@/lib/routes";
import type { RoarInventoryResponse } from "@/types/roarInventory";

const PLACEHOLDER_IMAGE = "/images/roar-cars-placeholder.svg";

function formatCurrency(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "Price on request";
  return `R ${value.toLocaleString("en-ZA")}`;
}

function formatSyncedAt(value?: string | null): string {
  if (!value) return "Not synced yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not synced yet";
  return date.toLocaleString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusTone(status?: string | null): "success" | "warning" | "danger" | "neutral" {
  if (!status) return "neutral";
  if (/live|active/i.test(status)) return "success";
  if (/cached|sync|pending/i.test(status)) return "warning";
  if (/sold|inactive|reserved/i.test(status)) return "danger";
  return "neutral";
}

type Props = {
  vehicleId: string;
};

export default function RoarVehicleDetailView({ vehicleId }: Props) {
  const [inventory, setInventory] = useState<RoarInventoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    authFetch(API_ROUTES.VEHICLE_FINANCE_ROAR_INVENTORY, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as (RoarInventoryResponse & { error?: string }) | null;
        if (!response.ok || !payload) {
          throw new Error(payload?.error ?? `Inventory request failed (${response.status})`);
        }

        setInventory(payload);
        setError(payload.warning ?? null);
      })
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted) {
          setInventory(null);
          setError(loadError instanceof Error ? loadError.message : "Inventory detail unavailable");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  const vehicle = useMemo(() => inventory?.vehicles.find((item) => item.id === vehicleId) ?? null, [inventory?.vehicles, vehicleId]);

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 pb-10 md:p-6 lg:p-8">
      <section className="rounded-[32px] border border-sky-300/20 bg-slate-950 p-6 shadow-[0_24px_70px_rgba(2,8,23,0.4)] md:p-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.32em] text-sky-200">Torque Empire Car Division</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">Vehicle Detail</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200">
              {vehicle ? "Frontend vehicle profile with live inventory data and source context." : "The selected vehicle could not be found in the current inventory sync."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ReturnButton fallbackHref="/dashboard/vehicle-finance/inventory" label="Back to Inventory" className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white no-underline" />
            <Link href="/dashboard/vehicle-finance/listings" className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white no-underline">
              View Listings
            </Link>
          </div>
        </div>
      </section>

      {loading ? (
        <Card className="border border-white/10 bg-slate-950/70 p-6">
          <p className="text-sm text-slate-200">Loading vehicle detail...</p>
        </Card>
      ) : vehicle ? (
        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <Card className="overflow-hidden border border-white/10 bg-slate-950/70 p-0">
            <div className="relative aspect-[16/10] bg-slate-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={vehicle.imageUrl || PLACEHOLDER_IMAGE}
                alt={vehicle.title}
                loading="lazy"
                onError={(event) => {
                  if (!event.currentTarget.src.endsWith(PLACEHOLDER_IMAGE)) event.currentTarget.src = PLACEHOLDER_IMAGE;
                }}
                className="h-full w-full object-contain p-4"
              />
            </div>
            <div className="border-t border-white/10 p-6">
              <div className="flex flex-wrap gap-2">
                <Badge tone={getStatusTone(vehicle.status)}>{vehicle.status}</Badge>
                <Badge tone="neutral">{vehicle.source}</Badge>
                <Badge tone={inventory?.status === "LIVE" ? "success" : inventory?.status === "CACHED" ? "warning" : "danger"}>
                  {inventory?.status ?? "UNAVAILABLE"}
                </Badge>
              </div>
              <h2 className="mt-4 text-2xl font-semibold text-white">{vehicle.title}</h2>
              <p className="mt-2 text-sm uppercase tracking-[0.18em] text-slate-400">
                {vehicle.make} {vehicle.model}
              </p>
              <p className="mt-4 text-3xl font-semibold text-white">{formatCurrency(vehicle.priceNumber ?? vehicle.price)}</p>
              <p className="mt-2 text-sm text-slate-300">
                Last synced {formatSyncedAt(vehicle.lastSyncedAt)} · Inventory source {inventory?.source.type ?? "unavailable"}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={vehicle.listingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl bg-sky-300 px-4 py-2.5 text-sm font-semibold text-slate-950 no-underline"
                >
                  Open Original Listing
                </Link>
              </div>
            </div>
          </Card>

          <Card className="border border-white/10 bg-slate-950/70 p-6">
            <IdentityCardHeader title="Vehicle Information" subtitle="Current inventory record" />
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <Detail label="Vehicle ID" value={vehicle.id} />
              <Detail label="Year" value={vehicle.year ?? "n/a"} />
              <Detail label="Mileage" value={vehicle.mileageNumber ?? vehicle.mileage ?? "n/a"} />
              <Detail label="Transmission" value={vehicle.transmission ?? "n/a"} />
              <Detail label="Fuel Type" value={vehicle.fuelType ?? "n/a"} />
              <Detail label="Body Type" value={vehicle.bodyType ?? "n/a"} />
              <Detail label="Listing URL" value={vehicle.listingUrl} wide />
              <Detail label="Inventory Count" value={inventory?.itemCount ?? 0} />
              <Detail label="Missing Images" value={inventory?.diagnostics?.brokenImageLinks ?? 0} />
              <Detail label="Last Sync" value={formatSyncedAt(inventory?.syncedAt ?? inventory?.source.lastSyncedAt ?? null)} wide />
            </dl>

            {error ? (
              <div className="mt-6 rounded-2xl border border-amber-300/25 bg-amber-300/[0.08] p-4 text-sm text-amber-50">
                {error}
              </div>
            ) : null}
          </Card>
        </section>
      ) : (
        <Card className="border border-white/10 bg-slate-950/70 p-6">
          <p className="text-sm text-slate-200">
            {error || "Vehicle not found in the current inventory sync."}
          </p>
        </Card>
      )}
    </main>
  );
}

function Detail({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string | number;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2 rounded-xl border border-white/10 bg-white/[0.04] p-4" : "rounded-xl border border-white/10 bg-white/[0.04] p-4"}>
      <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">{label}</dt>
      <dd className="mt-2 break-words text-sm font-semibold text-white">{typeof value === "number" ? value.toLocaleString("en-ZA") : value}</dd>
    </div>
  );
}
