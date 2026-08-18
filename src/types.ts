export type LibraryKind = "bible" | "strong-bible" | "original" | "commentary" | "lexicon" | "hymnal";

export type LibraryMeta = {
  id: string;
  name: string;
  fileName: string;
  extension: string;
  kind: LibraryKind;
  size: number;
  importedAt: string;
};

export type LibraryStored = LibraryMeta & {
  bytes: ArrayBuffer;
};

export type BibleVerse = {
  verse: number;
  text: string;
};

export type SearchResult = {
  book: number;
  chapter: number;
  verse: number;
  text: string;
  libraryId: string;
  libraryName: string;
};

export type Hymn = {
  number: number;
  title: string;
  text: string;
};

export type MorphWord = {
  text: string;
  lemma: string;
  morphology: string;
  strong: string;
  gloss: string;
};

export type MorphVerse = {
  text: string;
  words: MorphWord[];
  source: string;
};

export type Insight = {
  summary: string;
  context: string;
  originalLanguage: string;
  theology: string;
  sermonBridge: string;
  application: string;
  guardrail: string;
  questions: string[];
};

export type InsightCache = {
  key: string;
  insight: Insight;
  generatedAt: string;
};

export type SermonNote = {
  id: string;
  book: number;
  chapter: number;
  verse: number;
  reference: string;
  translation: string;
  verseText: string;
  title: string;
  meditation: string;
  application: string;
  outline: string;
  prayer: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type SermonNotesBackup = {
  kind: "malssumsoop-sermon-notes";
  version: 1;
  exportedAt: string;
  notes: SermonNote[];
};
