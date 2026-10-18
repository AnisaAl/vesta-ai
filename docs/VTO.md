# Virtual try-on (ops)

Try-on is **Demo overlay by default**. You do not need Python or Kolors weights for the button to work.

## Default — overlay (free)

No extra env. `POST /api/virtual-try-on` composites the garment onto the photo in Node and labels the UI **Demo**.

## Live — hosted (per request)

Not a dedicated GPU. Set:

```env
VTO_PROVIDER=hosted
REPLICATE_API_TOKEN=r8_...
# optional — version hash, or cuuupid/idm-vton[:hash]
# VTO_REPLICATE_MODEL=cuuupid/idm-vton
```

`cuuupid/idm-vton` is a **community** model. Live try-on calls `POST /v1/predictions` with a pinned version hash (not `/v1/models/.../predictions`, which 404s). Override with `VTO_REPLICATE_MODEL` set to a 64-character version id from [the model versions page](https://replicate.com/cuuupid/idm-vton/versions).

Create a token at [replicate.com/account/api-tokens](https://replicate.com/account/api-tokens) (it starts with `r8_`). Put both lines in `.env`. Do not commit `.env`.

- Host `npm run dev`: restart the process so it reloads `.env`.
- Docker `api`: Compose now forwards `VTO_PROVIDER` and `REPLICATE_API_TOKEN` from `.env`. Recreate the container (`docker compose --profile full up -d api`). Rebuild is not required for env-only changes. The app still listens on **port 3000**.

The dialog shows **Live try-on** and discloses that the photo is sent to Replicate. Default model `cuuupid/idm-vton` is **non-commercial / research** — use another model via `VTO_REPLICATE_MODEL` if you need commercial terms. Hosted try-on is billed per Replicate run.

## Optional — Python sidecar

Same overlay as Node, plus a hook if you later wire local weights (gitignored `Kolors/` is not required):

```bash
npm run docker:vto
```

```env
VTO_PROVIDER=python
PYTHON_SERVICE_URL=http://localhost:8000
```

Do not clone Kolors into git. Do not bake weights into the API image.

## API

- `GET /api/health` — `vtoProvider`, `vtoHostedConfigured`
- `POST /api/virtual-try-on` — `{ userPhoto, productImage, productName }` → `{ resultImage, success, message, mode }`
