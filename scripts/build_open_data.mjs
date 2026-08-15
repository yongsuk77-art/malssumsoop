import fs from "node:fs";
import path from "node:path";
import initSqlJs from "sql.js";

const root = process.cwd();
const ohbRoot = path.join(root, ".source", "npm", "ohb", "package", "data", "openscriptures-OHB");
const greekRoot = path.join(root, ".source", "npm", "tagnt", "package", "data", "stepbible-tagnt-tr");
const outputMorph = path.join(root, "public", "data", "morph");
const outputWeb = path.join(root, "public", "data", "bibles", "web");
const webDb = path.join(root, ".source", "bethlehem-4.3.7", "베들레헴성경 4.3.7  windows", "WEB.bdb");

const sourceBooks = [
  ["gen", "Gen", "ohb"], ["exo", "Exod", "ohb"], ["lev", "Lev", "ohb"],
  ["num", "Num", "ohb"], ["deu", "Deut", "ohb"], ["jos", "Josh", "ohb"],
  ["jdg", "Judg", "ohb"], ["rut", "Ruth", "ohb"], ["1sa", "1Sam", "ohb"],
  ["2sa", "2Sam", "ohb"], ["1ki", "1Kgs", "ohb"], ["2ki", "2Kgs", "ohb"],
  ["1ch", "1Chr", "ohb"], ["2ch", "2Chr", "ohb"], ["ezr", "Ezra", "ohb"],
  ["neh", "Neh", "ohb"], ["est", "Esth", "ohb"], ["job", "Job", "ohb"],
  ["psa", "Ps", "ohb"], ["pro", "Prov", "ohb"], ["ecc", "Eccl", "ohb"],
  ["sng", "Song", "ohb"], ["isa", "Isa", "ohb"], ["jer", "Jer", "ohb"],
  ["lam", "Lam", "ohb"], ["ezk", "Ezek", "ohb"], ["dan", "Dan", "ohb"],
  ["hos", "Hos", "ohb"], ["jol", "Joel", "ohb"], ["amo", "Amos", "ohb"],
  ["oba", "Obad", "ohb"], ["jon", "Jonah", "ohb"], ["mic", "Mic", "ohb"],
  ["nah", "Nah", "ohb"], ["hab", "Hab", "ohb"], ["zep", "Zeph", "ohb"],
  ["hag", "Hag", "ohb"], ["zec", "Zech", "ohb"], ["mal", "Mal", "ohb"],
  ["mat", "Matt", "greek"], ["mrk", "Mark", "greek"], ["luk", "Luke", "greek"],
  ["jhn", "John", "greek"], ["act", "Acts", "greek"], ["rom", "Rom", "greek"],
  ["1co", "1Cor", "greek"], ["2co", "2Cor", "greek"], ["gal", "Gal", "greek"],
  ["eph", "Eph", "greek"], ["php", "Phil", "greek"], ["col", "Col", "greek"],
  ["1th", "1Thess", "greek"], ["2th", "2Thess", "greek"], ["1ti", "1Tim", "greek"],
  ["2ti", "2Tim", "greek"], ["tit", "Titus", "greek"], ["phm", "Phlm", "greek"],
  ["heb", "Heb", "greek"], ["jas", "Jas", "greek"], ["1pe", "1Pet", "greek"],
  ["2pe", "2Pet", "greek"], ["1jn", "1John", "greek"], ["2jn", "2John", "greek"],
  ["3jn", "3John", "greek"], ["jud", "Jude", "greek"], ["rev", "Rev", "greek"],
];

function numericNames(directory) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() || entry.name.endsWith(".json"))
    .map((entry) => entry.name.replace(/\.json$/, ""))
    .sort((a, b) => Number(a) - Number(b));
}

function buildMorphology() {
  fs.mkdirSync(outputMorph, { recursive: true });
  for (const [id, sourceName, sourceType] of sourceBooks) {
    const base = path.join(sourceType === "ohb" ? ohbRoot : greekRoot, sourceName);
    const chapters = {};
    for (const chapter of numericNames(base)) {
      const verses = {};
      const chapterDirectory = path.join(base, chapter);
      for (const verse of numericNames(chapterDirectory)) {
        const raw = JSON.parse(fs.readFileSync(path.join(chapterDirectory, `${verse}.json`), "utf8"));
        const words = raw.words.map((word) => [
          word.text || "",
          Array.isArray(word.lemma) ? word.lemma.join("/") : (word.lemma || ""),
          word.morph || "",
          Array.isArray(word.strongs) ? word.strongs[0] || "" : (word.strongs || ""),
          word.metadata?.gloss || word.translation || "",
        ]);
        verses[verse] = [raw.text, words];
      }
      chapters[chapter] = verses;
    }
    const data = {
      source: sourceType === "ohb" ? "Open Scriptures Hebrew Bible" : "STEPBible TAGNT-TR",
      license: "CC BY 4.0",
      chapters,
    };
    fs.writeFileSync(path.join(outputMorph, `${id}.json`), JSON.stringify(data));
  }
}

async function buildWebBible() {
  fs.mkdirSync(outputWeb, { recursive: true });
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(root, "node_modules", "sql.js", "dist", file),
  });
  const database = new SQL.Database(fs.readFileSync(webDb));
  const result = database.exec("SELECT book, chapter, verse, btext FROM Bible ORDER BY book, chapter, verse")[0];
  const books = Array.from({ length: 66 }, () => ({}));
  if (result) {
    for (const row of result.values) {
      const [book, chapter, verse, text] = row;
      const chapterKey = String(chapter);
      books[Number(book) - 1][chapterKey] ||= {};
      books[Number(book) - 1][chapterKey][String(verse)] = String(text);
    }
  }
  database.close();
  sourceBooks.forEach(([id], index) => {
    fs.writeFileSync(path.join(outputWeb, `${id}.json`), JSON.stringify({
      source: "World English Bible",
      license: "Public Domain",
      chapters: books[index],
    }));
  });
}

buildMorphology();
await buildWebBible();
console.log(`Generated ${sourceBooks.length} morphology books and ${sourceBooks.length} WEB books.`);
