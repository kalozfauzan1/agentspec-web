const DB_NAME = "agentspec";
const DB_VERSION = 1;
const PROJECT_STORE = "projects";

let connection: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB tidak tersedia di lingkungan ini."));
  }
  if (connection) return connection;

  connection = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PROJECT_STORE)) {
        const store = db.createObjectStore(PROJECT_STORE, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Gagal membuka IndexedDB."));
  });

  return connection;
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDatabase().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(PROJECT_STORE, mode);
        const request = work(transaction.objectStore(PROJECT_STORE));
        transaction.oncomplete = () => resolve(request.result);
        transaction.onerror = () => reject(transaction.error ?? new Error("Transaksi gagal."));
        transaction.onabort = () => reject(transaction.error ?? new Error("Transaksi dibatalkan."));
      }),
  );
}

export const projectStorage = {
  async getAll<T>(): Promise<T[]> {
    const records = await runTransaction<T[]>("readonly", (store) => store.getAll());
    return records;
  },
  async get<T>(id: string): Promise<T | null> {
    const record = await runTransaction<T | undefined>("readonly", (store) => store.get(id));
    return record ?? null;
  },
  async put<T extends { id: string }>(record: T): Promise<T> {
    await runTransaction("readwrite", (store) => store.put(record));
    return record;
  },
  async remove(id: string): Promise<void> {
    await runTransaction("readwrite", (store) => store.delete(id));
  },
  async clear(): Promise<void> {
    await runTransaction("readwrite", (store) => store.clear());
  },
};
