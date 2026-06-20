import Image from "next/image";
import Link from "next/link";

import Card, { IdentityCardHeader } from "@/components/ui/Card";
import { listVehicleInventory } from "@/lib/vehicle-finance/inventory/vehicleInventory";

type Props = {
  mode: "listings" | "inventory";
};

export default function RoarCarsInventoryWorkspace({ mode }: Props) {
  const inventory = listVehicleInventory();
  const available = inventory.filter((vehicle) => vehicle.status === "AVAILABLE").length;
  const reserved = inventory.filter((vehicle) => vehicle.status === "RESERVED").length;
  const title = mode === "listings" ? "Vehicle Listings" : "Vehicle Inventory";
  const description =
    mode === "listings"
      ? "Customer-facing stock presentation and premium vehicle merchandising."
      : "Live dealership stock control, availability, reservations, and movement tracking.";

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 pb-10 md:p-6 lg:p-8">
      <section className="relative overflow-hidden rounded-[30px] border border-sky-300/20 bg-slate-950 px-6 py-8 shadow-[0_24px_70px_rgba(2,8,23,0.4)] md:px-8">
        <Image
          src="/images/roar-cars-showroom.jpg"
          alt="Roar Cars SA showroom"
          fill
          sizes="100vw"
          className="object-cover object-center opacity-35"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/85 to-slate-950/35" />
        <div className="relative max-w-2xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-sky-200/80">Roar Cars SA · Born To Roar</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">{title}</h1>
          <p className="mt-4 text-sm leading-6 text-slate-200 sm:text-base">{description}</p>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ["Total Stock", inventory.length],
          ["Available", available],
          ["Reserved", reserved],
        ].map(([label, value]) => (
          <Card key={label as string}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{label as string}</p>
            <p className="mt-3 text-3xl font-semibold text-white">{value as number}</p>
          </Card>
        ))}
      </section>

      <Card>
        <IdentityCardHeader
          title={inventory.length ? `${title} Portfolio` : "Inventory feed ready"}
          subtitle={inventory.length ? "Current Roar Cars SA dealership stock" : "Connect the dealership inventory source to publish live vehicle stock."}
        />
        {inventory.length ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {inventory.map((vehicle) => (
              <article key={vehicle.stockNumber} className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-sky-200/70">{vehicle.stockNumber}</p>
                <h2 className="mt-2 text-lg font-semibold text-white">
                  {vehicle.yearModel} {vehicle.vehicleMake} {vehicle.vehicleModel}
                </h2>
                <p className="mt-1 text-sm text-slate-400">{vehicle.vehicleVariant}</p>
                <div className="mt-5 flex items-end justify-between gap-4">
                  <p className="text-xl font-semibold text-white">R {vehicle.vehiclePrice.toLocaleString("en-ZA")}</p>
                  <span className="rounded-full border border-sky-300/20 bg-sky-300/10 px-3 py-1 text-xs font-semibold text-sky-100">
                    {vehicle.status}
                  </span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-sky-300/20 bg-sky-300/[0.04] px-6 py-10 text-center">
            <p className="text-sm text-slate-300">No vehicles have been loaded into the live inventory yet.</p>
            <Link href="/dashboard/vehicle-finance/applications" className="mt-4 inline-flex rounded-full border border-sky-300/30 bg-sky-300/10 px-4 py-2 text-sm font-semibold text-sky-100 no-underline">
              View Finance Applications
            </Link>
          </div>
        )}
      </Card>
    </main>
  );
}
