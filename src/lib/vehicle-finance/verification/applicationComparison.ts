import type { DriverLicenceExtraction } from "../extractors/driverLicenceExtractor";
import type { VehicleFinanceApplication, VehicleFinanceCustomer } from "@/types/vehicleFinance";

export type DriverLicenceApplicationComparisonFlag =
  | "NAME_MISMATCH"
  | "SURNAME_MISMATCH"
  | "ID_MISMATCH";

export type DriverLicenceApplicationComparison = {
  flags: DriverLicenceApplicationComparisonFlag[];
  passed: boolean;
};

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function compareApplicationToDriverLicence(
  application: Pick<VehicleFinanceApplication, "customerId">,
  customer: Pick<VehicleFinanceCustomer, "firstName" | "lastName" | "idNumber"> | null,
  extraction: DriverLicenceExtraction,
): DriverLicenceApplicationComparison {
  const flags: DriverLicenceApplicationComparisonFlag[] = [];

  if (!customer) {
    return {
      flags: ["NAME_MISMATCH", "SURNAME_MISMATCH", "ID_MISMATCH"],
      passed: false,
    };
  }

  if (normalize(customer.firstName) && normalize(extraction.name) && !normalize(extraction.name).includes(normalize(customer.firstName))) {
    flags.push("NAME_MISMATCH");
  }

  if (normalize(customer.lastName) && normalize(extraction.surname) && !normalize(extraction.surname).includes(normalize(customer.lastName))) {
    flags.push("SURNAME_MISMATCH");
  }

  if (normalize(customer.idNumber) && normalize(extraction.idNumber) && normalize(customer.idNumber) !== normalize(extraction.idNumber)) {
    flags.push("ID_MISMATCH");
  }

  if (!normalize(extraction.name) && normalize(customer.firstName)) {
    flags.push("NAME_MISMATCH");
  }

  if (!normalize(extraction.surname) && normalize(customer.lastName)) {
    flags.push("SURNAME_MISMATCH");
  }

  if (!normalize(extraction.idNumber) && normalize(customer.idNumber)) {
    flags.push("ID_MISMATCH");
  }

  return {
    flags: Array.from(new Set(flags)),
    passed: flags.length === 0,
  };
}
