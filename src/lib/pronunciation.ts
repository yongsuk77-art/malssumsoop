export type OriginalLanguage = "hebrew" | "greek";

type Phoneme = { kind: "consonant" | "vowel"; value: string };

const ONSETS: Record<string, number> = {
  g: 0, n: 2, d: 3, r: 5, l: 5, m: 6, b: 7, v: 7, f: 17, p: 17,
  s: 9, sh: 9, z: 12, ts: 14, ch: 15, kh: 15, k: 15, q: 15,
  t: 16, th: 16, ph: 17, h: 18, ng: 11, y: 11,
};
const VOWELS: Record<string, number> = { a: 0, e: 5, i: 20, o: 8, u: 13, "ü": 16, eu: 18 };
const CODAS: Record<string, number> = { n: 4, l: 8, r: 8, m: 16, ng: 21 };
const MULTI_CONSONANTS = ["sh", "ts", "th", "ph", "kh", "ch", "ng"];

function composeHangul(consonant: string, vowel: string, coda = 0): string {
  let onset = ONSETS[consonant] ?? 11;
  let medial = VOWELS[vowel] ?? VOWELS.eu;

  if (consonant === "y") {
    onset = ONSETS.ng;
    medial = { a: 2, e: 7, i: 20, o: 12, u: 17, "ü": 16, eu: 6 }[vowel] ?? medial;
  } else if (consonant === "sh") {
    medial = { a: 2, e: 7, i: 16, o: 12, u: 17, "ü": 16, eu: 17 }[vowel] ?? medial;
  }

  return String.fromCharCode(0xac00 + (onset * 21 + medial) * 28 + coda);
}

function appendCoda(output: string[], consonant: string): boolean {
  const coda = CODAS[consonant];
  const last = output.at(-1);
  if (!coda || !last) return false;
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3 || (code - 0xac00) % 28 !== 0) return false;
  output[output.length - 1] = String.fromCharCode(code + coda);
  return true;
}

function tokenizeRoman(value: string): Phoneme[] {
  const normalized = value.toLowerCase().replace(/[^a-zü]/g, "");
  const tokens: Phoneme[] = [];
  for (let index = 0; index < normalized.length;) {
    const character = normalized[index];
    if (character === "x") {
      tokens.push({ kind: "consonant", value: "k" }, { kind: "consonant", value: "s" });
      index += 1;
      continue;
    }
    if ("aeiouü".includes(character)) {
      tokens.push({ kind: "vowel", value: character });
      index += 1;
      continue;
    }
    const multi = MULTI_CONSONANTS.find((candidate) => normalized.startsWith(candidate, index));
    if (multi) {
      tokens.push({ kind: "consonant", value: multi });
      index += multi.length;
      continue;
    }
    tokens.push({ kind: "consonant", value: character });
    index += 1;
  }
  return tokens;
}

function romanToHangul(value: string): string {
  const tokens = tokenizeRoman(value);
  const vowelIndexes = tokens.flatMap((token, index) => token.kind === "vowel" ? [index] : []);
  if (!vowelIndexes.length) return "";

  const output: string[] = [];
  let cursor = 0;
  vowelIndexes.forEach((vowelIndex, vowelOrder) => {
    const consonants = tokens.slice(cursor, vowelIndex).map((token) => token.value);
    let onset = "";

    if (vowelOrder === 0) {
      consonants.slice(0, -1).forEach((consonant) => output.push(composeHangul(consonant, "eu")));
      onset = consonants.at(-1) || "";
    } else if (consonants.length === 1) {
      onset = consonants[0];
      if (onset === "l") appendCoda(output, onset);
    } else if (consonants.length > 1) {
      onset = consonants.at(-1) || "";
      consonants.slice(0, -1).forEach((consonant, index, preceding) => {
        if (index === 0 && ["m", "n", "ng", "l"].includes(consonant) && appendCoda(output, consonant)) return;
        output.push(composeHangul(consonant, "eu"));
        if (index === preceding.length - 1 && onset === "l") appendCoda(output, "l");
      });
    }

    output.push(composeHangul(onset, tokens[vowelIndex].value));
    cursor = vowelIndex + 1;
  });

  const finalConsonants = tokens.slice(cursor).map((token) => token.value);
  finalConsonants.forEach((consonant, index) => {
    if (index === 0 && ["m", "n", "ng", "l"].includes(consonant) && appendCoda(output, consonant)) return;
    if (consonant === "y") output.push(composeHangul("", "i"));
    else output.push(composeHangul(consonant, "eu"));
  });
  return output.join("");
}

