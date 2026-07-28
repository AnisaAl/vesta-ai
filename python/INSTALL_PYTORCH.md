# Installing PyTorch for Kolors (Optional)

The Kolors library requires PyTorch, but installation can be tricky. Here's how to install it correctly:

## Quick Install (CPU-only, easiest)

If you just want to test the service without GPU:

```bash
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
```

## GPU Install (CUDA)

### Step 1: Check your CUDA version
```bash
nvidia-smi  # Check CUDA version
```

### Step 2: Install matching PyTorch version

**For CUDA 11.8:**
```bash
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118
```

**For CUDA 12.1:**
```bash
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
```

**For CUDA 12.4:**
```bash
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124
```

### Step 3: Install xformers (optional, for optimization)
```bash
pip install xformers
```

### Step 4: Install triton (optional, for GPU acceleration)
Triton is usually installed automatically with PyTorch 2.0+, but if needed:
```bash
pip install triton
```

## Troubleshooting

### Issue: "No module named 'triton'"
- **Solution**: Triton is only needed for GPU acceleration. You can skip it for CPU-only mode.
- Or install: `pip install triton`

### Issue: "CUDA out of memory" or CUDA version mismatch
- **Solution**: Install the PyTorch version that matches your CUDA version (see Step 2 above)
- Or use CPU-only version if you don't have a compatible GPU

### Issue: xformers installation fails
- **Solution**: xformers is optional. Skip it if installation fails.
- The service will work without it, just slower.

### Issue: Package conflicts
- **Solution**: Create a fresh virtual environment:
  ```bash
  python3 -m venv venv
  source venv/bin/activate
  pip install --upgrade pip
  pip install torch torchvision
  ```

## Recommended Installation Order

1. **First, install basic dependencies:**
   ```bash
   pip install -r requirements-simple.txt
   ```

2. **Then, install PyTorch (choose one):**
   - CPU-only: `pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu`
   - GPU (CUDA 11.8): `pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118`

3. **Finally, install optional optimizations:**
   ```bash
   pip install xformers  # Optional
   pip install triton    # Optional, usually auto-installed
   ```

## For Replit/Cloud Environments

If you're in a cloud environment without GPU:
- Use CPU-only PyTorch: `pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu`
- Skip triton and xformers (they're GPU-specific)
- The demo service will work fine without these
