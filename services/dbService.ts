
import { BusinessCardData } from '../types';

const DB_NAME = 'QSHubDB_V1_0';
const STORE_NAME = 'cards';

const getDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, 6);
      request.onupgradeneeded = (e: any) => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    } catch (e) { reject(e); }
  });
};

export const saveCardToDB = async (card: BusinessCardData) => {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put(card);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
};

export const saveAllCardsToDB = async (cards: BusinessCardData[]) => {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  cards.forEach(card => store.put(card));
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
};

export const deleteCardFromDB = async (id: string) => {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
};

export const clearAllCardsFromDB = async () => {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).clear();
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
};

export const getCardsMetadataFromDB = async (): Promise<BusinessCardData[]> => {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const items: BusinessCardData[] = [];
      const request = store.openCursor();
      request.onsuccess = (event: any) => {
        const cursor = event.target.result;
        if (cursor) {
          // We keep imageUrl so it can be used as a thumbnail in the list view
          items.push(cursor.value as BusinessCardData);
          cursor.continue();
        } else {
          resolve(items);
        }
      };
      request.onerror = () => resolve([]);
    });
  } catch (e) { return []; }
};

export const getCardById = async (id: string): Promise<BusinessCardData | null> => {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (e) { return null; }
};
