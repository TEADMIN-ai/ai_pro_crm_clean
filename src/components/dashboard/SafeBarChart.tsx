type Props = {
  data: number[];
};

export default function SafeBarChart({ data }: Props) {
  const max = Math.max(...data, 1);
  const barWidth = data.length > 0 ? `${100 / data.length}%` : "100%";

  return (
    <div className="flex h-[200px] w-full items-end gap-2 overflow-hidden">
      {data.map((value, index) => (
        <div
          key={index}
          className="min-w-0 rounded-md bg-blue-500"
          style={{
            width: barWidth,
            height: `${(value / max) * 100}%`,
          }}
        />
      ))}
    </div>
  );
}
