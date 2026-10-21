# Installing PyTorch for optional Kolors (later)

Only needed if you wire local Kolors into the Python sidecar. Demo try-on does **not** need this — see [docs/VTO.md](../docs/VTO.md) and [docs/KOLORS.md](../docs/KOLORS.md).

## Quick install (CPU-only)

```bash
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
```

## GPU (CUDA)

Check the driver CUDA version (`nvidia-smi`), then install a matching wheel, for example:

```bash
# CUDA 12.1
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
```

Optional: `xformers` / `triton` for acceleration. Skip them on CPU-only hosts.

## Order when wiring Kolors

1. `pip install -r requirements-simple.txt` (sidecar basics)
2. Install PyTorch for your target (CPU or CUDA)
3. Install Kolors deps from `Kolors/requirements.txt`, skipping duplicate torch/torchvision/xformers/triton pins
4. Follow [docs/KOLORS.md](../docs/KOLORS.md) for the service hook
