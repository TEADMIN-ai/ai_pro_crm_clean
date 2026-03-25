import { readFile } from "node:fs/promises";
import path from "node:path";
import { SBD1_TEMPLATE_PATH } from "./constants";

export async function loadSbd1OverlayTemplate(): Promise<Uint8Array | null> {
  try {
    const resolvedPath = path.join(process.cwd(), "public", SBD1_TEMPLATE_PATH.replace(/^[\\/]+/, ""));
    return new Uint8Array(await readFile(resolvedPath));
  } catch (error) {
    console.error("SBD1 overlay template load failed", {
      templatePath: SBD1_TEMPLATE_PATH,
      error,
    });
    return null;
  }
}
