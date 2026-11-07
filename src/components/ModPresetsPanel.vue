<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { confirm } from "@tauri-apps/plugin-dialog";
import { GripVertical, ChevronUp, ChevronDown, X } from "@lucide/vue";
import type { WadEntry } from "../lib/schema";
import { engineLabel } from "../lib/presets";
import { usePresets } from "../composables/usePresets";
import { useSettings } from "../composables/useSettings";
import { useDownload } from "../composables/useDownload";
import { getErrorMessage } from "../lib/errors";

const { allWads } = defineProps<{
  /** Every known entry (catalog + custom), so hidden add-ons get titles too. */
  allWads: WadEntry[];
}>();

const { presets, loaded, loadPresets, savePreset, applyPreset, renamePreset, deletePreset, currentPresetName } = usePresets();
const { settings, moveActiveMod, toggleActiveMod } = useSettings();
const { isDownloaded } = useDownload();

const errorMsg = ref("");
const notice = ref("");
const busy = ref(false);
// The preset the user last loaded/saved; stays selected while they tweak the
// mods so "Update" knows what to overwrite.
const selected = ref<string>("");
const mode = ref<"idle" | "saving" | "renaming">("idle");
const nameInput = ref("");
const includeEngine = ref(true);
const showOrder = ref(true);

const titleBySlug = computed(() => new Map(allWads.map(w => [w.slug, w.title])));
const presetNames = computed(() => Object.keys(presets.value).sort((a, b) => a.localeCompare(b)));
const activeMods = computed(() => settings.value.activeMods);
const modified = computed(() => !!selected.value && currentPresetName.value !== selected.value);
const engineName = computed(() => engineLabel(settings.value.gzdoomPath) || "no engine set");

const knownSlugs = computed(() => new Set(allWads.map(w => w.slug)));
const isUsable = (slug: string) => knownSlugs.value.has(slug) && isDownloaded(slug);

onMounted(async () => {
  try {
    if (!loaded.value) await loadPresets();
    selected.value = currentPresetName.value ?? "";
  } catch (e) {
    console.error("[presets] load failed:", e);
    errorMsg.value = getErrorMessage(e);
  }
});

// Keep the dropdown on the matching preset when the mods change elsewhere.
watch(currentPresetName, (name) => {
  if (name) selected.value = name;
});

async function run(action: () => Promise<void>) {
  errorMsg.value = "";
  notice.value = "";
  busy.value = true;
  try {
    await action();
  } catch (e) {
    console.error("[presets]", e);
    errorMsg.value = getErrorMessage(e);
  } finally {
    busy.value = false;
  }
}

function onSelect(event: Event) {
  const name = (event.target as HTMLSelectElement).value;
  if (!name) return;
  void run(async () => {
    const skipped = await applyPreset(name, isUsable);
    selected.value = name;
    const engine = presets.value[name]?.engine;
    notice.value = `Loaded "${name}"` + (engine ? ` · engine: ${engineLabel(engine)}` : "");
    if (skipped.length) {
      notice.value += `. Skipped ${skipped.length} mod(s) that aren't installed: ${skipped.map(s => titleBySlug.value.get(s) ?? s).join(", ")}`;
    }
  });
}

function startSave() {
  mode.value = "saving";
  nameInput.value = "";
  includeEngine.value = true;
}

function startRename() {
  mode.value = "renaming";
  nameInput.value = selected.value;
}

function submitName() {
  const name = nameInput.value.trim();
  void run(async () => {
    if (mode.value === "saving") {
      if (presets.value[name]) {
        const ok = await confirm(`Replace the existing preset "${name}"?`, { title: "Replace preset", kind: "warning" });
        if (!ok) return;
      }
      await savePreset(name, includeEngine.value);
      selected.value = name;
      notice.value = `Saved "${name}" with ${activeMods.value.length} mod(s).`;
    } else {
      await renamePreset(selected.value, name);
      selected.value = name;
      notice.value = `Renamed to "${name}".`;
    }
    mode.value = "idle";
  });
}

function updateSelected() {
  const name = selected.value;
  void run(async () => {
    await savePreset(name, !!presets.value[name]?.engine);
    notice.value = `Updated "${name}".`;
  });
}

function removeSelected() {
  const name = selected.value;
  void run(async () => {
    const ok = await confirm(`Delete the preset "${name}"? Your mods stay installed.`, { title: "Delete preset", kind: "warning" });
    if (!ok) return;
    await deletePreset(name);
    selected.value = "";
    notice.value = `Deleted "${name}".`;
  });
}

// Drag-to-reorder (HTML5 drag and drop) for the load-order list.
const dragFrom = ref<number | null>(null);
const dragOver = ref<number | null>(null);
function onDrop(to: number) {
  const from = dragFrom.value;
  dragFrom.value = null;
  dragOver.value = null;
  if (from === null || from === to) return;
  void run(() => moveActiveMod(from, to));
}
</script>

