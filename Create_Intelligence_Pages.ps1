# ================================
# STRIKER PHASE 8 – Intelligence Engine Auto-Builder
# ================================

$base = "src/app/tenders/[tenderId]/intelligence"

# Ensure directory structure exists
if (-not (Test-Path "$base/competitors")) {
    New-Item -ItemType Directory -Path "$base/competitors" -Force | Out-Null
}
if (-not (Test-Path "$base/strategy")) {
    New-Item -ItemType Directory -Path "$base/strategy" -Force | Out-Null
}

# ----------------------------
# Competitors Page
# ----------------------------
$competitorsPage = @"
"use client";
import { useEffect, useState } from "react";

export default function CompetitorIntelligencePage() {
  const [intel, setIntel] = useState<any>(null);

  useEffect(() => {
    fetch("/api/intelligence/competitors")
      .then((res) => res
