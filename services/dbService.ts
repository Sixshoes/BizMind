import { BusinessCardData } from '../types';
import { auth, getActiveOwnerUid, GUEST_OWNER_UID } from '../utils/auth';
import { deleteCardFromCloud, syncCardToCloud } from '../utils/cardCloud';

const DB_NAME = 'QSHubDB_V1_0';
const DB_VERSION = 6;
const STORE_NAME = 'cards';

let dbInstancePromise: Promise<IDBDatabase> | null = null;

const getDB = (): Promise<IDBDatabase> => {
  if (dbInstancePromise) return dbInstancePromise;

  dbInstancePromise = new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          dbInstancePromise = null;
        };
        db.onclose = () => {
          dbInstancePromise = null;
        };
        resolve(db);
      };
      request.onerror = () => {
        dbInstancePromise = null;
        reject(request.error);
      };
    } catch (e) {
      dbInstancePromise = null;
      reject(e);
    }
  });

  return dbInstancePromise;
};

const matchesCurrentOwner = (card: BusinessCardData | null | undefined): boolean => {
  if (!card) return false;
  const owner = getActiveOwnerUid();
  if (!owner) return false;
  if (owner === GUEST_OWNER_UID) {
    return !card.ownerUid || card.ownerUid === GUEST_OWNER_UID;
  }
  return card.ownerUid === owner;
};

export const saveCardLocalOnly = async (card: BusinessCardData): Promise<BusinessCardData> => {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put(card);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(card);
    tx.onerror = () => reject(tx.error);
  });
};

export const saveCardToDB = async (card: BusinessCardData): Promise<BusinessCardData> => {
  const uid = auth.currentUser?.uid;
  const owner = uid || GUEST_OWNER_UID;
  let next: BusinessCardData = { ...card, ownerUid: owner };

  if (uid) {
    try {
      next = await syncCardToCloud(next);
    } catch (error) {
      console.error('Cloud sync failed, saved locally instead:', error);
    }
  } else {
    next = { ...next, syncStatus: 'local' };
  }

  return saveCardLocalOnly(next);
};

export const saveAllCardsToDB = async (cards: BusinessCardData[]): Promise<boolean> => {
  if (cards.length === 0) return true;
  const uid = auth.currentUser?.uid;
  const owner = uid || GUEST_OWNER_UID;

  let toStore: BusinessCardData[] = cards.map((c) => ({
    ...c,
    ownerUid: uid ? uid : c.ownerUid || owner,
    syncStatus: uid ? ('firebase' as const) : ('local' as const),
  }));

  if (uid) {
    const synced: BusinessCardData[] = new Array(toStore.length);
    let idx = 0;
    const workers = Array.from({ length: Math.min(4, toStore.length) }, async () => {
      while (idx < toStore.length) {
        const cur = idx++;
        try {
          synced[cur] = await syncCardToCloud(toStore[cur]);
        } catch {
          synced[cur] = { ...toStore[cur], syncStatus: 'local' };
        }
      }
    });
    await Promise.all(workers);
    toStore = synced;
  }

  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  for (let i = 0; i < toStore.length; i++) {
    store.put(toStore[i]);
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
};

export const deleteCardFromDB = async (id: string): Promise<boolean> => {
  if (auth.currentUser?.uid) {
    try {
      const existing = await getCardById(id);
      await deleteCardFromCloud(id, existing?.imagePath, existing?.backImagePath);
    } catch (error) {
      console.error('Cloud delete failed:', error);
    }
  }
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
};

export const deleteCardsFromDB = async (ids: string[]): Promise<boolean> => {
  if (ids.length === 0) return true;
  if (auth.currentUser?.uid) {
    let idx = 0;
    const workers = Array.from({ length: Math.min(4, ids.length) }, async () => {
      while (idx < ids.length) {
        const id = ids[idx++];
        try {
          const existing = await getCardById(id);
          await deleteCardFromCloud(id, existing?.imagePath, existing?.backImagePath);
        } catch {
          // continue local delete
        }
      }
    });
    await Promise.all(workers);
  }

  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  for (let i = 0; i < ids.length; i++) {
    store.delete(ids[i]);
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
};

export const clearAllCardsFromDB = async (): Promise<boolean> => {
  const mine = await getCardsMetadataFromDB();
  if (mine.length === 0) return true;
  return deleteCardsFromDB(mine.map((c) => c.id));
};

export const getCardsMetadataFromDB = async (): Promise<BusinessCardData[]> => {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      if ('getAll' in store) {
        const req = store.getAll();
        req.onsuccess = () => {
          const all = ((req.result as BusinessCardData[]) || []).filter(matchesCurrentOwner);
          resolve(all);
        };
        req.onerror = () => resolve([]);
      } else {
        const items: BusinessCardData[] = [];
        const request = (store as IDBObjectStore).openCursor();
        request.onsuccess = (event: any) => {
          const cursor = event.target.result;
          if (cursor) {
            const card = cursor.value as BusinessCardData;
            if (matchesCurrentOwner(card)) items.push(card);
            cursor.continue();
          } else {
            resolve(items);
          }
        };
        request.onerror = () => resolve([]);
      }
    });
  } catch {
    return [];
  }
};

export const getCardById = async (id: string): Promise<BusinessCardData | null> => {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => {
        const card = (req.result || null) as BusinessCardData | null;
        resolve(matchesCurrentOwner(card) ? card : null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
};
