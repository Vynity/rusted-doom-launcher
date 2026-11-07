import { describe, expect, it } from "vitest";
import { sortPackFiles, titleFromFolder } from "./modpack";

const names = (xs: { name: string }[]) => xs.map(x => x.name);

describe("sortPackFiles", () => {
  it("follows a numbered pack's order, (+) files after, unnumbered last", () => {
    const files = [
      "(+)hitmarkers.pk3",
      "(10)Destroyable Decorations.pk3",
      "(1.2)ShieldSaw.pk3",
      "readme-extras.pk3",
      "(0)Project_Brutality-0.4.1.zip",
      "(1) PB GloryKills.pk3",
      "(1.1)Gauss.pk3",
      "(2)NeuralPack.pk3",
      "(9)Doom_Classic_PBR.pk3",
    ].map(name => ({ name }));
    expect(names(sortPackFiles(files))).toEqual([
      "(0)Project_Brutality-0.4.1.zip",
      "(1) PB GloryKills.pk3",
      "(1.1)Gauss.pk3",
      "(1.2)ShieldSaw.pk3",
      "(2)NeuralPack.pk3",
      "(9)Doom_Classic_PBR.pk3",
      "(10)Destroyable Decorations.pk3",
      "(+)hitmarkers.pk3",
      "readme-extras.pk3",
    ]);
  });

  it("understands '1.' and '2_' style numbering", () => {
    const files = ["2_Patch.pk3", "10. Lights.pk3", "1. Base.pk3"].map(name => ({ name }));
    expect(names(sortPackFiles(files))).toEqual(["1. Base.pk3", "2_Patch.pk3", "10. Lights.pk3"]);
  });
});

describe("titleFromFolder", () => {
  it("uses the last folder name", () => {
    expect(titleFromFolder("C:\\Mods\\Project Brutality Staging New\\")).toBe("Project Brutality Staging New");
    expect(titleFromFolder("/home/me/mods/pack")).toBe("pack");
  });
});
