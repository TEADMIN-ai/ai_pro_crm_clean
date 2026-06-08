# EmpirePDF Response Compatibility Report

Generated: 2026-05-31

## UI Expected Response

The main UI path uses `requestTenderPackGeneration(...)`, which parses the response as JSON and accepts:

- `success`
- `packId`
- `downloadURL`
- `downloadUrl`
- `fileName`
- `size`
- `expiresAt`
- `deliveryMode`
- `base64`
- `missingFields`
- `warnings`
- `error`

`TenderPackGeneratorPanel` currently maps the returned payload into:

- `packId`
- `downloadURL`
- `downloadUrl`
- `fileName`
- `size`
- `expiresAt`
- `missingFields`
- `warnings`

The UI then opens `downloadURL` or `downloadUrl`. If neither exists, it downloads locally generated browser-side bytes.

## Current `/api/tender-pack/generate` Response

Response type: JSON.

Success response fields:

- `success: true`
- `base64`
- `packId`
- `downloadURL`
- `missingFields: []`
- `warnings: []`

Compatibility with current UI: Compatible.

## Existing `GET /api/tender-pack` Response

Response type: raw PDF bytes.

Headers:

- `Content-Type: application/pdf`
- `Content-Disposition`
- `X-Tender-Pack-Id`
- `X-Tender-Pack-Url`

Compatibility with current UI: Not compatible as a direct replacement.

Reason:

- The frontend helper calls `response.json()`.
- The route returns binary PDF content.
- Required UI fields are not in the JSON body.
- `downloadURL` exists only as a response header.

## Existing `GET /api/tender-pack/preview-pdf` Response

Response type: raw PDF bytes.

Headers:

- `Content-Type: application/pdf`

Compatibility with current UI: Not compatible as a direct replacement.

Reason:

- The frontend helper expects JSON.
- The route returns no `packId`, `downloadURL`, `missingFields`, or `warnings`.
- The route is preview-oriented and does not persist a tender-pack artifact.

## Compatibility Matrix

| Route | Uses EmpirePDF | Persists artifact | Response body | UI drop-in compatible |
| --- | --- | --- | --- | --- |
| `POST /api/tender-pack/generate` | No, currently simple pack | Yes | JSON | Yes |
| `GET /api/tender-pack` | Yes | Yes | PDF bytes | No |
| `GET /api/tender-pack/preview-pdf` | Yes | No | PDF bytes | No |

## Compatible Activation Options

Option A: Internal route swap, recommended.

- Keep UI calling `POST /api/tender-pack/generate`.
- Feature-flag the route to call `generateMergedPack(...)`.
- Keep JSON response unchanged.
- Lowest frontend risk.

Option B: Frontend redirects to `GET /api/tender-pack`.

- Update `requestTenderPackGeneration(...)` to fetch binary PDF or read headers.
- Update UI to handle `Blob` response and metadata headers.
- More code churn.
- Higher risk than Option A.

Option C: Add a new JSON EmpirePDF endpoint.

- Add something like `/api/tender-pack/generate-empirepdf`.
- UI chooses endpoint by flag.
- Clear separation, but adds route surface and still needs UI changes.

## Required JSON Contract for EmpirePDF Activation

If `/api/tender-pack/generate` is internally switched to EmpirePDF, it should return:

```json
{
  "success": true,
  "packId": "...",
  "downloadURL": "...",
  "downloadUrl": "...",
  "fileName": "...",
  "size": 123456,
  "expiresAt": 1234567890,
  "missingFields": [],
  "warnings": [],
  "deliveryMode": "artifact"
}
```

`base64` can be omitted if `downloadURL` is present, because the current UI opens the artifact URL first.

## Conclusion

The existing EmpirePDF routes are not response-compatible with the current button helper. The safest integration is not a frontend redirect; it is an internal implementation switch inside `/api/tender-pack/generate` while preserving the JSON response shape.
