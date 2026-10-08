import { initializeApp } from "firebase/app";
import { getStorage, ref, uploadString, getDownloadURL, deleteObject, listAll } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyASSEW9be_Yc8VQrP-jsEOdw5DHsyoTIJM",
  authDomain: "ecoscan-sustainable.firebaseapp.com",
  projectId: "ecoscan-sustainable",
  storageBucket: "ecoscan-sustainable.firebasestorage.app",
  messagingSenderId: "139100815280",
  appId: "1:139100815280:web:94fa177c4f325c99292075",
  measurementId: "G-W66TPSREVJ"
};

const app = initializeApp(firebaseConfig);
export const storage = getStorage(app);

export const uploadImageToFirebase = async (base64Data: string, cardId: string): Promise<string> => {
    try {
        const response = await fetch('/api/images', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64: base64Data, cardId })
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error);
        
        // We might want to return the whole object or just the URL. 
        // For compatibility, return the URL.
        // But we should also store the imageId in the card data.
        return data.downloadUrl;
    } catch (error) {
        console.error("Server-side image upload error:", error);
        throw error;
    }
};

/**
 * New version that returns both id and url (supports base64 or external URL)
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
        // Extract the path from the URL
        // Example URL: https://firebasestorage.googleapis.com/v0/b/ecoscan-sustainable.firebasestorage.app/o/business_cards%2FcardId.jpg?alt=media...
        const decodedUrl = decodeURIComponent(imageUrl);
        const pathMatch = decodedUrl.match(/\/o\/(.*?)\?alt=media/);
        
        if (pathMatch && pathMatch[1]) {
            const filePath = pathMatch[1];
            const storageRef = ref(storage, filePath);
            await deleteObject(storageRef);
            console.log("Successfully deleted image from Firebase:", filePath);
        }
    } catch (error) {
        console.error("Firebase Storage delete error:", error);
        // Don't throw, just log it so it doesn't break the local deletion flow
    }
};

export const cleanupOrphanedImages = async (validImageUrls: string[]): Promise<{deleted: number, total: number}> => {
    try {
        const folderRef = ref(storage, 'business_cards');
        const result = await listAll(folderRef);
        let deletedCount = 0;

        // Extract valid file paths from URLs
        const validFilePaths = validImageUrls.map(url => {
            if (!url || !url.includes('firebasestorage.googleapis.com')) return null;
            const decodedUrl = decodeURIComponent(url);
            const pathMatch = decodedUrl.match(/\/o\/(.*?)\?alt=media/);
            if (pathMatch && pathMatch[1]) {
                return pathMatch[1]; // e.g., "business_cards/12345.jpg"
            }
            return null;
        }).filter(Boolean);

        for (const itemRef of result.items) {
            const filePath = itemRef.fullPath; // e.g., "business_cards/12345.jpg"

            if (!validFilePaths.includes(filePath)) {
                await deleteObject(itemRef);
                deletedCount++;
            }
        }
        return { deleted: deletedCount, total: result.items.length };
    } catch (error) {
        console.error("Firebase Storage cleanup error:", error);
        throw error;
    }
};
