import { readFile } from "node:fs/promises";
import path from "node:path";

import { TORQUE_EMPIRE_BRAND_ASSETS } from "@/lib/branding/identity";

const brandRoot = path.join(process.cwd(), "assets", "corporate", "logo");

export { TORQUE_EMPIRE_BRAND_ASSETS };

export function getBrandAssetPath(fileName: string) {
  return path.join(brandRoot, fileName);
}

export async function loadBrandAssetBytes(fileName: string): Promise<Uint8Array> {
  return Uint8Array.from(await readFile(getBrandAssetPath(fileName)));
}

export function toDataUri(bytes: Uint8Array, mimeType: string) {
  return `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`;
}
