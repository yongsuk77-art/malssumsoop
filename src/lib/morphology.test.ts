import { describe, expect, it } from "vitest";
import { explainMorphology } from "./morphology";

describe("morphology explanations", () => {
  it("explains Robinson Greek verb morphology", () => {
    expect(explainMorphology("robinson:V-IAI-3S")).toBe("동사 · 미완료 · 능동 · 직설법 · 3인칭 · 단수");
  });

  it("explains Open Scriptures Hebrew compound morphology", () => {
    expect(explainMorphology("HR/Ncfsa")).toBe("전치사 + 명사 · 보통명사 · 여성 · 단수 · 절대형");
  });
});
