"use client";

type Props = {
  title: string;
  value: number | string;
  description?: string;
  trend?: string;
};

export default function KpiCard({
  title,
  value,
  description,
  trend,
}: Props) {
  return (
    <div className="group relative overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(8,15,30,0.98))] p-5 shadow-[0_18px_45px_rgba(2,8,23,0.28)] transition duration-300 hover:-translate-y-1 hover:border-cyan-300/20 hover:shadow-[0_24px_70px_rgba(8,145,178,0.18)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-cyan-300/0 via-cyan-300/80 to-blue-400/0" />
      <div className="pointer-events-none absolute right-[-24px] top-[-24px] h-24 w-24 rounded-full bg-cyan-300/10 blur-2xl transition duration-300 group-hover:bg-cyan-300/20" />
      <div className="relative">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
          {title}
        </p>
        <p className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-white md:text-[2.5rem]">
          {value}
        </p>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          {description ?? "Updated from the latest portfolio summary."}
        </p>
        <p className="mt-4 text-xs font-medium tracking-[0.16em] text-cyan-200/85">
          {trend ?? "Stable monitoring"}
        </p>
      </div>
    </div>
  );
}
