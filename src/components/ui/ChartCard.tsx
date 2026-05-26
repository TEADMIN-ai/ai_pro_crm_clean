"use client";

type ChartCardVariant = "circular" | "bars" | "line";

type ChartCardProps = {
  title: string;
  subtitle: string;
  variant: ChartCardVariant;
  valueLabel?: string;
  percent?: number;
  data?: number[];
  barLabels?: string[];
};

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function CircularProgress({ percent = 0 }: { percent?: number }) {
  const safePercent = clampPercent(percent);
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (safePercent / 100) * circumference;

  return (
    <>
      <svg viewBox="0 0 120 120" width="120" height="120" className="h-[120px] w-[120px] shrink-0 max-w-full -rotate-90">
        <circle cx="60" cy="60" r={radius} className="fill-none stroke-slate-100" strokeWidth="12" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          className="fill-none stroke-[url(#complianceGradient)] transition-all duration-500"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
        <defs>
          <linearGradient id="complianceGradient" x1="0%" x2="100%">
            <stop offset="0%" stopColor="#6D28D9" />
            <stop offset="100%" stopColor="#4338CA" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <p className="text-3xl font-bold text-slate-900">{safePercent}%</p>
        <p className="text-sm text-gray-500">Aligned</p>
      </div>
    </>
  );
}

function BarsChart({ data = [8, 14, 5], barLabels = ["Ready", "Risk", "Blocked"] }: Pick<ChartCardProps, "data" | "barLabels">) {
  const max = Math.max(...data, 1);

  return (
    <div className="flex w-full flex-col justify-between gap-4 self-stretch">
      <div className="grid min-h-0 grow grid-cols-3 items-end gap-4">
        {data.map((value, index) => {
          const height = Math.max(18, Math.round((value / max) * 100));
          const gradients = [
            "from-green-400 to-green-600",
            "from-orange-400 to-orange-600",
            "from-rose-400 to-rose-600",
          ];

          return (
            <div key={`${barLabels?.[index] ?? index}`} className="flex min-w-0 flex-col items-center gap-3">
              <div className="text-sm font-semibold text-slate-700">{value}</div>
              <div className="flex min-h-[140px] w-full items-end">
                <div
                  className={`w-full rounded-t-2xl bg-gradient-to-t ${gradients[index] ?? "from-indigo-400 to-indigo-600"}`}
                  style={{ height: `${height}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-3 gap-3 text-center text-xs font-medium uppercase tracking-[0.2em] text-gray-500">
        {barLabels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  );
}

function LineChart({ data = [32, 48, 44, 60, 58, 72, 68] }: Pick<ChartCardProps, "data">) {
  const width = 360;
  const height = 180;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const points = data
    .map((value, index) => {
      const x = (index / Math.max(data.length - 1, 1)) * width;
      const normalized = (value - min) / Math.max(max - min, 1);
      const y = height - normalized * (height - 24) - 12;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="flex w-full flex-col justify-between gap-4 self-stretch">
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="h-[180px] w-full shrink-0 max-w-full">
        <defs>
          <linearGradient id="activityLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6D28D9" />
            <stop offset="100%" stopColor="#4338CA" />
          </linearGradient>
        </defs>
        {[24, 72, 120, 168].map((y) => (
          <line key={y} x1="0" y1={y} x2={width} y2={y} stroke="#E5E7EB" strokeDasharray="4 6" />
        ))}
        <polyline
          fill="none"
          stroke="url(#activityLineGradient)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
        {data.map((value, index) => {
          const x = (index / Math.max(data.length - 1, 1)) * width;
          const normalized = (value - min) / Math.max(max - min, 1);
          const y = height - normalized * (height - 24) - 12;
          return <circle key={`${value}-${index}`} cx={x} cy={y} r="5" fill="#4338CA" />;
        })}
      </svg>
      <div className="flex justify-between text-xs font-medium uppercase tracking-[0.2em] text-gray-500">
        <span>Mon</span>
        <span>Tue</span>
        <span>Wed</span>
        <span>Thu</span>
        <span>Fri</span>
        <span>Sat</span>
        <span>Sun</span>
      </div>
    </div>
  );
}

export default function ChartCard({
  title,
  subtitle,
  variant,
  valueLabel,
  percent,
  data,
  barLabels,
}: ChartCardProps) {
  return (
    <article className="rounded-xl bg-white p-6 shadow-md ring-1 ring-slate-200/80">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
        {valueLabel ? <p className="mt-3 text-xl font-bold text-slate-900">{valueLabel}</p> : null}
      </div>

      <div className="relative mx-auto flex h-[260px] w-full max-w-[420px] items-center justify-center overflow-hidden">
        {variant === "circular" ? <CircularProgress percent={percent} /> : null}
        {variant === "bars" ? <BarsChart data={data} barLabels={barLabels} /> : null}
        {variant === "line" ? <LineChart data={data} /> : null}
      </div>
    </article>
  );
}
