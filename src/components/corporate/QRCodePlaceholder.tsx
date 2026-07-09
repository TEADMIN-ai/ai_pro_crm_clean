import { TORQUE_EMPIRE_COMPANY_PROFILE } from "@/lib/corporate/companyProfile";

type CorporateQRCodePlaceholderProps = {
  label?: string;
};

export function CorporateQRCodePlaceholder({
  label = "QR code reserved for confirmed production domain",
}: CorporateQRCodePlaceholderProps) {
  return (
    <div className="inline-grid gap-3 rounded-md border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
      <div
        aria-hidden="true"
        className="grid h-32 w-32 grid-cols-4 grid-rows-4 gap-1 rounded-sm border border-slate-200 bg-slate-50 p-2"
      >
        {Array.from({ length: 16 }).map((_, index) => (
          <span
            key={index}
            className={index % 3 === 0 || index === 5 || index === 10 ? "bg-[#0b2f57]" : "bg-slate-200"}
          />
        ))}
      </div>
      <div>
        <p className="font-bold text-slate-900">{label}</p>
        <p className="mt-1 max-w-48 leading-5">
          Target: {TORQUE_EMPIRE_COMPANY_PROFILE.website}
        </p>
      </div>
    </div>
  );
}
