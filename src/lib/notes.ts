import { BOOKS } from "../data/books";
import type { SermonNote, SermonNotesBackup } from "../types";
import type { Reference } from "./reference";

export const SERMON_NOTES_BACKUP_KIND = "malssumsoop-sermon-notes" as const;
export const SERMON_NOTES_BACKUP_VERSION = 1 as const;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown, maximum: number): string {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function validDate(value: unknown): string | undefined {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return undefined;
  return new Date(value).toISOString();
}

export function sermonNoteId(reference: Reference): string {
  return `${reference.book}:${reference.chapter}:${reference.verse}`;
}

export function normalizeSermonNote(value: unknown): SermonNote | undefined {
  if (!record(value)) return undefined;
  const book = Number(value.book);
  const chapter = Number(value.chapter);
  const verse = Number(value.verse);
  const bookMeta = BOOKS[book - 1];
  if (!Number.isInteger(book) || !bookMeta || !Number.isInteger(chapter) || chapter < 1 || chapter > bookMeta.chapters || !Number.isInteger(verse) || verse < 1 || verse > 200) return undefined;

  const updatedAt = validDate(value.updatedAt);
  const createdAt = validDate(value.createdAt) || updatedAt;
  if (!updatedAt || !createdAt) return undefined;

  return {
    id: sermonNoteId({ book, chapter, verse }),
    book,
    chapter,
    verse,
    reference: cleanText(value.reference, 80) || `${bookMeta.ko} ${chapter}:${verse}`,
    translation: cleanText(value.translation, 100),
    verseText: cleanText(value.verseText, 12_000),
    title: cleanText(value.title, 300),
    meditation: cleanText(value.meditation, 30_000),
    application: cleanText(value.application, 30_000),
    outline: cleanText(value.outline, 30_000),
    prayer: cleanText(value.prayer, 20_000),
    tags: Array.isArray(value.tags)
      ? [...new Set(value.tags.map((tag) => cleanText(tag, 40)).filter(Boolean))].slice(0, 20)
      : [],
    createdAt,
    updatedAt,
  };
}

export function createNotesBackup(notes: SermonNote[], exportedAt = new Date().toISOString()): SermonNotesBackup {
  return {
    kind: SERMON_NOTES_BACKUP_KIND,
    version: SERMON_NOTES_BACKUP_VERSION,
    exportedAt,
    notes: notes.map(normalizeSermonNote).filter((note): note is SermonNote => Boolean(note)),
  };
}

export function serializeNotesBackup(notes: SermonNote[]): string {
  return JSON.stringify(createNotesBackup(notes), null, 2);
}

export function parseNotesBackup(text: string): SermonNotesBackup {
  if (text.length > 10_000_000) throw new Error("노트 백업 파일은 10MB 이하만 가져올 수 있습니다.");
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("올바른 말씀숲 노트 백업 파일이 아닙니다.");
  }
  if (!record(value) || value.kind !== SERMON_NOTES_BACKUP_KIND || value.version !== SERMON_NOTES_BACKUP_VERSION || !Array.isArray(value.notes)) {
    throw new Error("지원하지 않는 노트 백업 형식입니다.");
  }
  const notes = value.notes.map(normalizeSermonNote).filter((note): note is SermonNote => Boolean(note));
  if (value.notes.length > 0 && notes.length === 0) throw new Error("가져올 수 있는 설교 노트가 없습니다.");
  return createNotesBackup(notes, validDate(value.exportedAt) || new Date().toISOString());
}

export function mergeSermonNotes(local: SermonNote[], incoming: SermonNote[]): { notes: SermonNote[]; added: number; updated: number; kept: number } {
  const merged = new Map(local.map((note) => [note.id, note]));
  let added = 0;
  let updated = 0;
  let kept = 0;
  for (const note of incoming) {
    const current = merged.get(note.id);
    if (!current) {
      merged.set(note.id, note);
      added += 1;
    } else if (Date.parse(note.updatedAt) > Date.parse(current.updatedAt)) {
      merged.set(note.id, note);
      updated += 1;
    } else {
      kept += 1;
    }
  }
  return {
    notes: [...merged.values()].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    added,
    updated,
    kept,
  };
}

export function hasSermonNoteContent(note: Pick<SermonNote, "title" | "meditation" | "application" | "outline" | "prayer" | "tags">): boolean {
  return Boolean(note.title.trim() || note.meditation.trim() || note.application.trim() || note.outline.trim() || note.prayer.trim() || note.tags.length);
}
