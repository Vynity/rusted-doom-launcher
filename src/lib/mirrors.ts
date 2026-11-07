// Public idgames mirrors that share the same /idgames/ directory tree.
export const IDGAMES_MIRRORS = [
  "https://youfailit.net/pub/idgames/",
  "https://ftpmirror1.infania.net/pub/idgames/",
  "http://ftp.fu-berlin.de/pc/games/idgames/",
];

/**
 * Download URLs to try, in order: the catalog URL first, then the same file on
 * every other idgames mirror. Non-idgames URLs are returned unchanged.
 */
export function mirrorCandidates(url: string): string[] {
  const marker = "/idgames/";
  const at = url.indexOf(marker);
  if (at === -1) return [url];
  const path = url.slice(at + marker.length);
  return [url, ...IDGAMES_MIRRORS.map(m => m + path).filter(u => u !== url)];
}
