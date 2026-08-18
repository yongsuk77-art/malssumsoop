import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.join(process.cwd(), "public", "data", "bibles");
const referenceFiles = fs.readdirSync(path.join(root, "web")).filter((name) => name.endsWith(".json")).sort();
const translations = ["kor1910", "web", "ylt", "asv"];

assert.equal(referenceFiles.length, 66, "The WEB reference set must contain all 66 books");

for (const translation of translations) {
  const directory = path.join(root, translation);
  const files = fs.readdirSync(directory).filter((name) => name.endsWith(".json")).sort();
  assert.deepEqual(files, referenceFiles, `${translation} must contain the same 66 books as WEB`);
  let verseCount = 0;
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(directory, file), "utf8"));
    assert.equal(typeof data.source, "string");
    assert.equal(typeof data.license, "string");
    for (const verses of Object.values(data.chapters)) verseCount += Object.keys(verses).length;
  }
  assert.ok(verseCount > 30_000, `${translation} must contain a complete Protestant canon`);
  const john = JSON.parse(fs.readFileSync(path.join(directory, "jhn.json"), "utf8"));
  assert.ok(john.chapters?.["3"]?.["16"], `${translation} must contain John 3:16`);
}

console.log("Built-in Korean, WEB, YLT, and ASV data sets are complete.");
