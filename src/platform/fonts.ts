import { invoke } from "@tauri-apps/api/core";
import type { SystemFont } from "../features/settings/fonts";

/** The font families installed on the system, sorted by name. */
export function listSystemFonts(): Promise<SystemFont[]> {
  return invoke<SystemFont[]>("list_fonts");
}
