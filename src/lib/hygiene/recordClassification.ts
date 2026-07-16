import type { HygieneRecordClassification } from "@/types/hygiene"

const CLASSIFICATIONS: readonly HygieneRecordClassification[] = ["PRODUCTION", "TEST", "DEMO", "ARCHIVED"] as const
const TEST_WORDS = ["qa", "test", "testing", "uat", "sandbox"]
const DEMO_WORDS = ["demo", "mock", "sample", "fixture", "dummy", "fake"]

function asString(value: unknown) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeToken(value: unknown) {
  const raw = asString(value)
  if (!raw) return null
  const token = raw.toUpperCase().replace(/[\s-]+/g, "_")
  if (token === "PROD") return "PRODUCTION"
  if (token === "LIVE") return "PRODUCTION"
  if (token === "OPERATIONAL") return "PRODUCTION"
  if (token === "QA") return "TEST"
  if (token === "UAT") return "TEST"
  if (token === "SANDBOX") return "TEST"
  if (token === "TEST_DATA") return "TEST"
  if (token === "DEMO_DATA") return "DEMO"
  if (token === "PRESENTATION") return "DEMO"
  return CLASSIFICATIONS.includes(token as HygieneRecordClassification) ? token as HygieneRecordClassification : null
}

function containsWord(haystack: string, words: string[]) {
  const normalized = haystack.toLowerCase()
  return words.some((word) => new RegExp(`(^|[^a-z0-9])${word}([^a-z0-9]|$)`, "i").test(normalized))
}

export function inferHygieneRecordClassification(record: Record<string, unknown>): HygieneRecordClassification {
  if (record.archived === true) return "ARCHIVED"
  if (normalizeToken(record.recordStatus) === "ARCHIVED") return "ARCHIVED"

  const haystack = [record.clientId, record.clientName, record.clientType, record.primaryContactName, record.primaryContactEmail, record.billingContact, record.companyRegistration, record.siteName, record.contactPerson, record.collectionId, record.manifestId, record.owner, record.title, record.documentType, record.registrationNumber, record.notes]
    .map((value) => asString(value))
    .filter(Boolean)
    .join(" ")

  if (haystack.toLowerCase().includes("example.invalid")) return "TEST"
  if (haystack.toLowerCase().includes(".test")) return "TEST"
  if (containsWord(haystack, TEST_WORDS)) return "TEST"
  if (haystack.toLowerCase().includes("example.com")) return "DEMO"
  if (containsWord(haystack, DEMO_WORDS)) return "DEMO"

  const explicit = normalizeToken(record.recordClassification) ?? normalizeToken(record.classification) ?? normalizeToken(record.dataClassification) ?? normalizeToken(record.dataClass) ?? normalizeToken(record.environment) ?? normalizeToken(record.recordType)
  if (explicit) return explicit
  return "PRODUCTION"
}

export function normalizeHygieneRecordClassification(value: unknown, fallbackRecord: Record<string, unknown> = {}): HygieneRecordClassification {
  return normalizeToken(value) ?? inferHygieneRecordClassification(fallbackRecord)
}

export function isVisibleHygieneClassification(classification: HygieneRecordClassification, options: { includeTestData?: boolean } = {}): boolean {
  if (classification === "PRODUCTION") return true
  if (classification === "ARCHIVED") return false
  if (options.includeTestData !== true) return false
  if (classification === "TEST") return true
  return classification === "DEMO"
}

export function isOperationalHygieneRecord(record: Record<string, unknown>): boolean {
  return inferHygieneRecordClassification(record) === "PRODUCTION"
}
