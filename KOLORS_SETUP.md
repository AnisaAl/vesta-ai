# Virtual try-on setup

This file used to describe a required Kolors Python install. That path is **optional**.

**Start here:** [docs/VTO.md](docs/VTO.md)

- Default: in-process **Demo overlay** (no Python, no tokens).
- Live: `VTO_PROVIDER=hosted` + `REPLICATE_API_TOKEN`.
- Optional sidecar: `npm run docker:vto` and `VTO_PROVIDER=python`.
