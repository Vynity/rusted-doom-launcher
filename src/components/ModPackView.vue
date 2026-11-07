<script setup lang="ts">
import { computed, ref } from "vue";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { FolderOpen, FilePlus, GripVertical, ChevronUp, ChevronDown, X } from "@lucide/vue";
import { useModPackImport, type PackFile } from "../composables/useModPackImport";
import { sortPackFiles, titleFromFolder } from "../lib/modpack";
import { formatBytes } from "../lib/format";
import { getErrorMessage } from "../lib/errors";

const emit = defineEmits<{ cancel: []; added: [] }>();

const { listFolder, importPack } = useModPackImport();

const files = ref<PackFile[]>([]);
const title = ref("");
const author = ref("");
const copyToLibrary = ref(false);
const busy = ref(false);
const errorMsg = ref("");

const totalSize = computed(() => files.value.reduce((n, f) => n + f.size, 0));

function addFiles(incoming: PackFile[]) {
  const seen = new Set(files.value.map(f => f.path.toLowerCase()));
  const fresh = incoming.filter(f => !seen.has(f.path.toLowerCase()));
  files.value = sortPackFiles([...files.value, ...fresh]);
}

const pastedPath = ref("");

async function pickFolder() {
  errorMsg.value = "";
  try {
    const dir = await openDialog({ directory: true, multiple: false, title: "Pick the mod pack folder" });
    if (typeof dir !== "string") return;
    await loadFolder(dir);
  } catch (e) {
    console.error("[ModPack] folder pick failed:", e);
    errorMsg.value = getErrorMessage(e);
  }
}

async function loadPastedFolder() {
  errorMsg.value = "";
  const dir = pastedPath.value.trim().replace(/^"(.*)"$/, "$1");
  if (!dir) return;
  try {
    await loadFolder(dir);
    pastedPath.value = "";
  } catch (e) {
    console.error("[ModPack] folder load failed:", e);
    errorMsg.value = getErrorMessage(e);
  }
}

async function loadFolder(dir: string) {
  const found = await listFolder(dir);
  if (found.length === 0) {
    errorMsg.value = `No .wad, .pk3, .pk7 or .zip files directly inside ${dir}.`;
    return;
  }
  addFiles(found);
  if (!title.value) title.value = titleFromFolder(dir);
}

async function pickFiles() {
  errorMsg.value = "";
  try {
    const picked = await openDialog({
      multiple: true,
      title: "Pick the mod files",
      filters: [{ name: "Doom mod files", extensions: ["wad", "pk3", "pk7", "zip"] }],
    });
    const paths = Array.isArray(picked) ? picked : picked ? [picked] : [];
    if (paths.length === 0) return;
    // Sizes come from listing each file's folder; files elsewhere still work with size 0.
    const byDir = new Map<string, string[]>();
    for (const p of paths) {
      const dir = p.replace(/[\\/][^\\/]+$/, "");
      byDir.set(dir, [...(byDir.get(dir) ?? []), p.toLowerCase()]);
    }
    const listed: PackFile[] = [];
    for (const [dir, wanted] of byDir) {
      for (const f of await listFolder(dir)) if (wanted.includes(f.path.toLowerCase())) listed.push(f);
    }
    addFiles(listed);
  } catch (e) {
    console.error("[ModPack] file pick failed:", e);
    errorMsg.value = getErrorMessage(e);
  }
}

function move(from: number, to: number) {
  if (to < 0 || to >= files.value.length) return;
  const list = [...files.value];
  const [f] = list.splice(from, 1);
  list.splice(to, 0, f);
  files.value = list;
}

const dragFrom = ref<number | null>(null);
const dragOver = ref<number | null>(null);
function onDrop(to: number) {
  if (dragFrom.value !== null) move(dragFrom.value, to);
  dragFrom.value = null;
  dragOver.value = null;
}

