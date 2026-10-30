# Kolors virtual try-on (future)

**Status:** not required for Demo or Live try-on today. Do not clone weights into the repo or bake them into the API image.

Today’s paths (see [VTO.md](VTO.md)):

| Mode | When to use |
|------|-------------|
| `overlay` (default) | Always-on Demo composite in Node (`sharp`) |
| `hosted` | Production-ish garment-on-person via Replicate IDM-VTON |
| `python` | Optional sidecar; same overlay quality unless Kolors is wired |

## What Kolors would add later

Kwai Kolors (or a similar local diffusion VTO stack) would run **on a GPU machine or dedicated sidecar**, taking a person photo + garment image and returning a full try-on render. It is an alternative to hosted Replicate when you want:

- No per-request third-party photo egress
- Lower marginal cost at high volume (after GPU CapEx)
- Offline / air-gapped demos

## Suggested implementation shape (when scheduled)

1. **Keep the boundary.** All try-on still enters through `POST /api/virtual-try-on` → `server/services/virtualTryOn.ts`. Add a provider value such as `VTO_PROVIDER=kolors` (or extend `python`) rather than calling Kolors from the React client.
2. **Sidecar only.** Clone Kolors **outside** git (`Kolors/` is gitignored). Mount weights on the `vto` Compose service; never into the Node API image.
3. **Python hook.** Replace the overlay blend in `python/virtual_try_on_service.py` with a real `model.try_on(person, garment)` call. Keep request/response JSON stable (`user_photo`, `product_image`, `result_image`).
4. **Deps.** Install PyTorch for the target CUDA (or CPU for smoke only) per `python/INSTALL_PYTORCH.md`, then Kolors `requirements.txt` **excluding** duplicate torch/torchvision/xformers/triton pins.
5. **Health.** Sidecar `/health` should report `mode: kolors` vs `mode: overlay` so `GET /api/health` / Debugger can tell Demo from local Live.
6. **Eval.** Extend `npm run eval:tryon` with a fixture that asserts non-overlay output only when Kolors weights are present; default CI stays on overlay.

## Do not

- Block Milestone acceptance on Kolors install
- Commit checkpoints, LoRAs, or the Kolors git tree
- Log user/garment image payloads
- Treat “Python sidecar up” as “Kolors Live” until weights are loaded and the TODO path is removed

## Pointers

- Ops matrix: [VTO.md](VTO.md)
- Optional PyTorch notes: `python/INSTALL_PYTORCH.md`
- Stub sidecar: `python/virtual_try_on_service.py`
- Node router: `server/services/virtualTryOn.ts`
