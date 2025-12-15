export function validateContractor(data: any) {
  const errors: string[] = [];

  if (!data.name) errors.push("Name is required.");
  if (!data.company) errors.push("Company is required.");
  if (!data.contact) errors.push("Contact number is required.");
  if (!data.taxPin) errors.push("Tax PIN is required.");
  if (!data.bbbeeLevel) errors.push("BBBEE Level is required.");

  return {
    valid: errors.length === 0,
    errors,
  };
}
