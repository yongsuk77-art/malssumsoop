import { describe, expect, it } from "vitest";
import type { SermonNote } from "../types";
import { createNotesBackup, mergeSermonNotes, parseNotesBackup, serializeNotesBackup } from "./notes";

function note(updatedAt: string, meditation: string): SermonNote {
  return {
    id: "1:1:1",
    book: 1,
    chapter: 1,
    verse: 1,
    reference: "창세기 1:1",
    translation: "개역개정",
    verseText: "태초에 하나님이 천지를 창조하시니라",
    title: "태초의 하나님",
    meditation,
    application: "",
    outline: "",
    prayer: "",
    tags: ["창조"],
    createdAt: "2026-08-18T00:00:00.000Z",
    updatedAt,
  };
}

describe("sermon note backups", () => {
  it("round-trips a versioned backup", () => {
    const original = note("2026-08-18T01:00:00.000Z", "하나님이 시작하신다.");
    expect(parseNotesBackup(serializeNotesBackup([original])).notes).toEqual([original]);
  });

  it("keeps the latest note when backups are merged", () => {
    const older = note("2026-08-18T01:00:00.000Z", "이전 묵상");
    const newer = note("2026-08-18T02:00:00.000Z", "새 묵상");
    const imported = mergeSermonNotes([older], [newer]);
    expect(imported.notes[0].meditation).toBe("새 묵상");
    expect(imported.updated).toBe(1);

    const retained = mergeSermonNotes([newer], [older]);
    expect(retained.notes[0].meditation).toBe("새 묵상");
    expect(retained.kept).toBe(1);
  });

  it("rejects unrelated JSON files", () => {
    expect(() => parseNotesBackup(JSON.stringify({ notes: [] }))).toThrow("지원하지 않는");
    expect(createNotesBackup([]).kind).toBe("malssumsoop-sermon-notes");
  });
});
