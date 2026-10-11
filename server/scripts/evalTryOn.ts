/**
 * Overlay try-on smoke (no Replicate, no Python, no Claude).
 * Usage: npm run eval:tryon
 */

import sharp from "sharp";
import { processVirtualTryOn, resolveVtoProvider } from "../services/virtualTryOn";

async function tinyPng(color: { r: number; g: number; b: number }): Promise<string> {
  const buf = await sharp({
    create: {
      width: 32,
      height: 32,
      channels: 3,
      background: color,
    },
  })
    .png()
    .toBuffer();
  return buf.toString("base64");
}

async function run(): Promise<number> {
  const provider = resolveVtoProvider();
  if (provider !== "overlay") {
    console.log(
      `SKIP  eval:tryon overlay — VTO_PROVIDER=${provider} (unset it to test Demo overlay)`
    );
    return 0;
  }

  const userPhoto = await tinyPng({ r: 200, g: 180, b: 160 });
  const productImage = await tinyPng({ r: 20, g: 40, b: 120 });
  const result = await processVirtualTryOn({
    userPhoto,
    productImage,
    productName: "navy dress",
  });

  const ok =
    result.success &&
    result.mode === "overlay" &&
    typeof result.resultImage === "string" &&
    result.resultImage.length > 80;

  console.log(
    ok
      ? `PASS  overlay-tryon — mode=${result.mode} bytes=${result.resultImage.length}`
      : `FAIL  overlay-tryon — mode=${result.mode} success=${result.success}`
  );
  return ok ? 0 : 1;
}

process.exit(await run());
