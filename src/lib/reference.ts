import { BOOKS, type BibleBook } from "../data/books";

export type Reference = { book: number; chapter: number; verse: number };

const aliases: [string, BibleBook][] = BOOKS.flatMap((book) => [book.ko, book.short, book.en, book.id]
  .map((alias): [string, BibleBook] => [alias.toLowerCase().replace(/\s/g, ""), book]))
  .sort((a, b) => b[0].length - a[0].length);

export function parseReference(input: string, current: Reference): Reference | null {
  const compact = input.trim().toLowerCase().replace(/\s/g, "");
  if (!compact) return null;
  const found = aliases.find(([alias]) => compact.startsWith(alias));
  const book = found?.[1] ?? BOOKS[current.book - 1];
  const numeric = found ? compact.slice(found[0].length) : compact;
  const numbers = numeric.match(/\d+/g)?.map(Number) || [];
  if (found && numbers.length === 0) return { book: book.number, chapter: 1, verse: 1 };
  if (numbers.length >= 2) return validate({ book: book.number, chapter: numbers[0], verse: numbers[1] });
  if (numbers.length === 1 && found) return validate({ book: book.number, chapter: numbers[0], verse: 1 });
  if (numbers.length === 1 && /[:.]/.test(numeric)) return validate({ book: current.book, chapter: numbers[0], verse: 1 });
  if (numbers.length === 1) return validate({ ...current, verse: numbers[0] });
  return null;
}

function validate(reference: Reference): Reference | null {
  const book = BOOKS[reference.book - 1];
  if (!book || reference.chapter < 1 || reference.chapter > book.chapters || reference.verse < 1) return null;
  return reference;
}

export function formatReference(reference: Reference): string {
  const book = BOOKS[reference.book - 1];
  return `${book?.ko || ""} ${reference.chapter}:${reference.verse}`;
}
