import { describe, expect, it, vi } from "vitest";
import { engineLabel, parsePresets } from "./presets";

describe("parsePresets", () => {
  it("reads the rdl_preset.py format", () => {
    const got = parsePresets({
      "Star Wars": { mods: ["xim-star-wars"], engine: "C:\\UZDoom\\uzdoom.exe" },
      "Vanilla (no mods)": { mods: [] },
    });
    expect(got["Star Wars"]).toEqual({ mods: ["xim-star-wars"], engine: "C:\\UZDoom\\uzdoom.exe" });
    expect(got["Vanilla (no mods)"]).toEqual({ mods: [] });
  });

  it("drops invalid entries but keeps the rest", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const got = parsePresets({ good: { mods: ["a"] }, bad: { mods: "a" } });
    expect(Object.keys(got)).toEqual(["good"]);
    spy.mockRestore();
  });

  it("returns empty for non-object input", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(parsePresets([])).toEqual({});
    spy.mockRestore();
  });
});

describe("engineLabel", () => {
  it("shows the file name of Windows and Unix paths", () => {
    expect(engineLabel("C:\\UZDoom\\Windows-UZDoom-4.14.3\\uzdoom.exe")).toBe("uzdoom.exe");
    expect(engineLabel("/usr/bin/gzdoom")).toBe("gzdoom");
    expect(engineLabel(null)).toBe("");
  });
});
