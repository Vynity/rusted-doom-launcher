/**
 * Load-order guess for files in a mod pack folder. Pack authors usually number
 * their files: "(0)Core.zip", "(1.2)Addon.pk3", "2. Patch.pk3", "10_Lights.pk3".
 * Numbered files sort numerically (so 10 comes after 9), "(+)" files ("load
 * anywhere") go after the numbered ones, and unnumbered files go last, A-Z.
 */
export function packOrderKey(name: string): [number, number, string] {
  const lower = name.toLowerCase();
  const plus = /^\(\+\)/.exec(name);
  if (plus) return [1, 0, lower];
  const num = /^\(?\s*(\d+(?:\.\d+)?)\s*[).\-_ ]/.exec(name);
  if (num) return [0, parseFloat(num[1]), lower];
  return [2, 0, lower];
}

export function sortPackFiles<T extends { name: string }>(files: T[]): T[] {
  return files.toSorted((a, b) => {
    const ka = packOrderKey(a.name);
    const kb = packOrderKey(b.name);
    return ka[0] - kb[0] || ka[1] - kb[1] || ka[2].localeCompare(kb[2]);
  });
}

/** Default pack title from a folder path: its last segment. */
export function titleFromFolder(path: string): string {
  return path.replace(/[\\/]+$/, "").split(/[\\/]/).pop() ?? "";
}
