/**
 * Virtual try-on: overlay (default), hosted Replicate, or Python sidecar.
 * Never log user or product image payloads.
 */

export type VtoMode = "overlay" | "hosted" | "python";

export interface VirtualTryOnRequest {
  userPhoto: string;
  productImage: string;
  productName: string;
}

export interface VirtualTryOnResponse {
  resultImage: string;
  success: boolean;
  message?: string;
  mode: VtoMode;
}

export function resolveVtoProvider(): VtoMode {
  const raw = (process.env.VTO_PROVIDER || "overlay").toLowerCase().trim();
  if (raw === "hosted" || raw === "python" || raw === "overlay") return raw;
  return "overlay";
}

export function hostedVtoConfigured(): boolean {
  return Boolean(process.env.REPLICATE_API_TOKEN);
}

function stripDataUrl(value: string): string {
  const trimmed = value.trim();
  const comma = trimmed.indexOf(",");
  if (trimmed.startsWith("data:") && comma !== -1) {
    return trimmed.slice(comma + 1);
  }
  return trimmed.replace(/\s/g, "");
}

function inferGarmentCategory(productName: string): "upper_body" | "lower_body" | "dresses" {
  const n = productName.toLowerCase();
  if (/\b(dress|gown|romper|jumpsuit)\b/.test(n)) return "dresses";
  if (/\b(pant|trouser|jean|skirt|short|legging)\b/.test(n)) return "lower_body";
  return "upper_body";
}

