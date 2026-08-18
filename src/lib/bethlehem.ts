import initSqlJs, { type Database, type SqlJsStatic, type SqlValue } from "sql.js";
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import type { BibleVerse, Hymn, LibraryKind, LibraryMeta, LibraryStored, SearchResult } from "../types";
import { getLibrary, removeLibrary as removeStoredLibrary, saveLibrary } from "./storage";
import { legacyHtmlToText, normalizeStrong, stripStrongTags } from "./text";

const MAX_FILE_SIZE = 90 * 1024 * 1024;
const FILE_READ_TIMEOUT = 45_000;
const STORAGE_TIMEOUT = 60_000;
const databaseCache = new Map<string, Database>();
let sqlPromise: Promise<SqlJsStatic> | undefined;

function sql(): Promise<SqlJsStatic> {
  sqlPromise ??= initSqlJs({ locateFile: () => sqlWasmUrl });
  return sqlPromise;
}

function within<T>(promise: Promise<T>, milliseconds: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), milliseconds);
    promise.then(
      (value) => { window.clearTimeout(timer); resolve(value); },
      (error) => { window.clearTimeout(timer); reject(error); },
    );
  });
}

function extensionOf(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() || "";
}

function cleanName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "").replace(/^\d{1,2}/, "").trim();
}

function tableNames(database: Database): Set<string> {
  const result = database.exec("SELECT name FROM sqlite_master WHERE type = 'table'")[0];
  return new Set((result?.values || []).map((row) => String(row[0]).toLowerCase()));
}

function detectKind(fileName: string, tables: Set<string>): LibraryKind {
  const extension = extensionOf(fileName);
  if (tables.has("lexicon")) return "lexicon";
  if (tables.has("hymnal")) return "hymnal";
  if (!tables.has("bible")) throw new Error("지원하는 베들레헴 DB 테이블을 찾지 못했습니다.");
  if (extension === "sdb") return "strong-bible";
  if (extension === "cdb") return "commentary";
  if (/BHS|SBL|Stp|LXX|원문|헬라|히브리/i.test(fileName)) return "original";
  return "bible";
}

export async function importBethlehemFile(file: File, onProgress?: (stage: string) => void): Promise<LibraryMeta> {
  const extension = extensionOf(file.name);
  if (!["bdb", "sdb", "cdb", "dct", "hdb"].includes(extension)) {
    throw new Error(`${file.name}: 지원하지 않는 확장자입니다.`);
  }
  if (file.size > MAX_FILE_SIZE) throw new Error(`${file.name}: 90MB보다 큰 파일은 가져올 수 없습니다.`);
  onProgress?.("파일 읽는 중");
  const bytes = await within(file.arrayBuffer(), FILE_READ_TIMEOUT, `${file.name}: 파일을 읽는 시간이 너무 오래 걸립니다.`);
  onProgress?.("데이터베이스 확인 중");
  const SQL = await within(sql(), FILE_READ_TIMEOUT, "성경 자료 처리기를 시작하지 못했습니다. 페이지를 새로고침해 주세요.");
  let database: Database | undefined;
  try {
    database = new SQL.Database(new Uint8Array(bytes));
    const kind = detectKind(file.name, tableNames(database));
    const library: LibraryStored = {
      id: crypto.randomUUID(),
      name: cleanName(file.name),
      fileName: file.name,
      extension,
      kind,
      size: file.size,
      importedAt: new Date().toISOString(),
      bytes,
    };
    onProgress?.("이 기기에 저장 중");
    await within(saveLibrary(library), STORAGE_TIMEOUT, `${file.name}: 브라우저 저장이 완료되지 않았습니다.`);
    databaseCache.set(library.id, database);
    database = undefined;
    const { bytes: _bytes, ...meta } = library;
    return meta;
  } catch (error) {
    database?.close();
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      throw new Error(`${file.name}: 브라우저 저장 공간이 부족합니다. 사용하지 않는 자료를 지운 뒤 다시 시도해 주세요.`);
    }
    throw error instanceof Error ? error : new Error(`${file.name}: 파일을 읽지 못했습니다.`);
  }
}

async function openDatabase(id: string): Promise<Database> {
  const cached = databaseCache.get(id);
  if (cached) return cached;
  const library = await getLibrary(id);
  if (!library) throw new Error("가져온 자료를 찾을 수 없습니다.");
  const SQL = await sql();
  const database = new SQL.Database(new Uint8Array(library.bytes));
  databaseCache.set(id, database);
  return database;
}

function rows(database: Database, query: string, parameters: SqlValue[] = []): SqlValue[][] {
  const statement = database.prepare(query);
  try {
    statement.bind(parameters);
    const values: SqlValue[][] = [];
    while (statement.step()) values.push(statement.get());
    return values;
  } finally {
    statement.free();
  }
}

export async function queryChapter(library: LibraryMeta, book: number, chapter: number): Promise<BibleVerse[]> {
  const result = rows(
    await openDatabase(library.id),
    "SELECT verse, btext FROM Bible WHERE book = ? AND chapter = ? ORDER BY verse",
    [book, chapter],
  );
  return result.map(([verse, text]) => ({
    verse: Number(verse),
    text: library.kind === "commentary" ? legacyHtmlToText(String(text ?? "")) : stripStrongTags(String(text ?? "")),
  }));
}

export async function queryTaggedVerse(libraryId: string, book: number, chapter: number, verse: number): Promise<string> {
  const result = rows(
    await openDatabase(libraryId),
    "SELECT btext FROM Bible WHERE book = ? AND chapter = ? AND verse = ? LIMIT 1",
    [book, chapter, verse],
  );
  return String(result[0]?.[0] ?? "");
}

export async function queryLexicon(libraryId: string, code: string): Promise<string> {
  const normalized = normalizeStrong(code);
  const result = rows(
    await openDatabase(libraryId),
    "SELECT dtext FROM Lexicon WHERE upper(scode) = ? LIMIT 1",
    [normalized],
  );
  return result[0] ? legacyHtmlToText(String(result[0][0] ?? "")) : "";
}

export async function searchBible(library: LibraryMeta, term: string, limit = 80): Promise<SearchResult[]> {
  const result = rows(
    await openDatabase(library.id),
    "SELECT book, chapter, verse, btext FROM Bible WHERE btext LIKE ? ORDER BY book, chapter, verse LIMIT ?",
    [`%${term}%`, limit],
  );
  return result.map(([book, chapter, verse, text]) => ({
    book: Number(book),
    chapter: Number(chapter),
    verse: Number(verse),
    text: stripStrongTags(legacyHtmlToText(String(text ?? ""))),
    libraryId: library.id,
    libraryName: library.name,
  }));
}

export async function queryHymns(libraryId: string, term = "", limit = 120): Promise<Hymn[]> {
  const result = rows(
    await openDatabase(libraryId),
    "SELECT chapter, title, htext FROM hymnal WHERE title LIKE ? OR htext LIKE ? ORDER BY chapter LIMIT ?",
    [`%${term}%`, `%${term}%`, limit],
  );
  return result.map(([number, title, text]) => ({
    number: Number(number),
    title: String(title ?? ""),
    text: legacyHtmlToText(String(text ?? "")),
  }));
}

export async function deleteLibrary(id: string): Promise<void> {
  databaseCache.get(id)?.close();
  databaseCache.delete(id);
  await removeStoredLibrary(id);
}
