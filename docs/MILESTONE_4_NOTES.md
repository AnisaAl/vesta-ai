# Milestone 4 — Virtual try-on

## Goal

Try-on is usable without a setup dead-end. Default is a labeled **Demo overlay** in Node (no Python, no tokens). **Live** garment-on-person when `VTO_PROVIDER=hosted` and `REPLICATE_API_TOKEN` are set (per-request Replicate IDM-VTON, not a dedicated GPU). Local Kolors weights stay optional — see [KOLORS.md](KOLORS.md).

## Providers

| `VTO_PROVIDER` | Result | Needs |
|----------------|--------|--------|
| `overlay` (default) | PIL-style blend in Node (`sharp`) | nothing |
| `hosted` | IDM-VTON on Replicate | `REPLICATE_API_TOKEN` |
| `python` | Sidecar at `PYTHON_SERVICE_URL` | `npm run docker:vto` |

Default Replicate model: `cuuupid/idm-vton` (research / non-commercial terms — override with `VTO_REPLICATE_MODEL`). Photos are not logged. Hosted path discloses third-party processing in the dialog.

## Acceptance

- No token: Try it on a chat card → Demo composite, not a setup-only error.
- Hosted + token: Live label, garment-on-person (not a 30% blend), readable timeouts.
- `npm run eval:chat` still green. Chat browse/cart/small-talk unchanged.
