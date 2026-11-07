import { invoke } from "@tauri-apps/api/core";
import { mkdir } from "@tauri-apps/plugin-fs";
import { WadEntrySchema, type WadEntry } from "../lib/schema";
import { kebab, makeUniqueSlug } from "../lib/slug";
import { useLibrary } from "./useLibrary";
import { useDownload } from "./useDownload";
import { useCustomWads } from "./useCustomWads";
import { getOs } from "../lib/platform";

export interface PackFile {
  name: string;
  path: string;
  size: number;
}

const SEP = getOs() === "win" ? "\\" : "/";

/**
 * Create one Mods-tab entry that loads several files in a fixed order.
 * copyToLibrary: copy them into {library}/{slug}/ (removed again if the mod
 * is deleted); otherwise reference them where they are (never deleted).
 */
export function useModPackImport() {
  const { base, wadFile } = useLibrary();
  const { registerSyntheticDownload } = useDownload();
  const { customWads, addCustomWad } = useCustomWads();

  async function listFolder(dir: string): Promise<PackFile[]> {
    return invoke<PackFile[]>("list_game_files", { dir });
  }

  async function importPack(opts: { title: string; author: string; files: PackFile[]; copyToLibrary: boolean }): Promise<WadEntry> {
    const { title, files, copyToLibrary } = opts;
    if (files.length === 0) throw new Error("Pick at least one file for the pack.");
    if (!base()) throw new Error("Library path is not set. Configure it in Settings first.");
    const baseSlug = kebab(title.trim());
    if (!baseSlug) throw new Error("Title must contain at least one letter or number.");
    const slug = makeUniqueSlug(baseSlug, new Set(customWads.value.map(w => w.slug)));

    let loadList: string[];  // library-relative (copied) or absolute (in place)
    let size = 0;
    if (copyToLibrary) {
      await mkdir(wadFile(slug), { recursive: true });
      loadList = [];
      for (const f of files) {
        const rel = `${slug}${SEP}${f.name}`;
        size += await invoke<number>("import_custom_wad", { sourcePath: f.path, targetPath: wadFile(rel) });
        loadList.push(rel);
      }
    } else {
      loadList = files.map(f => f.path);
      size = files.reduce((n, f) => n + f.size, 0);
    }

    const parsed = WadEntrySchema.safeParse({
      slug,
      title: title.trim(),
      authors: [{ name: opts.author.trim() || "User import" }],
      year: new Date().getFullYear(),
      description: `Mod pack of ${files.length} file(s), loaded in order: ${files.map(f => f.name).join(", ")}`,
      iwad: "doom2",
      type: "gameplay-mod",
      sourcePort: "gzdoom",
      requires: [],
      downloads: [],
      thumbnail: "",
      screenshots: [],
      youtubeVideos: [],
      awards: [],
      tags: ["mod-pack"],
      difficulty: "unknown",
      urls: [],
      notes: "",
      extraArgs: [],
      _schemaVersion: 1,
      _source: "custom",
    });
    if (!parsed.success) {
      console.error("[useModPackImport] entry failed schema:", parsed.error.issues);
      throw new Error("Internal error: mod pack entry doesn't match schema. See console.");
    }

    const [primary, ...extras] = loadList;
    await registerSyntheticDownload(slug, {
      filename: copyToLibrary ? primary : files[0].name,
      wadFilename: copyToLibrary ? primary : files[0].name,
      size,
      externalPath: copyToLibrary ? "" : primary,
      extraFiles: extras,
    });
    await addCustomWad(parsed.data);
    return parsed.data;
  }

  return { listFolder, importPack };
}
