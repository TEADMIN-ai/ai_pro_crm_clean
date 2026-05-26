"use client";

import Link from "next/link";

export type SidebarItemProps = {
  href: string;
  label: string;
  active?: boolean;
};

export default function SidebarItem({ href, label, active }: SidebarItemProps) {
  return (
    <Link
      href={href}
      className={`flex w-full items-center rounded-2xl border px-4 py-3 text-sm transition duration-200 ${
        active
          ? "border-cyan-400/20 bg-cyan-400/10 text-white shadow-[0_12px_28px_rgba(8,145,178,0.16)]"
          : "border-transparent text-white/70 hover:border-white/10 hover:bg-white/[0.04] hover:text-white"
      }`}
    >
      <span className="font-medium tracking-[0.01em]">{label}</span>
    </Link>
  );
}
