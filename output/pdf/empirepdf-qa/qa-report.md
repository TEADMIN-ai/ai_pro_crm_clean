# EmpirePDF Visual Calibration & Human QA

Generated: 2026-05-29T12:28:54.795Z
Scenarios: 6
Total renderer warnings: 2

## Scenario Outputs

### Baseline Local PTY
- Scenario ID: `baseline_local_pty`
- Purpose: Reference calibration for standard South African PTY supplier values.
- Pack: [pack.pdf](./baseline_local_pty/pack.pdf)
- Debug Pack: [pack.debug.pdf](./baseline_local_pty/pack.debug.pdf)
- SBD1: warnings=0, rendered=14, confidence=0.96
  normal: [sbd1.pdf](./baseline_local_pty/sbd1.pdf)
  debug: [sbd1.debug.pdf](./baseline_local_pty/sbd1.debug.pdf)
- SBD4: warnings=0, rendered=5, confidence=0.96
  normal: [sbd4.pdf](./baseline_local_pty/sbd4.pdf)
  debug: [sbd4.debug.pdf](./baseline_local_pty/sbd4.debug.pdf)

### Short Name Micro Supplier
- Scenario ID: `short_name_micro_supplier`
- Purpose: Verifies short-value alignment and no over-centering for compact company names.
- Pack: [pack.pdf](./short_name_micro_supplier/pack.pdf)
- Debug Pack: [pack.debug.pdf](./short_name_micro_supplier/pack.debug.pdf)
- SBD1: warnings=0, rendered=13, confidence=0.95
  normal: [sbd1.pdf](./short_name_micro_supplier/sbd1.pdf)
  debug: [sbd1.debug.pdf](./short_name_micro_supplier/sbd1.debug.pdf)
- SBD4: warnings=0, rendered=5, confidence=0.96
  normal: [sbd4.pdf](./short_name_micro_supplier/sbd4.pdf)
  debug: [sbd4.debug.pdf](./short_name_micro_supplier/sbd4.debug.pdf)

### Long Legal Name Enterprise
- Scenario ID: `long_legal_name_enterprise`
- Purpose: Exercises adaptive scaling for long legal names and long-but-local procurement identities.
- Pack: [pack.pdf](./long_legal_name_enterprise/pack.pdf)
- Debug Pack: [pack.debug.pdf](./long_legal_name_enterprise/pack.debug.pdf)
- SBD1: warnings=0, rendered=14, confidence=0.96
  normal: [sbd1.pdf](./long_legal_name_enterprise/sbd1.pdf)
  debug: [sbd1.debug.pdf](./long_legal_name_enterprise/sbd1.debug.pdf)
- SBD4: warnings=0, rendered=5, confidence=0.96
  normal: [sbd4.pdf](./long_legal_name_enterprise/sbd4.pdf)
  debug: [sbd4.debug.pdf](./long_legal_name_enterprise/sbd4.debug.pdf)

### Foreign Supplier Edge Case
- Scenario ID: `foreign_supplier_edge_case`
- Purpose: Validates foreign-supplier checkbox polarity and non-PTY company-type behavior.
- Pack: [pack.pdf](./foreign_supplier_edge_case/pack.pdf)
- Debug Pack: [pack.debug.pdf](./foreign_supplier_edge_case/pack.debug.pdf)
- SBD1: warnings=2, rendered=12, confidence=0.93
  normal: [sbd1.pdf](./foreign_supplier_edge_case/sbd1.pdf)
  debug: [sbd1.debug.pdf](./foreign_supplier_edge_case/sbd1.debug.pdf)
- SBD4: warnings=0, rendered=5, confidence=0.96
  normal: [sbd4.pdf](./foreign_supplier_edge_case/sbd4.pdf)
  debug: [sbd4.debug.pdf](./foreign_supplier_edge_case/sbd4.debug.pdf)

### Signature Overflow Stress
- Scenario ID: `signature_overflow_stress`
- Purpose: Pushes signature name and role lengths to test deterministic scaling in SBD1 and SBD4 signature zones.
- Pack: [pack.pdf](./signature_overflow_stress/pack.pdf)
- Debug Pack: [pack.debug.pdf](./signature_overflow_stress/pack.debug.pdf)
- SBD1: warnings=0, rendered=14, confidence=0.96
  normal: [sbd1.pdf](./signature_overflow_stress/sbd1.pdf)
  debug: [sbd1.debug.pdf](./signature_overflow_stress/sbd1.debug.pdf)
- SBD4: warnings=0, rendered=5, confidence=0.96
  normal: [sbd4.pdf](./signature_overflow_stress/sbd4.pdf)
  debug: [sbd4.debug.pdf](./signature_overflow_stress/sbd4.debug.pdf)

