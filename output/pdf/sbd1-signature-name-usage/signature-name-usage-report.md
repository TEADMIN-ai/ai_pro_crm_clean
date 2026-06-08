# SBD1 Signature Name Usage Report

Generated: 2026-05-31

## Scope

This is an investigation-only report for `SBD1.signature_name`.

No templates, mappings, coordinates, calibration overrides, renderer logic, or bounding boxes were modified.

## Summary

`SBD1.signature_name` should not render on the current SBD1 page in its current configuration.

The field is defined as a signature/signatory field, but the current SBD1 template page is the supplier-information page. The observed render is not anchored to a real signing section. It is rendered by the generic anchor-placement fallback after matching `NAME OF BIDDER`, not `SIGNATURE OF BIDDER`.

## Findings

### 1. Should `SBD1.signature_name` Render On The Current Page?

Current evidence says no.

The SBD1 template definition includes:

- File: `src/lib/empirePdf/templates/sbd1.ts`
- Field ID: `signature_name`
- Page index: `0`
- Anchor text: `SIGNATURE OF BIDDER`
- Field type: `signature`
- Semantic key: `signatureName`
- Placement: `below`
- Fallback: `x: 150, y: 82, width: 220, height: 14`

However, the current rendered/debug page is the SBD1 “Invitation to Bid” supplier-information page. The visible page contains supplier fields, B-BBEE fields, and foreign supplier/company type checkboxes. It does not contain a visible signing section corresponding to `SIGNATURE OF BIDDER`.

The existing QA trace confirms `SBD1.signature_name` rendered anyway:

```json
{
  "fieldKey": "SBD1.signature_name",
  "sourceField": "contractor.directorName",
  "semanticKey": "signatureName",
  "matchedAnchor": "NAME OF BIDDER",
  "confidence": 0.61,
  "placementMethod": "placement_anchor",
  "resolutionStrategy": "placement_anchor",
  "pageIndex": 0,
  "rendered": true,
  "fallbackUsed": false,
  "x": 29.32,
  "y": 390.00998
}
```

That is not a valid signature-section placement.

### 2. Is The Field Intended Only For Signing Sections?

Yes.

The template and semantic registry both classify the field as a signature/signatory field:

| Source | Evidence |
| --- | --- |
| `src/lib/empirePdf/templates/sbd1.ts` | `fieldType: "signature"`, `anchorText: "SIGNATURE OF BIDDER"`, `semanticKey: "signatureName"` |
| `src/lib/empirePdf/semanticRegistry/registry.ts` | aliases include `SIGNATURE OF BIDDER`, `SIGNATURE`, `AUTHORISED SIGNATORY`; `fieldType: "signature"` |

Its purpose is to place the signatory name in a signing/signature area, not to duplicate the bidder, director, contact, or representative name elsewhere on the supplier-information page.

### 3. Is The Current Template Placement Valid?

No.

There are two placement problems:

1. `SBD1.signature_name` has no calibrated bounding box in `src/lib/empirePdf/boundingBoxes/sbd1.ts`.
2. Because no bounding box exists, the renderer falls back to generic anchor placement. The anchor resolver did not find `SIGNATURE OF BIDDER`; it matched `NAME OF BIDDER` with low confidence instead.

The generic placement logic for `placement: "below"` places the value below the detected anchor:

```ts
x: anchor.x,
y: anchor.y - anchor.height - offsetY
```

That behavior is valid for real anchors, but invalid here because the matched anchor is not a signature anchor.

### 4. Should It Be Conditionally Suppressed When No Signature Section Exists?

Yes.

For the current SBD1 page/template version, `SBD1.signature_name` should be suppressed unless one of these is true:

- A calibrated `signature_name` bounding box exists for the current SBD1 template/page.
- A high-confidence signature-section anchor is found, such as `SIGNATURE OF BIDDER`.
- The SBD1 template version is known to include a signing section on the current page.

If none of those conditions are met, rendering the field creates a false positive person-name placement.

## Related SBD4 Comparison

SBD4 has explicit signatory/representative fields:

| Form | Field | Semantic key | Current role |
| --- | --- | --- | --- |
| SBD4 | `director_name` | `signatureName` | Bidder/representative name |
| SBD4 | `signature_name` | `signatureName` | Signing/declaration section |

SBD1 reuses the same semantic key, but the current SBD1 page does not provide an equivalent valid signature section for that value.

## Conclusion

`SBD1.signature_name` is intended for a signing section, but the current SBD1 page does not expose a valid signature target. The current template placement is therefore not valid for this page. It should be suppressed unless the template has a real signature section anchor or calibrated signature bounding box.

