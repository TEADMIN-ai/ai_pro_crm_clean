# Recommended Fix For SBD1 Signature Name Usage

Generated: 2026-05-31

## Scope

This is a recommendation only.

No fixes were applied. No templates, mappings, coordinates, calibration overrides, renderer logic, or bounding boxes were modified.

## Recommended Direction

Suppress `SBD1.signature_name` for the current SBD1 template/page unless a real signature section is present.

This should be treated as a field-eligibility issue, not a coordinate calibration issue.

## Recommended Rule

Before rendering `SBD1.signature_name`, require one of the following:

1. A calibrated SBD1 bounding box exists for `signature_name`.
2. A high-confidence anchor match exists for a signature-specific phrase, such as `SIGNATURE OF BIDDER`.
3. The template metadata explicitly marks the current page as containing a signing section.

If none of those conditions are met, do not render `SBD1.signature_name`.

## Preferred Fix Shape

Add a suppression/eligibility layer around signature fields in the intelligent fill path.

Conceptually:

```ts
if (
  formId === "SBD1" &&
  field.fieldId === "signature_name" &&
  !hasBoundingBox &&
  !hasHighConfidenceSignatureAnchor
) {
  skipRender("signature section unavailable on current SBD1 page");
}
```

This avoids modifying coordinates and prevents weak anchor matches such as `NAME OF BIDDER` from becoming signature placements.

## Do Not Fix This With Coordinates

Do not add a calibration override for the current bad render.

The current render is not merely misplaced. It is semantically ineligible because the current page does not expose a valid signing area.

Coordinate changes would only move an invalid field to a different location.

## Do Not Reuse Generic Bidder Anchors

`SBD1.signature_name` should not use `NAME OF BIDDER`, `BIDDER NAME`, or supplier-information labels as acceptable anchors.

Allowed anchors should be signature-specific:

- `SIGNATURE OF BIDDER`
- `AUTHORISED SIGNATORY`
- `SIGNATURE`
- another template-approved signing-section label

## Optional Future Model Change

If SBD1 variants exist where a signature section is present, the template metadata should distinguish them explicitly:

| Template variant | `signature_name` behavior |
| --- | --- |
| Supplier-information-only SBD1 page | Suppressed |
| SBD1 page with signing section | Render via calibrated box or high-confidence signature anchor |

This keeps SBD1 and SBD4 sharing the `signatureName` semantic value while preventing SBD1 from rendering it on pages that do not contain a signing section.

## Verification Criteria For A Future Fix

A future fix should pass these checks:

1. `SBD1.signature_name` does not render when no signature section exists.
2. `SBD1.signature_name` does render when a valid signature section exists.
3. It never anchors to `NAME OF BIDDER`.
4. It does not require coordinate or calibration override changes for the current SBD1 page.
5. Existing SBD4 `director_name` and `signature_name` behavior remains unchanged.

