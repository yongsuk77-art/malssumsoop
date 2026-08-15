const CASES: Record<string, string> = { N: "주격", G: "속격", D: "여격", A: "대격", V: "호격" };
const NUMBERS: Record<string, string> = { S: "단수", P: "복수" };
const GENDERS: Record<string, string> = { M: "남성", F: "여성", N: "중성" };
const GREEK_POS: Record<string, string> = {
  N: "명사", V: "동사", A: "형용사", T: "관사", P: "대명사", R: "관계대명사",
  PREP: "전치사", CONJ: "접속사", ADV: "부사", PRT: "불변화사", INJ: "감탄사",
};
const TENSES: Record<string, string> = { P: "현재", I: "미완료", F: "미래", A: "부정과거", X: "완료", Y: "과거완료" };
const VOICES: Record<string, string> = { A: "능동", M: "중간", P: "수동", E: "중간/수동", D: "중간 디포넌트", O: "수동 디포넌트" };
const MOODS: Record<string, string> = { I: "직설법", S: "가정법", O: "희구법", M: "명령법", N: "부정사", P: "분사" };
const HEBREW_POS: Record<string, string> = {
  A: "형용사", C: "접속사", D: "부사", N: "명사", P: "대명사", R: "전치사", S: "접미사", T: "불변화사", V: "동사",
};
const HEBREW_STEMS: Record<string, string> = {
  q: "칼(Qal)", N: "니팔(Niphal)", p: "피엘(Piel)", P: "푸알(Pual)", h: "히필(Hiphil)", H: "호팔(Hophal)", t: "히트파엘(Hithpael)",
};
const HEBREW_ASPECTS: Record<string, string> = {
  p: "완료", q: "연속완료", i: "미완료", w: "연속미완료", h: "명령", j: "청유", v: "명령/권유", r: "분사", s: "부정사 절대", c: "부정사 연계",
};

function decodeGreek(code: string): string {
  const value = code.replace(/^robinson:/i, "");
  if (GREEK_POS[value]) return GREEK_POS[value];
  const parts = value.split("-").filter(Boolean);
  const pos = GREEK_POS[parts[0]] || parts[0];
  if (parts[0] === "V" && parts[1]) {
    const verb = parts[1];
    const details = [TENSES[verb[0]], VOICES[verb[1]], MOODS[verb[2]]].filter(Boolean);
    if (parts[2]) {
      const personNumber = parts[2];
      if (/^[123][SP]$/.test(personNumber)) details.push(`${personNumber[0]}인칭`, NUMBERS[personNumber[1]]);
      else details.push(...personNumber.split("").map((part) => CASES[part] || NUMBERS[part] || GENDERS[part]).filter(Boolean));
    }
    return [pos, ...details].join(" · ");
  }
  const grammatical = parts.slice(1).join("").split("").map((part) => CASES[part] || NUMBERS[part] || GENDERS[part]).filter(Boolean);
  return [pos, ...grammatical].join(" · ");
}

function decodeHebrewComponent(component: string): string {
  const value = component.replace(/^H/, "");
  const pos = HEBREW_POS[value[0]];
  if (!pos) return component;
  if (value[0] === "V") {
    const details = [HEBREW_STEMS[value[1]], HEBREW_ASPECTS[value[2]]].filter(Boolean);
    const remainder = value.slice(3);
    if (/^[123]/.test(remainder)) details.push(`${remainder[0]}인칭`);
    for (const character of remainder.replace(/^[123]/, "")) {
      const detail = character === "m" ? "남성" : character === "f" ? "여성" : character === "s" ? "단수" : character === "p" ? "복수" : "";
      if (detail) details.push(detail);
    }
    return [pos, ...details].join(" · ");
  }
  if (value[0] === "N") {
    const nounType: Record<string, string> = { c: "보통명사", p: "고유명사", g: "민족명사" };
    const state: Record<string, string> = { a: "절대형", c: "연계형", d: "한정형" };
    const details = [
      nounType[value[1]],
      value[2] === "m" ? "남성" : value[2] === "f" ? "여성" : value[2] === "b" ? "공성" : undefined,
      value[3] === "s" ? "단수" : value[3] === "p" ? "복수" : value[3] === "d" ? "쌍수" : undefined,
      state[value[4]],
    ].filter((detail): detail is string => Boolean(detail));
    return [pos, ...details].join(" · ");
  }
  const details: string[] = [];
  for (const character of value.slice(1)) {
    const detail = character === "m" ? "남성" : character === "f" ? "여성" : character === "s" ? "단수" : character === "p" ? "복수" : character === "a" ? "절대형" : character === "c" ? "연계형" : "";
    if (detail && !details.includes(detail)) details.push(detail);
  }
  return [pos, ...details].join(" · ");
}

export function explainMorphology(code: string): string {
  if (!code) return "형태 정보 없음";
  if (code.toLowerCase().startsWith("robinson:")) return decodeGreek(code);
  return code.split("/").map(decodeHebrewComponent).join(" + ");
}
