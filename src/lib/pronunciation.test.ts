import { describe, expect, it } from "vitest";
import { koreanPronunciation } from "./pronunciation";

describe("Korean original-language pronunciation", () => {
  it("renders representative Hebrew words as readable Korean phonetics", () => {
    expect(koreanPronunciation("בְּרֵאשִׁ֖ית", "hebrew")).toBe("베레쉬트");
    expect(koreanPronunciation("בָּרָ֣א", "hebrew")).toBe("바라");
    expect(koreanPronunciation("אֱלֹהִ֑ים", "hebrew")).toBe("엘로힘");
    expect(koreanPronunciation("הַשָּׁמַ֖יִם", "hebrew")).toBe("하샤마임");
    expect(koreanPronunciation("הָאָֽרֶץ", "hebrew")).toBe("하아레츠");
  });

  it("uses the conventional Korean reading for the divine name", () => {
    expect(koreanPronunciation("יְהוָה", "hebrew")).toBe("여호와");
  });

  it("renders representative Koine Greek words as readable Korean phonetics", () => {
    expect(koreanPronunciation("Ἐν", "greek")).toBe("엔");
    expect(koreanPronunciation("ἀρχῇ", "greek")).toBe("아르케");
    expect(koreanPronunciation("λόγος", "greek")).toBe("로고스");
    expect(koreanPronunciation("θεός", "greek")).toBe("테오스");
    expect(koreanPronunciation("Ἰησοῦς", "greek")).toBe("이에수스");
    expect(koreanPronunciation("Χριστός", "greek")).toBe("크리스토스");
  });
});
