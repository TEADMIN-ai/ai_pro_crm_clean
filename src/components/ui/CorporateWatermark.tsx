"use client";

export default function CorporateWatermark() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1]">
      <div className="text-center select-none opacity-[0.08]">
        <div className="text-[220px] font-bold tracking-widest text-gray-400">
          TE
        </div>

        <div className="mt-6 text-2xl tracking-[0.4em] text-gray-500">
          TORQUE EMPIRE
        </div>

        <div className="mt-2 text-xs tracking-[0.5em] text-gray-400">
          AI SYSTEM CORE
        </div>
      </div>
    </div>
  );
}