<template>
  <section class="mb-6 rounded-lg bg-zinc-900 p-4" data-testid="mod-presets">
    <div class="flex flex-wrap items-center gap-2">
      <label class="text-sm font-medium text-zinc-300" for="preset-select">Preset</label>
      <select
        id="preset-select"
        class="min-w-56 rounded bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-red-600"
        :value="selected"
        :disabled="busy"
        @change="onSelect"
      >
        <option value="" disabled>{{ presetNames.length ? "Choose a preset…" : "No presets yet" }}</option>
        <option v-for="name in presetNames" :key="name" :value="name">
          {{ name }}{{ presets[name].engine ? ` · ${engineLabel(presets[name].engine)}` : "" }}
        </option>
      </select>
      <span v-if="modified" class="text-xs text-amber-400" title="The active mods no longer match this preset">modified</span>

      <div class="ml-auto flex flex-wrap gap-2">
        <button class="rounded bg-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-600 disabled:opacity-40" :disabled="busy" @click="startSave">
          Save as new…
        </button>
        <button class="rounded bg-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-600 disabled:opacity-40" :disabled="busy || !modified" @click="updateSelected" title="Overwrite the selected preset with the current mods">
          Update
        </button>
        <button class="rounded bg-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-600 disabled:opacity-40" :disabled="busy || !selected" @click="startRename">
          Rename
        </button>
        <button class="rounded bg-zinc-700 px-3 py-1.5 text-sm hover:bg-red-900 hover:text-red-300 disabled:opacity-40" :disabled="busy || !selected" @click="removeSelected">
          Delete
        </button>
      </div>
    </div>

    <form v-if="mode !== 'idle'" class="mt-3 flex flex-wrap items-center gap-2" @submit.prevent="submitName">
      <input
        v-model="nameInput"
        class="min-w-64 rounded bg-zinc-800 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-red-600"
        :placeholder="mode === 'saving' ? 'Preset name' : 'New name'"
        autofocus
      />
      <label v-if="mode === 'saving'" class="flex items-center gap-1.5 text-sm text-zinc-300">
        <input v-model="includeEngine" type="checkbox" class="accent-red-600" />
        Remember engine ({{ engineName }})
      </label>
      <button type="submit" class="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-40" :disabled="busy || !nameInput.trim()">
        {{ mode === 'saving' ? 'Save' : 'Rename' }}
      </button>
      <button type="button" class="rounded px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200" @click="mode = 'idle'">Cancel</button>
    </form>

    <p class="mt-2 text-xs text-zinc-500">Engine: {{ settings.gzdoomPath ?? "not set" }}</p>
    <p v-if="notice" class="mt-2 text-sm text-green-400">{{ notice }}</p>
    <p v-if="errorMsg" class="mt-2 whitespace-pre-line text-sm text-red-400">{{ errorMsg }}</p>

    <div class="mt-4">
      <button class="text-sm font-medium text-zinc-300 hover:text-zinc-100" @click="showOrder = !showOrder">
        {{ showOrder ? "▾" : "▸" }} Load order ({{ activeMods.length }} active)
      </button>
      <p v-if="showOrder && activeMods.length === 0" class="mt-2 text-sm text-zinc-500">No mods active. Turn some on below, or load a preset.</p>
      <ol v-else-if="showOrder" class="mt-2 max-h-80 space-y-1 overflow-y-auto pr-1" data-testid="load-order">
        <li
          v-for="(slug, i) in activeMods"
          :key="slug"
          draggable="true"
          class="flex items-center gap-2 rounded bg-zinc-800 px-2 py-1 text-sm"
          :class="{ 'ring-1 ring-red-600': dragOver === i, 'opacity-50': dragFrom === i }"
          @dragstart="dragFrom = i"
          @dragover.prevent="dragOver = i"
          @dragleave="dragOver = dragOver === i ? null : dragOver"
          @drop.prevent="onDrop(i)"
          @dragend="dragFrom = null; dragOver = null"
        >
          <GripVertical :size="16" class="shrink-0 cursor-grab text-zinc-500" />
          <span class="w-6 shrink-0 text-right tabular-nums text-zinc-500">{{ i + 1 }}.</span>
          <span class="flex-1 truncate" :class="titleBySlug.get(slug) ? 'text-zinc-100' : 'text-zinc-500 italic'">
            {{ titleBySlug.get(slug) ?? `${slug} (not installed)` }}
          </span>
          <button class="rounded p-0.5 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100 disabled:opacity-30" :disabled="busy || i === 0" title="Load earlier" @click="run(() => moveActiveMod(i, i - 1))">
            <ChevronUp :size="16" />
          </button>
          <button class="rounded p-0.5 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100 disabled:opacity-30" :disabled="busy || i === activeMods.length - 1" title="Load later" @click="run(() => moveActiveMod(i, i + 1))">
            <ChevronDown :size="16" />
          </button>
          <button class="rounded p-0.5 text-zinc-400 hover:bg-red-900 hover:text-red-300" :disabled="busy" title="Turn off" @click="run(() => toggleActiveMod(slug))">
            <X :size="16" />
          </button>
        </li>
      </ol>
      <p v-if="showOrder && activeMods.length > 1" class="mt-2 text-xs text-zinc-500">Drag or use the arrows. Mods lower in the list load later and override earlier ones.</p>
    </div>
  </section>
</template>