### Address Overflow Stress
- Scenario ID: `address_overflow_stress`
- Purpose: Stresses multiline wrapping, line-height discipline, and max-line handling for postal and street addresses.
- Pack: [pack.pdf](./address_overflow_stress/pack.pdf)
- Debug Pack: [pack.debug.pdf](./address_overflow_stress/pack.debug.pdf)
- SBD1: warnings=0, rendered=14, confidence=0.96
  normal: [sbd1.pdf](./address_overflow_stress/sbd1.pdf)
  debug: [sbd1.debug.pdf](./address_overflow_stress/sbd1.debug.pdf)
- SBD4: warnings=0, rendered=5, confidence=0.96
  normal: [sbd4.pdf](./address_overflow_stress/sbd4.pdf)
  debug: [sbd4.debug.pdf](./address_overflow_stress/sbd4.debug.pdf)

## Alignment Review

| Field | Pages | X Spread | Y Spread | Overflow | Fallback |
| --- | --- | ---: | ---: | ---: | ---: |
| `SBD1.bbbee_status` | 1 | 0 | 0 | 0 | 0 |
| `SBD1.company_name` | 1 | 0 | 0 | 0 | 0 |
| `SBD1.csd_number` | 1 | 0 | 0 | 0 | 0 |
| `SBD1.date` | 1 | 0 | 0 | 0 | 0 |
| `SBD1.email` | 1 | 0 | 0 | 0 | 0 |
| `SBD1.foreign_supplier_no` | 1 | 0 | 0 | 0 | 0 |
| `SBD1.foreign_supplier_yes` | 1 | 0 | 0 | 0 | 0 |
| `SBD1.postal_address` | 1 | 0 | 4.87 | 0 | 0 |
| `SBD1.registration_number` | 1 | 0 | 0 | 0 | 0 |
| `SBD1.signature_name` | 1 | 0 | 0 | 0 | 0 |
| `SBD1.street_address` | 1 | 0 | 0.64 | 0 | 0 |
| `SBD1.supplier_type_pty_ltd` | 1 | 0 | 0 | 0 | 0 |
| `SBD1.tax_pin` | 1 | 0 | 0 | 0 | 0 |
| `SBD1.telephone` | 1 | 0 | 0 | 0 | 0 |
| `SBD1.vat_number` | 1 | 0 | 0 | 0 | 0 |
| `SBD4.company_name` | 1 | 0 | 0.39 | 0 | 0 |
| `SBD4.director_name` | 2 | 0 | 0 | 0 | 0 |
| `SBD4.relationship_declaration` | 2 | 0 | 0 | 0 | 0 |
| `SBD4.signature_name` | 4 | 0 | 0 | 0 | 0 |
| `SBD4.signature_role` | 2 | 0 | 4.87 | 0 | 0 |

## Calibrated Field Coverage

### SBD1 (sbd1-sa-v1)
| Field | Rendered | Overflow | Fallback | Validation Warnings |
| --- | ---: | ---: | ---: | ---: |
| `SBD1.company_name` | 6 | 0 | 0 | 0 |
| `SBD1.postal_address` | 6 | 0 | 0 | 0 |
| `SBD1.street_address` | 6 | 0 | 0 | 0 |
| `SBD1.telephone` | 6 | 0 | 0 | 0 |
| `SBD1.email` | 6 | 0 | 0 | 0 |
| `SBD1.registration_number` | 6 | 0 | 0 | 0 |
| `SBD1.vat_number` | 6 | 0 | 0 | 0 |
| `SBD1.tax_pin` | 6 | 0 | 0 | 0 |
| `SBD1.csd_number` | 6 | 0 | 0 | 0 |
| `SBD1.bbbee_status` | 5 | 0 | 1 | 0 |
| `SBD1.foreign_supplier_yes` | 1 | 0 | 0 | 0 |
| `SBD1.foreign_supplier_no` | 5 | 0 | 0 | 0 |
| `SBD1.supplier_type_pty_ltd` | 4 | 0 | 0 | 0 |
| `SBD1.date` | 6 | 0 | 0 | 0 |

### SBD4 (sbd4-sa-v1)
| Field | Rendered | Overflow | Fallback | Validation Warnings |
| --- | ---: | ---: | ---: | ---: |
| `SBD4.company_name` | 6 | 0 | 0 | 0 |
| `SBD4.director_name` | 6 | 0 | 0 | 0 |
| `SBD4.relationship_declaration` | 6 | 0 | 0 | 0 |
| `SBD4.signature_name` | 6 | 0 | 0 | 0 |
| `SBD4.signature_role` | 6 | 0 | 0 | 0 |

## Human QA Checklist
- Open each `pack.debug.pdf` first and confirm every calibrated field sits inside its red box.
- Compare `pack.pdf` against `pack.debug.pdf` to confirm debug overlays are the only visual delta.
- Check long legal names, long postal/street addresses, and long signatory roles for readable scaling rather than drift.
- Verify foreign-supplier and PTY checkbox states across local and foreign scenarios.
- Confirm SBD4 signature-name and signature-role alignment across baseline and stress scenarios.
- Review any field with non-zero overflow or fallback counts before production sign-off.