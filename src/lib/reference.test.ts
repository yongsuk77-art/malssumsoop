import { describe, expect, it } from "vitest";
import { formatReference, parseReference } from "./reference";

const current = { book: 1, chapter: 1, verse: 1 };

describe("Bible reference parsing", () => {
  it("parses Korean, short English, and numeric references", () => {
    expect(parseReference("요한복음 3:16", current)).toEqual({ book: 43, chapter: 3, verse: 16 });
    expect(parseReference("Gen 2:7", current)).toEqual({ book: 1, chapter: 2, verse: 7 });
    expect(parseReference("3:16", { book: 43, chapter: 1, verse: 1 })).toEqual({ book: 43, chapter: 3, verse: 16 });
  });

  it("rejects chapters beyond the book", () => {
    expect(parseReference("유다서 2:1", current)).toBeNull();
  });

  it("formats a Korean reference", () => {
    expect(formatReference({ book: 19, chapter: 23, verse: 1 })).toBe("시편 23:1");
  });
});
