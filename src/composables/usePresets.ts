import { computed, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { useLibrary } from "./useLibrary";
import { useSettings } from "./useSettings";
import { parsePresets, type Preset, type PresetMap } from "../lib/presets";

// Singleton state, shared by every caller (mirrors useCustomWads).
const presets = ref<PresetMap>({});
const loaded = ref(false);

/**
 * Named mod presets: an ordered list of active mod slugs plus, optionally,
 * the engine to switch to. Stored in {library}/presets.json, the same file
 * the rdl_preset.py helper script reads and writes.
 */
export function usePresets() {
  const { base } = useLibrary();
  const { settings, setActiveMods, setGZDoomPath } = useSettings();

  async function loadPresets() {
    const raw = await invoke<unknown>("read_presets", { libraryPath: base() });
    presets.value = parsePresets(raw);
    loaded.value = true;
  }

  async function persist() {
    await invoke("write_presets", { libraryPath: base(), presets: presets.value });
  }

  /** Save the current active mods (and optionally the current engine) under a name. */
  async function savePreset(name: string, withEngine: boolean) {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Give the preset a name.");
    const preset: Preset = { mods: [...settings.value.activeMods] };
    if (withEngine && settings.value.gzdoomPath) preset.engine = settings.value.gzdoomPath;
    presets.value = { ...presets.value, [trimmed]: preset };
    await persist();
  }

  /**
   * Make a preset the current setup. Mods that aren't installed any more are
   * skipped and returned so the caller can tell the user.
   */
  async function applyPreset(name: string, isUsable: (slug: string) => boolean): Promise<string[]> {
    const preset = presets.value[name];
    if (!preset) throw new Error(`No preset named "${name}".`);
    const usable = preset.mods.filter(isUsable);
    const skipped = preset.mods.filter(s => !isUsable(s));
    await setActiveMods(usable);
    if (preset.engine) await setGZDoomPath(preset.engine);
    return skipped;
  }

  async function renamePreset(from: string, to: string) {
    const target = to.trim();
    if (!target) throw new Error("Give the preset a name.");
    if (target === from) return;
    if (presets.value[target]) throw new Error(`A preset named "${target}" already exists.`);
    const next: PresetMap = {};
    for (const [k, v] of Object.entries(presets.value)) next[k === from ? target : k] = v;
    presets.value = next;
    await persist();
  }

  async function deletePreset(name: string) {
    const next = { ...presets.value };
    delete next[name];
    presets.value = next;
    await persist();
  }

  /** Name of the preset matching the current mods (and engine, if it sets one). */
  const currentPresetName = computed<string | null>(() => {
    const mods = settings.value.activeMods;
    for (const [name, p] of Object.entries(presets.value)) {
      const sameMods = p.mods.length === mods.length && p.mods.every((s, i) => s === mods[i]);
      const sameEngine = !p.engine || p.engine === settings.value.gzdoomPath;
      if (sameMods && sameEngine) return name;
    }
    return null;
  });

  return { presets, loaded, loadPresets, savePreset, applyPreset, renamePreset, deletePreset, currentPresetName };
}