const HEBREW_CONSONANTS: Record<string, string> = {
  א: "", ב: "v", ג: "g", ד: "d", ה: "h", ו: "v", ז: "z", ח: "h", ט: "t",
  י: "y", כ: "kh", ך: "kh", ל: "l", מ: "m", ם: "m", נ: "n", ן: "n", ס: "s",
  ע: "", פ: "f", ף: "f", צ: "ts", ץ: "ts", ק: "k", ר: "r", ש: "sh", ת: "t",
};
const HEBREW_VOWELS: Record<string, string> = {
  "\u05b0": "e", "\u05b1": "e", "\u05b2": "a", "\u05b3": "o", "\u05b4": "i",
  "\u05b5": "e", "\u05b6": "e", "\u05b7": "a", "\u05b8": "a", "\u05b9": "o",
  "\u05ba": "o", "\u05bb": "u", "\u05c7": "o",
};

function hebrewRomanization(text: string): string {
  const clusters = text.normalize("NFD").match(/[\u05d0-\u05ea][\u0591-\u05c7]*/gu) || [];
  if (clusters.map((cluster) => cluster[0]).join("") === "יהוה") return "yehowa";

  const result: string[] = [];
  let previousVowel = "";
  clusters.forEach((cluster, index) => {
    const base = cluster[0];
    const marks = [...cluster.slice(1)];
    const isFinal = index === clusters.length - 1;
    const hasDagesh = marks.includes("\u05bc");
    let consonant = HEBREW_CONSONANTS[base] ?? "";
    let vowel = marks.flatMap((mark) => HEBREW_VOWELS[mark] || []).at(0) || "";

    if (base === "ב" && hasDagesh) consonant = "b";
    if ((base === "כ" || base === "ך") && hasDagesh) consonant = "k";
    if ((base === "פ" || base === "ף") && hasDagesh) consonant = "p";
    if (base === "ש" && marks.includes("\u05c2")) consonant = "s";
    if (marks.includes("\u05b0") && isFinal) vowel = "";

    if (base === "ו" && (marks.includes("\u05b9") || marks.includes("\u05ba"))) {
      consonant = "";
      vowel = "o";
    } else if (base === "ו" && hasDagesh && !vowel) {
      consonant = "";
      vowel = "u";
    } else if (base === "ו" && !vowel && ["o", "u"].includes(previousVowel)) {
      consonant = "";
    }

    if (base === "י" && !vowel && ["i", "e"].includes(previousVowel)) consonant = "";
    else if (base === "י" && isFinal && !vowel && previousVowel === "a") {
      consonant = "";
      vowel = "i";
    }
    if ((base === "ה" || base === "א") && isFinal && !vowel) consonant = "";

    if (isFinal && vowel === "a" && (base === "ח" || base === "ע")) result.push(vowel, consonant);
    else result.push(consonant, vowel);
    previousVowel = vowel;
  });
  return result.join("");
}

const GREEK_LETTERS: Record<string, string> = {
  α: "a", β: "b", γ: "g", δ: "d", ε: "e", ζ: "z", η: "e", θ: "th", ι: "i",
  κ: "k", λ: "l", μ: "m", ν: "n", ξ: "ks", ο: "o", π: "p", ρ: "r", σ: "s",
  ς: "s", ϲ: "s", τ: "t", υ: "ü", φ: "ph", χ: "ch", ψ: "ps", ω: "o",
};
const GREEK_DIPHTHONGS: Record<string, string> = {
  αι: "ai", ει: "ei", οι: "oi", υι: "üi", ου: "u", αυ: "au", ευ: "eu", ηυ: "eu",
};

function greekRomanization(text: string): string {
  const clusters = text.normalize("NFD").match(/[\u0370-\u03ff][\u0300-\u036f]*/gu) || [];
  const result: string[] = [];
  for (let index = 0; index < clusters.length; index += 1) {
    const cluster = clusters[index];
    const base = cluster[0].toLowerCase();
    const next = clusters[index + 1];
    const nextBase = next?.[0].toLowerCase() || "";
    const roughBreathing = cluster.includes("\u0314") ? "h" : "";
    const diphthong = GREEK_DIPHTHONGS[base + nextBase];
    if (diphthong && !next.includes("\u0308")) {
      result.push(roughBreathing, diphthong);
      index += 1;
      continue;
    }
    if (base === "γ" && nextBase === "γ") {
      result.push("ng");
      index += 1;
      continue;
    }
    if (base === "γ" && ["κ", "ξ", "χ"].includes(nextBase)) {
      result.push("n", GREEK_LETTERS[nextBase]);
      index += 1;
      continue;
    }
    result.push(roughBreathing, GREEK_LETTERS[base] || "");
  }
  return result.join("");
}

export function koreanPronunciation(text: string, language: OriginalLanguage): string {
  if (!text.trim()) return "";
  const romanized = language === "hebrew" ? hebrewRomanization(text) : greekRomanization(text);
  const pronunciation = romanToHangul(romanized);
  if (language === "hebrew" && text.normalize("NFD").replace(/[^\u05d0-\u05ea]/gu, "") === "יהוה") return "여호와";
  return pronunciation;
}