async function submit() {
  errorMsg.value = "";
  busy.value = true;
  try {
    await importPack({ title: title.value, author: author.value, files: files.value, copyToLibrary: copyToLibrary.value });
    emit("added");
  } catch (e) {
    console.error("[ModPack] import failed:", e);
    errorMsg.value = getErrorMessage(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl" data-testid="mod-pack-view">
    <h1 class="mb-1 text-2xl font-bold">Add mod pack</h1>
    <p class="mb-6 text-sm text-zinc-400">
      Several files that always load together, in a fixed order, as one entry in the Mods tab.
      Numbered files like <code class="text-zinc-300">(1)Addon.pk3</code> are ordered automatically.
    </p>

    <div class="mb-4 flex gap-2">
      <button class="flex items-center gap-2 rounded bg-zinc-700 px-3 py-2 text-sm hover:bg-zinc-600 disabled:opacity-40" :disabled="busy" @click="pickFolder">
        <FolderOpen :size="16" /> Pick a folder
      </button>
      <button class="flex items-center gap-2 rounded bg-zinc-700 px-3 py-2 text-sm hover:bg-zinc-600 disabled:opacity-40" :disabled="busy" @click="pickFiles">
        <FilePlus :size="16" /> Add files
      </button>
    </div>
    <form class="mb-4 flex gap-2" @submit.prevent="loadPastedFolder">
      <input
        v-model="pastedPath"
        data-testid="pack-folder-path"
        class="flex-1 rounded bg-zinc-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-600"
        placeholder="…or paste a folder path, e.g. from File Explorer's address bar"
      />
      <button type="submit" class="rounded bg-zinc-700 px-3 py-2 text-sm hover:bg-zinc-600 disabled:opacity-40" :disabled="busy || !pastedPath.trim()">Load folder</button>
    </form>

    <ol v-if="files.length" class="mb-2 space-y-1" data-testid="pack-files">
      <li
        v-for="(f, i) in files"
        :key="f.path"
        draggable="true"
        class="flex items-center gap-2 rounded bg-zinc-800 px-2 py-1.5 text-sm"
        :class="{ 'ring-1 ring-red-600': dragOver === i, 'opacity-50': dragFrom === i }"
        @dragstart="dragFrom = i"
        @dragover.prevent="dragOver = i"
        @drop.prevent="onDrop(i)"
        @dragend="dragFrom = null; dragOver = null"
      >
        <GripVertical :size="16" class="shrink-0 cursor-grab text-zinc-500" />
        <span class="w-6 shrink-0 text-right tabular-nums text-zinc-500">{{ i + 1 }}.</span>
        <span class="flex-1 truncate" :title="f.path">{{ f.name }}</span>
        <span class="shrink-0 text-xs text-zinc-500">{{ formatBytes(f.size) }}</span>
        <button class="rounded p-0.5 text-zinc-400 hover:bg-zinc-700 disabled:opacity-30" :disabled="i === 0" title="Load earlier" @click="move(i, i - 1)"><ChevronUp :size="16" /></button>
        <button class="rounded p-0.5 text-zinc-400 hover:bg-zinc-700 disabled:opacity-30" :disabled="i === files.length - 1" title="Load later" @click="move(i, i + 1)"><ChevronDown :size="16" /></button>
        <button class="rounded p-0.5 text-zinc-400 hover:bg-red-900 hover:text-red-300" title="Leave out" @click="files.splice(i, 1)"><X :size="16" /></button>
      </li>
    </ol>
    <p v-if="files.length" class="mb-6 text-xs text-zinc-500">
      {{ files.length }} file(s), {{ formatBytes(totalSize) }}. Files lower in the list load later and override earlier ones.
    </p>
    <p v-else class="mb-6 rounded bg-zinc-900 p-4 text-sm text-zinc-500">No files yet.</p>

    <div class="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
      <label class="block text-sm">
        <span class="mb-1 block text-zinc-300">Title</span>
        <input v-model="title" class="w-full rounded bg-zinc-800 px-3 py-2 outline-none focus:ring-2 focus:ring-red-600" placeholder="Project Brutality full pack" />
      </label>
      <label class="block text-sm">
        <span class="mb-1 block text-zinc-300">Author (optional)</span>
        <input v-model="author" class="w-full rounded bg-zinc-800 px-3 py-2 outline-none focus:ring-2 focus:ring-red-600" />
      </label>
    </div>

    <label class="mb-6 flex items-start gap-2 text-sm text-zinc-300">
      <input v-model="copyToLibrary" type="checkbox" class="mt-0.5 accent-red-600" />
      <span>
        Copy the files into the library folder
        <span class="block text-xs text-zinc-500">
          Off: the files are used where they are, so keep that folder in place. On: copies are made
          ({{ formatBytes(totalSize) }}) and removed again if you delete the pack.
        </span>
      </span>
    </label>

    <p v-if="errorMsg" class="mb-4 whitespace-pre-line rounded bg-red-900/50 p-3 text-sm text-red-200">{{ errorMsg }}</p>

    <div class="flex gap-2">
      <button
        class="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-40"
        :disabled="busy || files.length === 0 || !title.trim()"
        @click="submit"
      >{{ busy ? (copyToLibrary ? "Copying…" : "Adding…") : "Add mod pack" }}</button>
      <button class="rounded px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200" :disabled="busy" @click="emit('cancel')">Cancel</button>
    </div>
  </div>
</template>
