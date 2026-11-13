const firebaseConfig = {
  apiKey: "AIzaSyASSEW9be_Yc8VQrP-jsEOdw5DHsyoTIJM",
  authDomain: "ecoscan-sustainable.firebaseapp.com",
  projectId: "ecoscan-sustainable",
  storageBucket: "ecoscan-sustainable.firebasestorage.app",
  messagingSenderId: "139100815280",
  appId: "1:139100815280:web:94fa177c4f325c99292075",
  measurementId: "G-W66TPSREVJ"
};

let storageInstancePromise: Promise<{
  storage: any;
  storageMod: typeof import('firebase/storage');
}> | null = null;

const getClientStorage = async () => {
  if (!storageInstancePromise) {
    storageInstancePromise = Promise.all([
      import('firebase/app'),
      import('firebase/storage')
    ]).then(([appMod, storageMod]) => {
      const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(firebaseConfig);
      return {
        storage: storageMod.getStorage(app),
        storageMod
      };
    });
  }
  return storageInstancePromise;
};

export const uploadImageToFirebase = async (base64Data: string, cardId: string): Promise<string> => {
    try {
        const response = await fetch('/api/images', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64: base64Data, cardId })
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error);
        return data.downloadUrl;
    } catch (error) {
        console.error("Server-side image upload error:", error);
        throw error;
    }
};

/**
 * Uploads base64 or external URL via server-side Image Service (deduplicated by SHA-256)
 */
export const uploadImageAsset = async (base64OrUrl: string, cardId: string): Promise<{imageId: string, downloadUrl: string}> => {
    const isBase64 = base64OrUrl.startsWith('data:image');
    const body = isBase64 ? { base64: base64OrUrl, cardId } : { url: base64OrUrl, cardId };
    
    const response = await fetch('/api/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return { imageId: data.imageId, downloadUrl: data.downloadUrl };
};

export const deleteImageFromFirebase = async (imageUrl: string): Promise<void> => {
    if (!imageUrl || !imageUrl.includes('firebasestorage.googleapis.com')) return;
    
    try {
        const decodedUrl = decodeURIComponent(imageUrl);
        const pathMatch = decodedUrl.match(/\/o\/(.*?)\?alt=media/);
        
        if (pathMatch && pathMatch[1]) {
            const filePath = pathMatch[1];
            const { storage, storageMod } = await getClientStorage();
            const storageRef = storageMod.ref(storage, filePath);
            await storageMod.deleteObject(storageRef);
            console.log("Successfully deleted image from Firebase:", filePath);
        }
    } catch (error) {
        console.error("Firebase Storage delete error:", error);
    }
};

export const cleanupOrphanedImages = async (validImageUrls: string[]): Promise<{deleted: number, total: number}> => {
    try {
        const { storage, storageMod } = await getClientStorage();
        const folderRef = storageMod.ref(storage, 'business_cards');
        const result = await storageMod.listAll(folderRef);
        let deletedCount = 0;

        const validFilePaths = new Set(
            validImageUrls.map(url => {
                if (!url || !url.includes('firebasestorage.googleapis.com')) return null;
                const decodedUrl = decodeURIComponent(url);
                const pathMatch = decodedUrl.match(/\/o\/(.*?)\?alt=media/);
                return pathMatch && pathMatch[1] ? pathMatch[1] : null;
            }).filter(Boolean) as string[]
        );

        for (const itemRef of result.items) {
            if (!validFilePaths.has(itemRef.fullPath)) {
                await storageMod.deleteObject(itemRef);
                deletedCount++;
            }
        }
        return { deleted: deletedCount, total: result.items.length };
    } catch (error) {
        console.error("Firebase Storage cleanup error:", error);
        throw error;
    }
};
