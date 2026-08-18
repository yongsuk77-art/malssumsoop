import fs from "node:fs";
import path from "node:path";

const [, , input, outputId, source, license = "Public Domain"] = process.argv;

if (!input || !outputId || !source) {
  throw new Error("사용법: node scripts/build_vpl_bible.mjs <vpl.txt> <output-id> <source> [license]");
}

const bookIds = {
  GEN: "gen", EXO: "exo", LEV: "lev", NUM: "num", DEU: "deu", JOS: "jos", JDG: "jdg", RUT: "rut",
  "1SA": "1sa", "2SA": "2sa", "1KI": "1ki", "2KI": "2ki", "1CH": "1ch", "2CH": "2ch",
  EZR: "ezr", NEH: "neh", EST: "est", JOB: "job", PSA: "psa", PRO: "pro", ECC: "ecc", SOL: "sng",
  ISA: "isa", JER: "jer", LAM: "lam", EZE: "ezk", DAN: "dan", HOS: "hos", JOE: "jol", AMO: "amo",
  OBA: "oba", JON: "jon", MIC: "mic", NAH: "nah", HAB: "hab", ZEP: "zep", HAG: "hag", ZEC: "zec",
  MAL: "mal", MAT: "mat", MAR: "mrk", LUK: "luk", JOH: "jhn", ACT: "act", ROM: "rom", "1CO": "1co",
  "2CO": "2co", GAL: "gal", EPH: "eph", PHI: "php", COL: "col", "1TH": "1th", "2TH": "2th",
  "1TI": "1ti", "2TI": "2ti", TIT: "tit", PHM: "phm", HEB: "heb", JAM: "jas", "1PE": "1pe",
  "2PE": "2pe", "1JO": "1jn", "2JO": "2jn", "3JO": "3jn", JUD: "jud", REV: "rev",
};

const books = Object.fromEntries(Object.values(bookIds).map((id) => [id, {}]));
const lines = fs.readFileSync(path.resolve(input), "utf8").replace(/^\uFEFF/, "").split(/\r?\n/);
let verseCount = 0;

for (const line of lines) {
  if (!line.trim()) continue;
  const match = line.match(/^(\S+)\s+(\d+):(\d+)\s+(.*)$/);
  if (!match) throw new Error(`VPL 행을 해석하지 못했습니다: ${line.slice(0, 100)}`);
  const [, sourceBook, chapter, verse, text] = match;
  const bookId = bookIds[sourceBook];
  if (!bookId) throw new Error(`알 수 없는 책 코드입니다: ${sourceBook}`);
  books[bookId][chapter] ||= {};
  books[bookId][chapter][verse] = text.trim();
  verseCount += 1;
}

const output = path.join(process.cwd(), "public", "data", "bibles", outputId);
fs.mkdirSync(output, { recursive: true });
for (const [bookId, chapters] of Object.entries(books)) {
  fs.writeFileSync(path.join(output, `${bookId}.json`), JSON.stringify({ source, license, chapters }));
}

console.log(`Generated ${Object.keys(books).length} books and ${verseCount} verses for ${source}.`);
