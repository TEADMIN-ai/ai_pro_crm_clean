"use client";

import Image from "next/image";

import { TORQUE_EMPIRE_BRAND, TORQUE_EMPIRE_BRAND_ASSETS } from "@/lib/branding/identity";

type CorporateBrandMarkProps = {
  tone?: "light" | "dark";
  compact?: boolean;
  showTagline?: boolean;
  className?: string;
};

export default function CorporateBrandMark({
  tone = "light",
  compact = false,
  showTagline = true,
  className = "",
}: CorporateBrandMarkProps) {
  const logoSrc = tone === "dark" ? TORQUE_EMPIRE_BRAND_ASSETS.logoLightPng : TORQUE_EMPIRE_BRAND_ASSETS.logoPrimaryPng;
  const textClassName = tone === "dark" ? "text-white" : "text-[color:var(--tex-text-strong)]";
  const subtitleClassName = tone === "dark" ? "text-slate-300" : "text-[color:var(--tex-text-muted)]";

  return (
    <div className={`flex items-center gap-3 ${className}`.trim()}>
      <Image
        src={compact ? TORQUE_EMPIRE_BRAND_ASSETS.monogramSvg : logoSrc}
        alt={TORQUE_EMPIRE_BRAND.brandName}
        width={compact ? 44 : 176}
        height={compact ? 44 : 56}
        priority={false}
        unoptimized
        className={compact ? "h-11 w-11 shrink-0" : "h-12 w-auto shrink-0"}
      />
      {!compact ? (
        <div className="min-w-0">
          <div className={`text-sm font-extrabold uppercase tracking-[0.22em] ${textClassName}`.trim()}>
            {TORQUE_EMPIRE_BRAND.brandName}
          </div>
          <div className={`mt-1 text-[11px] font-medium tracking-[0.18em] uppercase ${subtitleClassName}`.trim()}>
            {showTagline ? TORQUE_EMPIRE_BRAND.tagline : TORQUE_EMPIRE_BRAND.division}
          </div>
        </div>
      ) : null}
    </div>
  );
}
