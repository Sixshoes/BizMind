import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadString } from 'firebase/storage';
import { BusinessCardData, MyDigitalCardProfile } from '../types';
import { auth } from './auth';
import { app, buildCardImagePath, storage } from './firebase';

const firestore = getFirestore(app);

const cardRef = (uid: string, cardId: string) => doc(firestore, 'users', uid, 'cards', cardId);
const myCardRef = (uid: string) => doc(firestore, 'users', uid, 'profile', 'my_card');

const toPlain = (obj: Record<string, any>) => {
  const plain: Record<string, unknown> = {};
  Object.entries(obj).forEach(([key, value]) => {
    if (value !== undefined) plain[key] = value;
  });
  return plain;
};

export const fetchCloudCards = async (): Promise<BusinessCardData[]> => {
  const uid = auth.currentUser?.uid;
  if (!uid) return [];
  const snap = await getDocs(collection(firestore, 'users', uid, 'cards'));
  return snap.docs.map((item) => item.data() as BusinessCardData);
};

/**
 * Real-time cross-device listener via Firestore onSnapshot.
 * Emits all remote documents (including tombstones with deletedAt) so deletions
 * and edits propagate across phone and desktop within ~1 second.
 */
export const subscribeCloudCards = (
  uid: string,
  onCardsSnapshot: (remoteCards: BusinessCardData[]) => void,
  onError?: (err: Error) => void
): Unsubscribe => {
  return onSnapshot(
    collection(firestore, 'users', uid, 'cards'),
    (snap) => {
      const items = snap.docs.map((d) => d.data() as BusinessCardData);
      onCardsSnapshot(items);
    },
    (err) => {
      console.error('Firestore realtime sync error:', err);
      onError?.(err);
    }
  );
};

export const syncCardToCloud = async (card: BusinessCardData): Promise<BusinessCardData> => {
  const uid = auth.currentUser?.uid;
  if (!uid) return { ...card, syncStatus: 'local' };

  const now = Date.now();
  let next: BusinessCardData = {
    ...card,
    ownerUid: uid,
    syncStatus: 'firebase',
    updatedAt: card.updatedAt || now,
  };

  if (next.imageUrl?.startsWith('data:image')) {
    const imagePath = buildCardImagePath(uid, next.id, 'front');
    const fileRef = ref(storage, imagePath);
    await uploadString(fileRef, next.imageUrl, 'data_url');
    next = {
      ...next,
      imagePath,
      imageUrl: await getDownloadURL(fileRef),
    };
  }
  if (next.backImageUrl?.startsWith('data:image')) {
    const backImagePath = buildCardImagePath(uid, next.id, 'back');
    const fileRef = ref(storage, backImagePath);
    await uploadString(fileRef, next.backImageUrl, 'data_url');
    next = {
      ...next,
      backImagePath,
      backImageUrl: await getDownloadURL(fileRef),
    };
  }

  const stored = { ...next };
  if (stored.imageUrl?.startsWith('data:')) {
    delete stored.imageUrl;
  }
  if (stored.backImageUrl?.startsWith('data:')) {
    delete stored.backImageUrl;
  }
  await setDoc(cardRef(uid, next.id), toPlain(stored));
  return next;
};

/**
 * Deletes card from Firestore (and cleans up both canonical & legacy Storage paths).
 */
export const deleteCardFromCloud = async (
  cardId: string,
  imagePath?: string,
  backImagePath?: string
) => {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  await deleteDoc(cardRef(uid, cardId));

  const candidatePaths = Array.from(
    new Set(
      [
        imagePath,
        backImagePath,
        buildCardImagePath(uid, cardId, 'front'),
        buildCardImagePath(uid, cardId, 'back'),
        // Legacy paths from v1.x so old uploads are also cleaned up
        `users/${uid}/cards/${cardId}.jpg`,
        `users/${uid}/cards/${cardId}-back.jpg`,
      ].filter(Boolean) as string[]
    )
  );

  await Promise.allSettled(candidatePaths.map((p) => deleteObject(ref(storage, p))));
};

export const fetchMyDigitalCardCloud = async (): Promise<MyDigitalCardProfile | null> => {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  try {
    const snap = await getDoc(myCardRef(uid));
    return snap.exists() ? (snap.data() as MyDigitalCardProfile) : null;
  } catch {
    return null;
  }
};

export const saveMyDigitalCardCloud = async (profile: MyDigitalCardProfile): Promise<void> => {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  await setDoc(myCardRef(uid), toPlain({ ...profile, updatedAt: Date.now() }));
};
