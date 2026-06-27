"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import { authFetch } from "@/lib/client/authFetch";
import { API_ROUTES } from "@/lib/routes";
import type { RoarInventoryResponse, RoarInventoryVehicle } from "@/types/roarInventory";

type Mode = "inventory" | "listings";

type Props = {
  mode?: Mode;
};

const HERO_IMAGE = "/images/roar-cars-showroom.jpg";
const PLACEHOLDER_IMAGE = "/images/roar-cars-placeholder.svg";

function formatCurrency(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "Price on request";
  return `R ${value.toLocaleString("en-ZA")}`;
}

function formatMileage(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "Mileage not supplied";
  return `${value.toLocaleString("en-ZA")} km`;
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

function getStatusTone(status?: string | null): "success" | "warning" | "neutral" | "danger" {
  if (!status) return "neutral";
  if (/live|active/i.test(status)) return "success";
  if (/cached|sync|pending/i.test(status)) return "warning";
  if (/sold|inactive|reserved/i.test(status)) return "danger";
  return "neutral";
}

export default function RoarCarsInventoryWorkspace({ mode = "inventory" }: Props) {
  const [inventory, setInventory] = useState<RoarInventoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [make, setMake] = useState("all");
  const [year, setYear] = useState("all");
  const [transmission, setTransmission] = useState("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [syncing, setSyncing] = useState(false);

  const loadInventory = useCallback(async (signal?: AbortSignal) => {
    const response = await authFetch(API_ROUTES.VEHICLE_FINANCE_ROAR_INVENTORY, {
      cache: "no-store",
      signal,
    });
    const payload = (await response.json().catch(() => null)) as (RoarInventoryResponse & { error?: string }) | null;
    if (!response.ok || !payload) {
      throw new Error(payload?.error ?? `Inventory request failed (${response.status})`);
    }

    setInventory(payload);
    setError(payload.warning ?? null);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    loadInventory(controller.signal)
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : "Live inventory temporarily unavailable");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [loadInventory]);

  const retryInventorySync = useCallback(async () => {
    try {
      setSyncing(true);
      setError(null);
      const response = await authFetch(API_ROUTES.VEHICLE_FINANCE_INVENTORY_SYNC, {
        method: "POST",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? `Inventory sync failed (${response.status})`);
      }
      await loadInventory();
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Inventory sync failed");
    } finally {
      setSyncing(false);
    }
  }, [loadInventory]);

  const vehicles = inventory?.vehicles ?? [];
  const makes = useMemo(() => [...new Set(vehicles.map((vehicle) => vehicle.make).filter(Boolean))].sort(), [vehicles]);
  const years = useMemo(
    () =>
      [...new Set(vehicles.map((vehicle) => vehicle.year).filter((value): value is number => value !== null))]
        .sort((left, right) => right - left)
        .map(String),
    [vehicles],
  );
  const transmissions = useMemo(
    () => [...new Set(vehicles.map((vehicle) => vehicle.transmission).filter((value): value is string => Boolean(value)))].sort(),
    [vehicles],
  );

  const priceBounds = useMemo(() => {
    const priced = vehicles.map((vehicle) => vehicle.priceNumber ?? vehicle.price).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    if (!priced.length) {
      return { min: 0, max: 0 };
    }
    return { min: Math.min(...priced), max: Math.max(...priced) };
  }, [vehicles]);

  const filteredVehicles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const min = Number(minPrice);
    const max = Number(maxPrice);

    return vehicles.filter((vehicle) => {
      const searchable = `${vehicle.title} ${vehicle.make} ${vehicle.model} ${vehicle.transmission ?? ""} ${vehicle.fuelType ?? ""} ${vehicle.bodyType ?? ""}`.toLowerCase();
      const vehiclePrice = vehicle.priceNumber ?? vehicle.price ?? 0;
      const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery);
      const matchesMin = !Number.isFinite(min) || minPrice === "" || vehiclePrice >= min;
      const matchesMax = !Number.isFinite(max) || maxPrice === "" || vehiclePrice <= max;

      return (
        matchesQuery &&
        (make === "all" || vehicle.make === make) &&
        (year === "all" || vehicle.year === Number(year)) &&
        (transmission === "all" || vehicle.transmission === transmission) &&
        matchesMin &&
        matchesMax
      );
    });
  }, [make, maxPrice, minPrice, query, transmission, vehicles, year]);

  const inventoryStatusText =
    inventory?.status === "CACHED"
      ? "Last cached inventory is shown where available."
      : error && !inventory
        ? "Roar inventory feed is being prepared."
        : "Synced from Roar Cars website.";

  const heroCountText = loading
    ? "Syncing inventory..."
    : inventory
      ? `${inventory.metrics.activeVehicles} active vehicles`
      : "Inventory unavailable";

  return (
    <main className="mx-auto max-w-7xl space-y-6 overflow-x-hidden p-4 pb-10 md:p-6 lg:p-8">
      <section className="relative min-h-[300px] overflow-hidden rounded-[32px] border border-sky-300/20 bg-slate-950 px-6 py-8 shadow-[0_24px_70px_rgba(2,8,23,0.4)] md:px-8 md:py-10">
        <Image src={HERO_IMAGE} alt="Roar Cars SA showroom" fill sizes="100vw" className="object-cover object-center opacity-45" priority />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/88 to-slate-950/30" />
        <div className="relative max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/20 bg-slate-950/60 px-3 py-1.5 backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-sky-300 shadow-[0_0_14px_rgba(125,211,252,0.9)]" />
            <span className="text-[10px] font-bold uppercase tracking-[0.32em] text-sky-100">Roar Cars SA</span>
          </div>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.38em] text-sky-200/80">Born To Roar</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
            {mode === "listings" ? "Vehicle Listings" : "Live Vehicle Inventory"}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-200 sm:text-base">
            {mode === "listings"
              ? "Compact live stock view for the vehicle sales team, with direct links back to the original Roar listing."
              : "Browse live Roar Cars stock and open the original dealership listing for full vehicle details."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <div className="inline-flex rounded-full border border-white/15 bg-slate-950/55 px-4 py-2 text-sm font-semibold text-white backdrop-blur-md">
              {heroCountText}
            </div>
            <div className="inline-flex rounded-full border border-white/15 bg-slate-950/55 px-4 py-2 text-sm font-semibold text-white backdrop-blur-md">
              Last synced {formatSyncedAt(inventory?.syncedAt ?? inventory?.source.lastSyncedAt ?? null)}
            </div>
          </div>
          <p className="mt-4 text-xs uppercase tracking-[0.24em] text-sky-100/70">{inventoryStatusText}</p>
        </div>
      </section>

      {inventory?.warning || error ? (
        <section className="rounded-[24px] border border-amber-300/30 bg-amber-300/[0.09] px-4 py-4 text-sm text-amber-100">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">
                {inventory?.status === "UNAVAILABLE" || !inventory ? "Inventory sync unavailable." : "Live inventory temporarily unavailable."}
              </p>
              <p className="mt-1 text-slate-100">
                {error || inventory?.warning || (inventory?.status === "UNAVAILABLE" || !inventory
                  ? "Live inventory will appear here once the source site responds."
                  : "Last cached inventory is shown where available.")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void retryInventorySync()}
              disabled={syncing}
              className="rounded-xl border border-amber-200/40 bg-slate-950/60 px-4 py-2 text-xs font-semibold text-amber-50 transition hover:bg-slate-900 disabled:opacity-60"
            >
              {syncing ? "Syncing..." : "Retry Sync"}
            </button>
          </div>
        </section>
      ) : null}

      <InventoryHealthPanel inventory={inventory} error={error} syncing={syncing} onRetry={() => void retryInventorySync()} />

      <section className="grid gap-3 rounded-[24px] border border-white/10 bg-white/[0.04] p-4 sm:grid-cols-2 xl:grid-cols-5">
        <label className="sm:col-span-2 xl:col-span-1">
          <span className="sr-only">Search vehicles</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search make, model, or variant"
            className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-300/40"
          />
        </label>
        <FilterSelect label="Make" value={make} onChange={setMake} options={makes} />
        <FilterSelect label="Year" value={year} onChange={setYear} options={years} />
        <FilterSelect label="Transmission" value={transmission} onChange={setTransmission} options={transmissions} />
        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className="sr-only">Minimum price</span>
            <input
              type="number"
              min={0}
              step={1000}
              value={minPrice}
              onChange={(event) => setMinPrice(event.target.value)}
              placeholder={`Min ${priceBounds.min ? priceBounds.min.toLocaleString("en-ZA") : "price"}`}
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-300/40"
            />
          </label>
          <label>
            <span className="sr-only">Maximum price</span>
            <input
              type="number"
              min={0}
              step={1000}
              value={maxPrice}
              onChange={(event) => setMaxPrice(event.target.value)}
              placeholder={`Max ${priceBounds.max ? priceBounds.max.toLocaleString("en-ZA") : "price"}`}
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-300/40"
            />
          </label>
        </div>
      </section>

      {mode === "listings" ? (
        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="overflow-hidden border border-white/10 bg-slate-950/70 p-0">
            <div className="border-b border-white/10 px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="success">Live</Badge>
                <Badge tone="neutral">Roar Website</Badge>
                <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Last synced {formatSyncedAt(inventory?.syncedAt ?? inventory?.source.lastSyncedAt ?? null)}</span>
              </div>
            </div>
            <div className="hidden md:block">
              <Table className="table-fixed">
                <thead>
                  <tr>
                    <th className="w-[26%]">Vehicle</th>
                    <th className="w-[14%]">Price</th>
                    <th className="w-[14%]">Mileage</th>
                    <th className="w-[12%]">Year</th>
                    <th className="w-[16%]">Transmission</th>
                    <th className="w-[18%] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVehicles.map((vehicle) => (
                    <tr key={vehicle.id}>
                      <td>
                        <div className="space-y-1">
                          <p className="font-medium text-slate-100">{vehicle.title}</p>
                          <p className="text-xs text-slate-500">{vehicle.make} {vehicle.model}</p>
                          <div className="flex flex-wrap gap-2 pt-1">
                            <Badge tone={getStatusTone(vehicle.status)}>{vehicle.status}</Badge>
                            <Badge tone="neutral">{vehicle.source}</Badge>
                          </div>
                        </div>
                      </td>
                      <td>{formatCurrency(vehicle.priceNumber ?? vehicle.price)}</td>
                      <td>{formatMileage(vehicle.mileageNumber ?? vehicle.mileage)}</td>
                      <td>{vehicle.year ?? "n/a"}</td>
                      <td>{vehicle.transmission ?? "n/a"}</td>
                      <td className="text-right">
                        <Link
                          href={`/dashboard/vehicle-finance/inventory/${encodeURIComponent(vehicle.id)}`}
                          className="inline-flex rounded-md border border-sky-300/25 bg-sky-300/10 px-3 py-1.5 text-xs font-semibold text-sky-100 no-underline transition hover:bg-sky-300/20"
                        >
                          View Vehicle
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>

            <div className="grid gap-4 p-4 md:hidden">
              {filteredVehicles.map((vehicle) => (
                <ListingCard key={vehicle.id} vehicle={vehicle} />
              ))}
            </div>
          </Card>

          <div className="grid gap-4">
            <Card>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Inventory Snapshot</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Metric label="Total Vehicles" value={inventory?.itemCount ?? 0} />
                <Metric label="Active Listings" value={inventory?.metrics.activeVehicles ?? 0} />
                <Metric label="Total Inventory Value" value={formatCurrency(inventory?.metrics.inventoryValue)} />
                <Metric label="Average Vehicle Price" value={formatCurrency(inventory?.metrics.averageVehiclePrice)} />
                <Metric label="Source" value={inventory?.source.type ?? "unavailable"} />
                <Metric label="Status" value={inventory?.status ?? "UNAVAILABLE"} />
              </div>
            </Card>

            <Card>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Mobile Ready</p>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                The listings layout keeps the table readable on desktop and collapses into cards on Android-sized screens without horizontal overflow.
              </p>
            </Card>
          </div>
        </section>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Total Vehicles" value={inventory?.itemCount ?? 0} />
            <MetricCard label="Active Listings" value={inventory?.metrics.activeVehicles ?? 0} />
            <MetricCard label="Total Inventory Value" value={formatCurrency(inventory?.metrics.inventoryValue)} />
            <MetricCard label="Average Vehicle Price" value={formatCurrency(inventory?.metrics.averageVehiclePrice)} />
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredVehicles.map((vehicle) => (
              <VehicleCard key={vehicle.id} vehicle={vehicle} />
            ))}
          </section>

          {!loading && filteredVehicles.length === 0 ? (
            <Card>
              <p className="py-8 text-center text-sm text-slate-300">No vehicles match the current filters.</p>
            </Card>
          ) : null}
        </>
      )}

      {inventory ? (
        <p className="text-center text-xs text-slate-500">
          Source: {inventory.source.type} · Last synced {formatSyncedAt(inventory.syncedAt ?? inventory.source.lastSyncedAt)}
        </p>
      ) : null}
    </main>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-300/40"
      >
        <option value="all">All {label}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{typeof value === "number" ? value.toLocaleString("en-ZA") : value}</p>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-white">{typeof value === "number" ? value.toLocaleString("en-ZA") : value}</p>
    </Card>
  );
}

