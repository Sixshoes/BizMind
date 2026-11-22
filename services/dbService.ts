import { BusinessCardData } from '../types';
import { auth, getActiveOwnerUid, GUEST_OWNER_UID } from '../utils/auth';
import { deleteCardFromCloud, syncCardToCloud } from '../utils/cardCloud';

const DB_NAME = 'QSHubDB_V1_0';
const DB_VERSION = 7;
const STORE_NAME = 'cards';

let dbInstancePromise: Promise<IDBDatabase> | null = null;

const getDB = (): Promise<IDBDatabase> => {
  if (dbInstancePromise) return dbInstancePromise;

  dbInstancePromise = new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        let store: IDBObjectStore;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        } else {
          store = request.transaction!.objectStore(STORE_NAME);
        }
        if (!store.indexNames.contains('by_ownerUid')) {
          store.createIndex('by_ownerUid', 'ownerUid', { unique: false });
        }
        if (!store.indexNames.contains('by_updatedAt')) {
          store.createIndex('by_updatedAt', 'updatedAt', { unique: false });
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
  if (!card || card.deletedAt) return false;
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

export const deleteCardLocalOnly = async (id: string): Promise<boolean> => {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
};

/**
 * Reconciles a fresh Firestore snapshot against local IndexedDB for a signed-in user:
 * - Preserves newer unsynced local edits (`syncStatus === 'local'` with newer `updatedAt`)
 * - Removes locally cached cloud cards that were deleted on another device
 * - Upserts remote additions/updates
 */
export const reconcileCloudSnapshotWithLocal = async (
  uid: string,
  remoteCards: BusinessCardData[]
): Promise<BusinessCardData[]> => {
  const db = await getDB();
  const localMine = await getCardsMetadataFromDB();
  const localMap = new Map(localMine.map((c) => [c.id, c]));
  const remoteMap = new Map<string, BusinessCardData>();
  for (const rc of remoteCards) {
    if (!rc.deletedAt) {
      remoteMap.set(rc.id, { ...rc, ownerUid: uid, syncStatus: 'firebase' });
    }
  }

  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const merged: BusinessCardData[] = [];

  for (const [id, remote] of remoteMap.entries()) {
    const local = localMap.get(id);
    const localTs = local?.updatedAt || local?.scannedAt || 0;
    const remoteTs = remote.updatedAt || remote.scannedAt || 0;
    if (local && local.syncStatus === 'local' && localTs > remoteTs) {
      merged.push(local);
    } else {
      store.put(remote);
      merged.push(remote);
    }
  }

  for (const [id, local] of localMap.entries()) {
    if (!remoteMap.has(id)) {
      if (local.syncStatus === 'local') {
        // Pending offline local card: keep until next upload flush
        merged.push(local);
      } else {
        // Was synced previously, now deleted remotely on another device
        store.delete(id);
      }
    }
  }

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  return merged.sort((a, b) => b.scannedAt - a.scannedAt);
};

/**
 * Returns local cards saved under Guest Mode so they can be offered for seamless
 * one-click import when the user signs in with Google.
 */
export const getGuestLocalCards = async (): Promise<BusinessCardData[]> => {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => {
        const all = (req.result as BusinessCardData[]) || [];
        resolve(
          all.filter((c) => !c.deletedAt && (!c.ownerUid || c.ownerUid === GUEST_OWNER_UID))
        );
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
};

/**
 * Migrates guest-mode local cards into the signed-in Google user's personal cloud.
 */
export const migrateGuestCardsToCloud = async (uid: string): Promise<number> => {
  const guestCards = await getGuestLocalCards();
  if (guestCards.length === 0) return 0;

  const now = Date.now();
  const upgraded: BusinessCardData[] = guestCards.map((c) => ({
    ...c,
    ownerUid: uid,
    updatedAt: c.updatedAt || now,
    syncStatus: 'firebase',
  }));
  await saveAllCardsToDB(upgraded);
  return upgraded.length;
};

export const saveCardToDB = async (card: BusinessCardData): Promise<BusinessCardData> => {
  const uid = auth.currentUser?.uid;
  const owner = uid || GUEST_OWNER_UID;
  let next: BusinessCardData = {
    ...card,
    ownerUid: owner,
    updatedAt: Date.now(),
  };

  if (uid) {
    try {
      next = await syncCardToCloud(next);
    } catch (error) {
      console.error('Cloud sync failed, queued locally for retry:', error);
      next = { ...next, syncStatus: 'local' };
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
  const now = Date.now();

  let toStore: BusinessCardData[] = cards.map((c) => ({
    ...c,
    ownerUid: uid ? uid : c.ownerUid || owner,
    updatedAt: c.updatedAt || now,
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
  return deleteCardLocalOnly(id);
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
    const owner = getActiveOwnerUid();
    if (!owner) return [];

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);

      // Fast indexed lookup for signed-in users
      if (owner !== GUEST_OWNER_UID && store.indexNames.contains('by_ownerUid')) {
        const idxReq = store.index('by_ownerUid').getAll(IDBKeyRange.only(owner));
        idxReq.onsuccess = () => {
          const matched = ((idxReq.result as BusinessCardData[]) || []).filter((c) => !c.deletedAt);
          resolve(matched);
        };
        idxReq.onerror = () => resolve([]);
        return;
      }

      const req = store.getAll();
      req.onsuccess = () => {
        const all = ((req.result as BusinessCardData[]) || []).filter(matchesCurrentOwner);
        resolve(all);
      };
      req.onerror = () => resolve([]);
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
