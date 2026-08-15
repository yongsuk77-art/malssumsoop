import type { BibleVerse, MorphVerse, MorphWord } from "../types";
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

export async function loadWebChapter(bookId: string, chapter: number): Promise<BibleVerse[]> {
  const dataPromise = bibleCache.get(bookId) ?? loadJson<BibleBookData>(`/data/bibles/web/${bookId}.json`);
  bibleCache.set(bookId, dataPromise);
  const data = await dataPromise;
  return Object.entries(data.chapters[String(chapter)] || {}).map(([verse, text]) => ({
    verse: Number(verse),
    text: legacyHtmlToText(text),
  }));
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