function InventoryHealthPanel({
  inventory,
  error,
  syncing,
  onRetry,
}: {
  inventory: RoarInventoryResponse | null;
  error: string | null;
  syncing: boolean;
  onRetry: () => void;
}) {
  const diagnostics = inventory?.diagnostics;
  const missingImageCount = diagnostics?.brokenImageLinks ?? inventory?.vehicles.filter((vehicle) => !vehicle.imageUrl).length ?? 0;
  const healthTone = inventory?.status === "LIVE" ? "success" : inventory?.status === "CACHED" ? "warning" : "danger";

  return (
    <section className="rounded-[24px] border border-white/10 bg-slate-950/70 p-4 shadow-[0_18px_45px_rgba(2,8,23,0.2)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-100/80">Inventory Health</p>
          <h2 className="mt-1 text-lg font-semibold text-white">{inventory?.status ?? "UNAVAILABLE"}</h2>
          <p className="mt-1 text-sm text-slate-200">
            {error || inventory?.warning || "Inventory sync is reporting normally."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={healthTone}>{inventory?.status ?? "UNAVAILABLE"}</Badge>
          <button
            type="button"
            onClick={onRetry}
            disabled={syncing}
            className="rounded-lg border border-sky-300/25 bg-sky-300/10 px-3 py-2 text-xs font-semibold text-sky-100 hover:bg-sky-300/20 disabled:opacity-60"
          >
            {syncing ? "Syncing..." : "Retry Sync"}
          </button>
        </div>
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <HealthMetric label="Last Sync" value={formatSyncedAt(inventory?.syncedAt ?? inventory?.source.lastSyncedAt ?? null)} />
        <HealthMetric label="Vehicle Count" value={inventory?.itemCount ?? 0} />
        <HealthMetric label="Missing Images" value={missingImageCount} />
        <HealthMetric label="Failed Syncs" value={diagnostics?.failedSyncs ?? 0} />
        <HealthMetric label="Source" value={inventory?.source.type ?? "unavailable"} />
      </dl>
    </section>
  );
}

function HealthMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">{label}</dt>
      <dd className="mt-2 break-words text-sm font-semibold text-white">{typeof value === "number" ? value.toLocaleString("en-ZA") : value}</dd>
    </div>
  );
}

