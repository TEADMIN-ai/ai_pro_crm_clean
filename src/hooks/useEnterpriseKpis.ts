"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/client/authFetch";
import { API_ROUTES } from "@/lib/routes";
import type { EnterpriseKpiSnapshot } from "@/lib/kpis/enterpriseSnapshot";

type UseEnterpriseKpisOptions = {
  enabled?: boolean;
};

export function useEnterpriseKpis(options: UseEnterpriseKpisOptions = {}) {
  const { enabled = true } = options;
  const [data, setData] = useState<EnterpriseKpiSnapshot | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setData(null);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 6000);

    authFetch(API_ROUTES.ENTERPRISE_KPIS, { cache: "no-store", signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load enterprise KPIs (${response.status})`);
        }

        return response.json() as Promise<EnterpriseKpiSnapshot>;
      })
      .then((snapshot) => {
        setData(snapshot);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof Error && loadError.name !== "AbortError") {
          console.error("[useEnterpriseKpis] Snapshot fetch failed", loadError);
        }

        setData(null);
        setError(
          loadError instanceof Error && loadError.name === "AbortError"
            ? "Enterprise KPIs took too long to load."
            : "Enterprise KPIs are temporarily unavailable.",
        );
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
        setLoading(false);
      });

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [enabled]);

  return { data, loading, error };
}
