import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getStorage, ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyBNN6jJcT06JCYpSEtLCxg9g_uWM3Yir44',
  authDomain: 'bizmind-7ff8a.firebaseapp.com',
  projectId: 'bizmind-7ff8a',
  storageBucket: 'bizmind-7ff8a.firebasestorage.app',
  messagingSenderId: '813624603687',
  appId: '1:813624603687:web:9e0c3d987cdee611ec4a02',
  measurementId: 'G-RSPG12N1FF',
};

export const app = initializeApp(firebaseConfig);
export const storage = getStorage(app);

isSupported()
  .then((supported) => {
    if (supported) getAnalytics(app);
  })
  .catch(() => {});

/**
 * Canonical Storage path builder shared across firebase.ts and cardCloud.ts
 * so front/back images never drift or leave orphan assets on deletion.
 */
export const buildCardImagePath = (
  uid: string,
  cardId: string,
  side: 'front' | 'back'
): string => {
  const safeId = cardId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `users/${uid}/cards/${safeId}_${side}.jpg`;
};

/**
 * Uploads base64 image to user's private Firebase Storage path when signed in,
 * or falls back cleanly to local data URI in Guest mode.
 */
export const uploadImageAsset = async (
  base64OrUrl: string,
  cardAssetKey: string,
  side?: 'front' | 'back'
): Promise<{ imageId: string; downloadUrl: string; storagePath?: string }> => {
  const auth = getAuth(app);
  const uid = auth.currentUser?.uid;

  if (!uid || !base64OrUrl.startsWith('data:image')) {
    return {
      imageId: cardAssetKey,
      downloadUrl: base64OrUrl,
    };
  }

  const inferredSide: 'front' | 'back' =
    side || (cardAssetKey.endsWith('_back') ? 'back' : 'front');
  const baseCardId = cardAssetKey.replace(/_(front|back)$/, '');
  const storagePath = buildCardImagePath(uid, baseCardId, inferredSide);
  const safeKey = `${baseCardId.replace(/[^a-zA-Z0-9_-]/g, '_')}_${inferredSide}`;
  const fileRef = ref(storage, storagePath);
  await uploadString(fileRef, base64OrUrl, 'data_url');
  const downloadUrl = await getDownloadURL(fileRef);

  return {
    imageId: safeKey,
    downloadUrl,
    storagePath,
  };
};

export const uploadImageToFirebase = async (base64Data: string, cardId: string): Promise<string> => {
  const dataUri = base64Data.startsWith('data:image')
    ? base64Data
    : `data:image/jpeg;base64,${base64Data}`;
  const uploaded = await uploadImageAsset(dataUri, cardId, 'front');
  return uploaded.downloadUrl;
};

export const deleteImageFromFirebase = async (imageUrl: string): Promise<void> => {
  if (!imageUrl || !imageUrl.includes('firebasestorage.googleapis.com')) return;
  try {
    const decodedUrl = decodeURIComponent(imageUrl);
    const pathMatch = decodedUrl.match(/\/o\/(.*?)\?alt=media/);
    if (pathMatch && pathMatch[1]) {
      await deleteObject(ref(storage, pathMatch[1]));
    }
  } catch {
    // Ignore missing remote objects
  }
};
