/**
 * Small IndexedDB store for browser-made transcripts that have not been saved to the
 * server yet, so a failed save never loses minutes of recognition work.
 */
import type { LocalCue } from "./local-asr";

export interface PendingTranscript {
	id: string;
	downloadId?: string;
	title?: string;
	language: string | null;
	model: string;
	cues: LocalCue[];
	createdAt: number;
}

const DB_NAME = "smartvid-web";
const STORE = "pending-transcripts";

const open = (): Promise<IDBDatabase> =>
	new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, 1);
		request.onupgradeneeded = () => {
			request.result.createObjectStore(STORE, { keyPath: "id" });
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error("IndexedDB is not available."));
	});

const run = async <T>(
	mode: IDBTransactionMode,
	work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
	const db = await open();
	try {
		return await new Promise<T>((resolve, reject) => {
			const request = work(db.transaction(STORE, mode).objectStore(STORE));
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	} finally {
		db.close();
	}
};

export const savePending = async (item: PendingTranscript): Promise<void> => {
	await run("readwrite", (store) => store.put(item));
};

export const removePending = async (id: string): Promise<void> => {
	await run("readwrite", (store) => store.delete(id));
};

export const listPending = async (): Promise<PendingTranscript[]> => {
	try {
		const items = await run("readonly", (store) => store.getAll() as IDBRequest<PendingTranscript[]>);
		return items.sort((a, b) => b.createdAt - a.createdAt);
	} catch {
		return [];
	}
};