async function overlayTryOn(
  userPhoto: string,
  productImage: string
): Promise<string> {
  const sharp = (await import("sharp")).default;
  const userBuf = Buffer.from(stripDataUrl(userPhoto), "base64");
  const productBuf = Buffer.from(stripDataUrl(productImage), "base64");
  const meta = await sharp(userBuf).metadata();
  const width = meta.width || 512;
  const height = meta.height || 512;

  const fadedGarment = await sharp(productBuf)
    .resize(width, height, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  const composed = await sharp(userBuf)
    .composite([{ input: fadedGarment, blend: "over", opacity: 0.35 }])
    .png()
    .toBuffer();

  return composed.toString("base64");
}

async function pythonTryOn(request: VirtualTryOnRequest): Promise<VirtualTryOnResponse> {
  const pythonServiceUrl = process.env.PYTHON_SERVICE_URL;
  if (!pythonServiceUrl) {
    throw new Error(
      "VTO_PROVIDER=python but PYTHON_SERVICE_URL is not set. Run `npm run docker:vto` or switch to overlay (default)."
    );
  }

  const response = await fetch(`${pythonServiceUrl.replace(/\/$/, "")}/virtual-try-on`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_photo: stripDataUrl(request.userPhoto),
      product_image: stripDataUrl(request.productImage),
      product_name: request.productName,
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Python try-on service error (${response.status}): ${errorText.slice(0, 200)}`);
  }

  const data = (await response.json()) as { result_image?: string; message?: string };
  if (!data.result_image) {
    throw new Error("Python try-on service did not return result_image");
  }

  return {
    resultImage: stripDataUrl(data.result_image),
    success: true,
    message: data.message || "Demo overlay from Python sidecar.",
    mode: "python",
  };
}

/** Latest cuuupid/idm-vton version. Community models must use POST /v1/predictions + version. */
const DEFAULT_IDM_VTON_VERSION =
  "0513734a452173b8173e907e3a59d19a36266e55b48528559432bd21c7d7e985";

function replicateErrorMessage(
  status: number,
  payload: { error?: string; detail?: unknown; title?: string }
): string {
  const detail =
    typeof payload.detail === "string"
      ? payload.detail
      : payload.detail
        ? JSON.stringify(payload.detail)
        : "";
  const parts = [payload.error, payload.title, detail].filter(Boolean);
  const hint =
    status === 401 || status === 403
      ? " Check REPLICATE_API_TOKEN."
      : status === 404
        ? " Community models need a version hash (docs/VTO.md)."
        : " See docs/VTO.md.";
  return `Hosted try-on failed (${status})${parts.length ? `: ${parts.join(" — ")}` : "."}${hint}`;
}

function resolveReplicateVersion(): string {
  const raw = (process.env.VTO_REPLICATE_MODEL || "").trim();
  if (!raw || raw === "cuuupid/idm-vton") return DEFAULT_IDM_VTON_VERSION;
  const colon = raw.lastIndexOf(":");
  if (colon !== -1) return raw.slice(colon + 1);
  if (/^[a-f0-9]{64}$/i.test(raw)) return raw;
  return DEFAULT_IDM_VTON_VERSION;
}

async function hostedTryOn(request: VirtualTryOnRequest): Promise<VirtualTryOnResponse> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    throw new Error(
      "VTO_PROVIDER=hosted but REPLICATE_API_TOKEN is missing. Add the token or set VTO_PROVIDER=overlay for Demo."
    );
  }

  const version = resolveReplicateVersion();
  const category = inferGarmentCategory(request.productName);
  const human = `data:image/png;base64,${stripDataUrl(request.userPhoto)}`;
  const garm = `data:image/png;base64,${stripDataUrl(request.productImage)}`;

  const create = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "wait=60",
    },
    body: JSON.stringify({
      version,
      input: {
        human_img: human,
        garm_img: garm,
        garment_des: request.productName || "garment",
        category,
        crop: true,
      },
    }),
    signal: AbortSignal.timeout(90000),
  });

  const payload = (await create.json()) as {
    output?: string | string[];
    error?: string;
    detail?: unknown;
    title?: string;
    status?: string;
    urls?: { get?: string };
  };

  if (!create.ok) {
    throw new Error(replicateErrorMessage(create.status, payload));
  }

  let output = payload.output;
  if (!output && payload.urls?.get && payload.status !== "succeeded") {
    output = await pollReplicate(payload.urls.get, token);
  }

  const imageUrl = Array.isArray(output) ? output[0] : output;
  if (!imageUrl || typeof imageUrl !== "string") {
    throw new Error(payload.error || "Hosted try-on returned no image. Try again or use Demo overlay.");
  }

  const resultImage = imageUrl.startsWith("data:")
    ? stripDataUrl(imageUrl)
    : await urlToBase64(imageUrl);

  return {
    resultImage,
    success: true,
    message: "Live try-on (hosted). Photo was sent to the configured provider.",
    mode: "hosted",
  };
}

async function pollReplicate(url: string, token: string): Promise<string | string[] | undefined> {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    });
    const body = (await res.json()) as {
      status?: string;
      output?: string | string[];
      error?: string;
    };
    if (body.status === "succeeded") return body.output;
    if (body.status === "failed" || body.status === "canceled") {
      throw new Error(body.error || "Hosted try-on failed.");
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("Hosted try-on timed out. Try a smaller photo or retry.");
}

async function urlToBase64(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error("Could not download hosted try-on result.");
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.toString("base64");
}

export async function processVirtualTryOn(
  request: VirtualTryOnRequest
): Promise<VirtualTryOnResponse> {
  const mode = resolveVtoProvider();

  try {
    if (mode === "hosted") {
      return await hostedTryOn(request);
    }
    if (mode === "python") {
      return await pythonTryOn(request);
    }

    const resultImage = await overlayTryOn(request.userPhoto, request.productImage);
    return {
      resultImage,
      success: true,
      message: "Demo overlay — not a production garment fit.",
      mode: "overlay",
    };
  } catch (error) {
    const err = error as { name?: string; message?: string };
    if (err?.name === "TimeoutError" || err?.name === "AbortError") {
      throw new Error(
        mode === "hosted"
          ? "Hosted try-on timed out. Retry, or set VTO_PROVIDER=overlay for Demo."
          : "Try-on timed out. Please try again."
      );
    }
    throw error;
  }
}
