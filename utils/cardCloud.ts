import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  setDoc,
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadString } from 'firebase/storage';
import { BusinessCardData } from '../types';
import { auth } from './auth';
import { app, storage } from './firebase';

const firestore = getFirestore(app);

const cardRef = (uid: string, cardId: string) => doc(firestore, 'users', uid, 'cards', cardId);

const toPlain = (card: BusinessCardData) => {
  const plain: Record<string, unknown> = {};
  Object.entries(card).forEach(([key, value]) => {
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

export const syncCardToCloud = async (card: BusinessCardData): Promise<BusinessCardData> => {
  const uid = auth.currentUser?.uid;
  if (!uid) return { ...card, syncStatus: 'local' };

  let next: BusinessCardData = { ...card, ownerUid: uid, syncStatus: 'firebase' };
  if (next.imageUrl?.startsWith('data:image')) {
    const imagePath = `users/${uid}/cards/${next.id}.jpg`;
    const fileRef = ref(storage, imagePath);
    await uploadString(fileRef, next.imageUrl, 'data_url');
    next = {
      ...next,
      imagePath,
      imageUrl: await getDownloadURL(fileRef),
    };
  }
  if (next.backImageUrl?.startsWith('data:image')) {
    const backImagePath = `users/${uid}/cards/${next.id}-back.jpg`;
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

export const deleteCardFromCloud = async (
  cardId: string,
  imagePath?: string,
  backImagePath?: string
) => {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  await deleteDoc(cardRef(uid, cardId));
  const frontTarget = imagePath || `users/${uid}/cards/${cardId}.jpg`;
  const backTarget = backImagePath || `users/${uid}/cards/${cardId}-back.jpg`;
  for (const target of [frontTarget, backTarget]) {
    try {
      await deleteObject(ref(storage, target));
    } catch {
      // Ignore if image file was not uploaded
    }
  }
};
