"use client";

import Link from "next/link";
import type { MouseEvent } from "react";

export function ReturnButton({
  fallbackHref,
  label,
  className,
}: {
  fallbackHref: string;
  label: string;
  className?: string;
}) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (typeof window === "undefined" || window.history.length <= 1) return;
    event.preventDefault();
    window.history.back();
  }

  return (
    <Link
      href={fallbackHref}
      onClick={handleClick}
      className={className ?? "tex-action-button tex-action-button--secondary"}
    >
      {label}
    </Link>
  );
}
