import { describe, expect, it } from "vitest";
import { BUILTIN_BIBLES, BUILTIN_STUDY_RESOURCES, DEFAULT_BIBLE_IDS, builtinBibleById } from "./builtins";

describe("built-in study library", () => {
  it("starts with four public-domain translations led by Korean", () => {
    expect(BUILTIN_BIBLES).toHaveLength(4);
    expect(BUILTIN_BIBLES[0].id).toBe("builtin-kor1910");
    expect(BUILTIN_BIBLES.every((library) => library.license === "Public Domain")).toBe(true);
    expect(DEFAULT_BIBLE_IDS).toEqual(BUILTIN_BIBLES.map((library) => library.id));
  });

  it("includes Hebrew and Greek parsing resources", () => {
    expect(BUILTIN_STUDY_RESOURCES.map((resource) => resource.id)).toEqual([
      "builtin-hebrew-morph",
      "builtin-greek-morph",
    ]);
    expect(builtinBibleById("builtin-web")?.dataId).toBe("web");
  });
});
