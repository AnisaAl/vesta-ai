# Virtual try-on setup

Kolors is **optional** and not part of the default Demo path.

**Start here:** [docs/VTO.md](docs/VTO.md)

- Default: in-process **Demo overlay** (no Python, no tokens).
- Live: `VTO_PROVIDER=hosted` + `REPLICATE_API_TOKEN`.
- Optional sidecar: `npm run docker:vto` and `VTO_PROVIDER=python`.
- Future local Kolors weights: [docs/KOLORS.md](docs/KOLORS.md)