function VehicleCard({ vehicle }: { vehicle: RoarInventoryVehicle }) {
  const imageSrc = vehicle.imageUrl || PLACEHOLDER_IMAGE;

  return (
    <article className="group overflow-hidden rounded-[24px] border border-white/10 bg-slate-950/70 shadow-[0_18px_45px_rgba(2,8,23,0.2)] transition hover:-translate-y-1 hover:border-sky-300/25">
      <div className="relative aspect-[16/10] overflow-hidden bg-slate-900">
        {/* Source URLs are normalized server-side and displayed only as passive vehicle imagery. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc}
          alt={vehicle.title}
          loading="lazy"
          onError={(event) => {
            if (!event.currentTarget.src.endsWith(PLACEHOLDER_IMAGE)) event.currentTarget.src = PLACEHOLDER_IMAGE;
          }}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        />
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2">
              <Badge tone={getStatusTone(vehicle.status)}>{vehicle.status}</Badge>
              <Badge tone="neutral">{vehicle.source}</Badge>
            </div>
            <h2 className="mt-3 line-clamp-2 text-lg font-semibold text-white">{vehicle.title}</h2>
          </div>
          {vehicle.year ? <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs text-slate-200">{vehicle.year}</span> : null}
        </div>
        <p className="mt-4 text-2xl font-semibold text-white">{formatCurrency(vehicle.priceNumber ?? vehicle.price)}</p>
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-400">
          <span>{formatMileage(vehicle.mileageNumber ?? vehicle.mileage)}</span>
          <span className="text-right">{vehicle.transmission ?? "Transmission n/a"}</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
          <span>{vehicle.fuelType ?? "Fuel type n/a"}</span>
          <span>{vehicle.bodyType ?? "Body type n/a"}</span>
        </div>
      <Link
        href={`/dashboard/vehicle-finance/inventory/${encodeURIComponent(vehicle.id)}`}
        className="mt-5 inline-flex w-full items-center justify-center rounded-xl border border-sky-300/25 bg-sky-300/10 px-4 py-2.5 text-sm font-semibold text-sky-100 no-underline transition hover:bg-sky-300/20"
      >
        View Vehicle
      </Link>
      </div>
    </article>
  );
}

function ListingCard({ vehicle }: { vehicle: RoarInventoryVehicle }) {
  return (
    <article className="rounded-[20px] border border-white/10 bg-slate-950/70 p-4">
      <div className="flex items-start gap-3">
        <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-xl bg-slate-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={vehicle.imageUrl || PLACEHOLDER_IMAGE}
            alt={vehicle.title}
            loading="lazy"
            onError={(event) => {
              if (!event.currentTarget.src.endsWith(PLACEHOLDER_IMAGE)) event.currentTarget.src = PLACEHOLDER_IMAGE;
            }}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <Badge tone={getStatusTone(vehicle.status)}>{vehicle.status}</Badge>
            <Badge tone="neutral">{vehicle.source}</Badge>
          </div>
          <h3 className="mt-2 line-clamp-2 text-base font-semibold text-white">{vehicle.title}</h3>
          <p className="mt-1 text-sm text-slate-300">{formatCurrency(vehicle.priceNumber ?? vehicle.price)}</p>
          <p className="mt-1 text-xs text-slate-400">
            {formatMileage(vehicle.mileageNumber ?? vehicle.mileage)} · {vehicle.transmission ?? "n/a"} · {vehicle.year ?? "n/a"}
          </p>
        </div>
      </div>
    <Link
      href={`/dashboard/vehicle-finance/inventory/${encodeURIComponent(vehicle.id)}`}
      className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-sky-300/25 bg-sky-300/10 px-4 py-2.5 text-sm font-semibold text-sky-100 no-underline transition hover:bg-sky-300/20"
    >
      View Vehicle
    </Link>
    </article>
  );
}
