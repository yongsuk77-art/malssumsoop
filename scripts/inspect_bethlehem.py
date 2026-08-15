from __future__ import annotations

import os
import sqlite3
import sys
from pathlib import Path


def shortened(value: object) -> object:
    if isinstance(value, bytes):
        return f"<blob {len(value)}>"
    if isinstance(value, str) and len(value) > 180:
        return value[:180] + "…"
    return value


def inspect(path: Path) -> None:
    print(f"\n=== {path.name} ===")
    uri = path.resolve().as_uri() + "?mode=ro&immutable=1"
    try:
        connection = sqlite3.connect(uri, uri=True)
        objects = connection.execute(
            "SELECT name, type, sql FROM sqlite_master "
            "WHERE type IN ('table', 'view', 'index') ORDER BY type, name"
        ).fetchall()
        for name, object_type, sql in objects:
            print(object_type, name, (sql or "")[:1000])

        for name, object_type, _ in objects:
            if object_type != "table":
                continue
            quoted = '"' + name.replace('"', '""') + '"'
            count = connection.execute(f"SELECT count(*) FROM {quoted}").fetchone()[0]
            cursor = connection.execute(f"SELECT * FROM {quoted} LIMIT 2")
            columns = [description[0] for description in cursor.description]
            rows = [[shortened(value) for value in row] for row in cursor.fetchall()]
            print("SAMPLE", name, "count=", count, "cols=", columns, "rows=", rows)
            if name == "Bible":
                verse_rows = connection.execute(
                    "SELECT book, chapter, verse, btext FROM Bible "
                    "WHERE (book = 1 AND chapter = 1 AND verse = 1) "
                    "OR (book = 19 AND chapter = 23 AND verse = 1) "
                    "OR (book = 40 AND chapter = 1 AND verse = 1) "
                    "OR (book = 43 AND chapter = 1 AND verse = 1) "
                    "ORDER BY book"
                ).fetchall()
                print("KEY_VERSES", [[shortened(value) for value in row] for row in verse_rows])
            if name == "Lexicon":
                lexical_rows = connection.execute(
                    "SELECT scode, dtext FROM Lexicon "
                    "WHERE scode IN ('H1219', 'H7225', 'G3056') ORDER BY scode"
                ).fetchall()
                print("KEY_LEXEMES", [[shortened(value) for value in row] for row in lexical_rows])
        connection.close()
    except Exception as exc:  # Diagnostic utility: report every source independently.
        print("ERROR", type(exc).__name__, str(exc))


if __name__ == "__main__":
    for argument in sys.argv[1:]:
        inspect(Path(os.path.expandvars(argument)))
