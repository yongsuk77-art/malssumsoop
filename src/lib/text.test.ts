import { describe, expect, it } from "vitest";
import { normalizeStrong, stripStrongTags, strongCodes, taggedSegments } from "./text";

describe("Bethlehem Strong tags", () => {
  const sample = "태초에<WH7225> 하나님이<WH430> 천지를 창조하시니라<WH1254>";

  it("extracts and normalizes codes", () => {
    expect(strongCodes(sample)).toEqual(["H7225", "H430", "H1254"]);
    expect(normalizeStrong("g03056")).toBe("G3056");
  });

  it("strips tags and keeps visible text", () => {
    expect(stripStrongTags(sample)).toBe("태초에 하나님이 천지를 창조하시니라");
  });

  it("associates each tag with its preceding visible segment", () => {
    expect(taggedSegments(sample)[0]).toEqual({ text: "태초에", codes: ["H7225"] });
  });
});
