import { BOOKS } from "../data/books";
import { builtinBibleById } from "../data/builtins";
import type { BibleVerse, MorphVerse, MorphWord, SearchResult } from "../types";
import { legacyHtmlToText } from "./text";

type CompactWord = [string, string, string, string, string];
type CompactMorphVerse = [string, CompactWord[]];
type MorphBook = {
  source: string;
  license: string;
  chapters: Record<string, Record<string, CompactMorphVerse>>;
};
type BibleBookData = {
  source: string;
  license: string;
  chapters: Record<string, Record<string, string>>;
};

const morphCache = new Map<string, Promise<MorphBook>>();
const bibleCache = new Map<string, Promise<BibleBookData>>();

async function loadJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) throw new Error("공개 성경 자료를 불러오지 못했습니다.");
  return response.json() as Promise<T>;
}

function loadBibleBook(libraryId: string, bookId: string): Promise<BibleBookData> {
  const library = builtinBibleById(libraryId);
  if (!library) return Promise.reject(new Error("기본 성경 자료를 찾지 못했습니다."));
  const cacheKey = `${library.dataId}/${bookId}`;
  const dataPromise = bibleCache.get(cacheKey) ?? loadJson<BibleBookData>(`/data/bibles/${library.dataId}/${bookId}.json`);
  bibleCache.set(cacheKey, dataPromise);
  return dataPromise;
}

export async function loadBuiltinChapter(libraryId: string, bookId: string, chapter: number): Promise<BibleVerse[]> {
  const data = await loadBibleBook(libraryId, bookId);
  return Object.entries(data.chapters[String(chapter)] || {}).map(([verse, text]) => ({
    verse: Number(verse),
    text: legacyHtmlToText(text),
  }));
}

export async function searchBuiltinBible(libraryId: string, term: string, limit = 80): Promise<SearchResult[]> {
  const library = builtinBibleById(libraryId);
  if (!library) throw new Error("검색할 기본 성경 자료를 찾지 못했습니다.");
  const needle = term.toLocaleLowerCase();
  const results: SearchResult[] = [];
  const books = await Promise.all(BOOKS.map(async (book) => ({
    book,
    data: await loadBibleBook(libraryId, book.id),
  })));
  for (const { book, data } of books) {
    for (const [chapter, verses] of Object.entries(data.chapters)) {
      for (const [verse, rawText] of Object.entries(verses)) {
        const text = legacyHtmlToText(rawText);
        if (!text.toLocaleLowerCase().includes(needle)) continue;
        results.push({
          book: book.number,
          chapter: Number(chapter),
          verse: Number(verse),
          text,
          libraryId,
          libraryName: library.name,
        });
        if (results.length >= limit) return results;
      }
    }
  }
  return results;
}

export async function loadMorphVerse(bookId: string, chapter: number, verse: number): Promise<MorphVerse | undefined> {
  const dataPromise = morphCache.get(bookId) ?? loadJson<MorphBook>(`/data/morph/${bookId}.json`);
  morphCache.set(bookId, dataPromise);
  const data = await dataPromise;
  const compact = data.chapters[String(chapter)]?.[String(verse)];
  if (!compact) return undefined;
  const words: MorphWord[] = compact[1].map(([text, lemma, morphology, strong, gloss]) => ({
    text,
    lemma,
    morphology,
    strong,
    gloss,
  }));
  return { text: compact[0], words, source: data.source };
}
