import { z } from "zod";

export const PresetSchema = z.object({
  mods: z.array(z.string()),
  engine: z.string().optional(),
});

export type Preset = z.infer<typeof PresetSchema>;
export type PresetMap = Record<string, Preset>;

/**
 * Parse presets.json. Invalid entries are dropped with a console error rather
 * than failing the whole file, so one hand-edited mistake can't hide every
 * preset.
 */
export function parsePresets(raw: unknown): PresetMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    console.error("[presets] presets.json is not an object:", raw);
    return {};
  }
  const out: PresetMap = {};
  for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
    const parsed = PresetSchema.safeParse(value);
    if (parsed.success) out[name] = parsed.data;
    else console.error(`[presets] Invalid preset "${name}":`, parsed.error.issues);
  }
  return out;
}

/** File name of an engine path, for display ("uzdoom.exe"). */
export function engineLabel(path: string | null | undefined): string {
  if (!path) return "";
  return path.split(/[\\/]/).pop() ?? path;
}
