import { describe, expect, it } from "vitest";
import { mirrorCandidates } from "./mirrors";

describe("mirrorCandidates", () => {
  it("keeps the catalog URL first and adds the other idgames mirrors", () => {
    const url = "https://youfailit.net/pub/idgames/levels/doom2/megawads/d2twid.zip";
    expect(mirrorCandidates(url)).toEqual([
      url,
      "https://ftpmirror1.infania.net/pub/idgames/levels/doom2/megawads/d2twid.zip",
      "http://ftp.fu-berlin.de/pc/games/idgames/levels/doom2/megawads/d2twid.zip",
    ]);
  });

  it("adds every mirror for an idgames URL on an unlisted host", () => {
    const url = "https://www.gamers.org/pub/idgames/levels/doom2/a.zip";
    const got = mirrorCandidates(url);
    expect(got[0]).toBe(url);
    expect(got).toHaveLength(4);
  });

  it("leaves non-idgames URLs alone", () => {
    const url = "https://archive.org/download/x/y.wad";
    expect(mirrorCandidates(url)).toEqual([url]);
  });
});
