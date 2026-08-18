import type { InsightCache, LibraryMeta, LibraryStored, SermonNote } from "../types";

const DATABASE_NAME = "malssumsoop";
const DATABASE_VERSION = 3;
const LIBRARIES = "libraries";
const LIBRARY_FILES = "library-files";
const INSIGHTS = "insights";
const SERMON_NOTES = "sermon-notes";

type StoredLibraryFile = {
  id: string;
  bytes: ArrayBuffer | Blob;
};

let databasePromise: Promise<IDBDatabase> | undefined;

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("브라우저 저장소 요청에 실패했습니다."));
  });
}

function database(): Promise<IDBDatabase> {
  databasePromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(LIBRARIES)) db.createObjectStore(LIBRARIES, { keyPath: "id" });
      const fileStore = db.objectStoreNames.contains(LIBRARY_FILES)
        ? request.transaction!.objectStore(LIBRARY_FILES)
        : db.createObjectStore(LIBRARY_FILES, { keyPath: "id" });
      if (!db.objectStoreNames.contains(INSIGHTS)) db.createObjectStore(INSIGHTS, { keyPath: "key" });
      if (!db.objectStoreNames.contains(SERMON_NOTES)) db.createObjectStore(SERMON_NOTES, { keyPath: "id" });
      if (event.oldVersion < 3) {
        const libraryStore = request.transaction!.objectStore(LIBRARIES);
        const cursorRequest = libraryStore.openCursor();
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (!cursor) return;
          const stored = cursor.value as LibraryStored;
          if (stored.bytes) {
            const { bytes, ...meta } = stored;
            fileStore.put({ id: stored.id, bytes } satisfies StoredLibraryFile);
            cursor.update(meta);
          }
          cursor.continue();
        };
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("브라우저 저장소를 열 수 없습니다."));
  });
  return databasePromise;
}

async function store(name: string, mode: IDBTransactionMode): Promise<IDBObjectStore> {
  const db = await database();
  return db.transaction(name, mode).objectStore(name);
}

export async function saveLibrary(library: LibraryStored): Promise<void> {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([LIBRARIES, LIBRARY_FILES], "readwrite");
    const { bytes, ...meta } = library;
    transaction.objectStore(LIBRARIES).put(meta);
    transaction.objectStore(LIBRARY_FILES).put({ id: library.id, bytes } satisfies StoredLibraryFile);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("자료를 저장하지 못했습니다."));
    transaction.onabort = () => reject(transaction.error ?? new Error("자료 저장이 취소되었습니다."));
  });
}

export async function listLibraries(): Promise<LibraryMeta[]> {
  const rows = await requestResult((await store(LIBRARIES, "readonly")).getAll() as IDBRequest<LibraryMeta[]>);
  return rows
    .sort((a, b) => a.importedAt.localeCompare(b.importedAt));
}

export async function getLibrary(id: string): Promise<LibraryStored | undefined> {
  const db = await database();
  const transaction = db.transaction([LIBRARIES, LIBRARY_FILES], "readonly");
  const [meta, storedFile] = await Promise.all([
    requestResult(transaction.objectStore(LIBRARIES).get(id) as IDBRequest<LibraryMeta | undefined>),
    requestResult(transaction.objectStore(LIBRARY_FILES).get(id) as IDBRequest<StoredLibraryFile | undefined>),
  ]);
  if (!meta || !storedFile) return undefined;
  return { ...meta, bytes: storedFile.bytes };
}

export async function removeLibrary(id: string): Promise<void> {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([LIBRARIES, LIBRARY_FILES], "readwrite");
    transaction.objectStore(LIBRARIES).delete(id);
    transaction.objectStore(LIBRARY_FILES).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("자료를 삭제하지 못했습니다."));
    transaction.onabort = () => reject(transaction.error ?? new Error("자료 삭제가 취소되었습니다."));
  });
}

export async function saveInsight(cache: InsightCache): Promise<void> {
  await requestResult((await store(INSIGHTS, "readwrite")).put(cache));
}

export async function getInsight(key: string): Promise<InsightCache | undefined> {
  return requestResult((await store(INSIGHTS, "readonly")).get(key) as IDBRequest<InsightCache | undefined>);
}

export async function saveSermonNote(note: SermonNote): Promise<void> {
  await requestResult((await store(SERMON_NOTES, "readwrite")).put(note));
}

export async function saveSermonNotes(notes: SermonNote[]): Promise<void> {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(SERMON_NOTES, "readwrite");
    const noteStore = transaction.objectStore(SERMON_NOTES);
    notes.forEach((note) => noteStore.put(note));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("설교 노트를 저장하지 못했습니다."));
    transaction.onabort = () => reject(transaction.error ?? new Error("설교 노트 저장이 취소되었습니다."));
  });
}

export async function getSermonNote(id: string): Promise<SermonNote | undefined> {
  return requestResult((await store(SERMON_NOTES, "readonly")).get(id) as IDBRequest<SermonNote | undefined>);
}

export async function listSermonNotes(): Promise<SermonNote[]> {
  const notes = await requestResult((await store(SERMON_NOTES, "readonly")).getAll() as IDBRequest<SermonNote[]>);
  return notes.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export async function removeSermonNote(id: string): Promise<void> {
  await requestResult((await store(SERMON_NOTES, "readwrite")).delete(id));
}
