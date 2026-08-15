import type { InsightCache, LibraryMeta, LibraryStored } from "../types";

const DATABASE_NAME = "malssumsoop";
const DATABASE_VERSION = 1;
const LIBRARIES = "libraries";
const INSIGHTS = "insights";

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
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(LIBRARIES)) db.createObjectStore(LIBRARIES, { keyPath: "id" });
      if (!db.objectStoreNames.contains(INSIGHTS)) db.createObjectStore(INSIGHTS, { keyPath: "key" });
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
  await requestResult((await store(LIBRARIES, "readwrite")).put(library));
}

export async function listLibraries(): Promise<LibraryMeta[]> {
  const rows = await requestResult((await store(LIBRARIES, "readonly")).getAll() as IDBRequest<LibraryStored[]>);
  return rows
    .map(({ bytes: _bytes, ...meta }) => meta)
    .sort((a, b) => a.importedAt.localeCompare(b.importedAt));
}

export async function getLibrary(id: string): Promise<LibraryStored | undefined> {
  return requestResult((await store(LIBRARIES, "readonly")).get(id) as IDBRequest<LibraryStored | undefined>);
}

export async function removeLibrary(id: string): Promise<void> {
  await requestResult((await store(LIBRARIES, "readwrite")).delete(id));
}

export async function saveInsight(cache: InsightCache): Promise<void> {
  await requestResult((await store(INSIGHTS, "readwrite")).put(cache));
}

export async function getInsight(key: string): Promise<InsightCache | undefined> {
  return requestResult((await store(INSIGHTS, "readonly")).get(key) as IDBRequest<InsightCache | undefined>);
}
