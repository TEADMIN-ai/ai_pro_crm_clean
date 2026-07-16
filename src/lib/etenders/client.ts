import { filterNormalizedEtendersRecords, mapEtendersFiltersToDataTables, normalizeEtendersOpportunity } from "@/lib/etenders/normalization";
import type { EtendersSearchFilters, EtendersSourceRecord } from "@/lib/etenders/types";

const ETENDERS_ENDPOINT = "https://www.etenders.gov.za/Home/PaginatedTenderOpportunities";
const USER_AGENT = "TorqueEmpire-TEOS/1.0 (+https://www.torqueempire.co.za; public eTenders opportunity review)";

export interface EtendersSearchResult {
  sourceUrl: string;
  endpoint: string;
  method: "GET";
  responseFormat: "DataTables JSON";
  recordsTotal: number;
  recordsFiltered: number;
  results: EtendersSourceRecord[];
}

export class EtendersSourceError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "EtendersSourceError";
    this.status = status;
  }
}

export async function fetchEtendersOpportunities(input: {
  filters?: EtendersSearchFilters;
  start?: number;
  length?: number;
  fetchImpl?: typeof fetch;
  now?: string;
} = {}): Promise<EtendersSearchResult> {
  const fetcher = input.fetchImpl ?? fetch;
  const params = new URLSearchParams();
  const mapped = mapEtendersFiltersToDataTables(input.filters);
  params.set("draw", "1");
  params.set("start", String(Math.max(0, input.start ?? 0)));
  params.set("length", String(Math.min(50, Math.max(1, input.length ?? 10))));
  params.set("status", String(mapped.status));
  if (mapped.search.value) params.set("search[value]", mapped.search.value);
  if (mapped.tenderNumber) params.set("tenderNumber", mapped.tenderNumber);
  if (mapped.categories) params.set("categories", mapped.categories);
  if (mapped.provinces) params.set("provinces", mapped.provinces);
  if (mapped.departments) params.set("departments", mapped.departments);
  if (mapped.requestType) params.set("requestType", mapped.requestType);
  if (mapped.eSubmission) params.set("eSubmission", mapped.eSubmission);

  let response: Response;
  try {
    response = await fetcher(`${ETENDERS_ENDPOINT}?${params.toString()}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
      cache: "no-store",
    });
  } catch (error) {
    throw new EtendersSourceError(error instanceof Error ? error.message : "eTenders source request failed");
  }

  if (!response.ok) {
    throw new EtendersSourceError(`eTenders source returned ${response.status}`, response.status);
  }

  const payload = (await response.json()) as { recordsTotal?: number; recordsFiltered?: number; data?: unknown[] };
  const normalized = (payload.data ?? []).map((item) => normalizeEtendersOpportunity(item, input.now));

  return {
    sourceUrl: "https://www.etenders.gov.za/Home/opportunities?id=1",
    endpoint: ETENDERS_ENDPOINT,
    method: "GET",
    responseFormat: "DataTables JSON",
    recordsTotal: payload.recordsTotal ?? normalized.length,
    recordsFiltered: payload.recordsFiltered ?? normalized.length,
    results: filterNormalizedEtendersRecords(normalized, input.filters),
  };
}

