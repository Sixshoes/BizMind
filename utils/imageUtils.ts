export interface CompressedImageResult {
    base64: string;
    mimeType: 'image/webp' | 'image/jpeg';
}

let cachedWebpSupport: boolean | null = null;
const supportsWebpExport = (): boolean => {
    if (cachedWebpSupport !== null) return cachedWebpSupport;
    try {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const url = canvas.toDataURL('image/webp');
        cachedWebpSupport = url.startsWith('data:image/webp');
    } catch {
        cachedWebpSupport = false;
    }
    return cachedWebpSupport;
};

const drawSourceToBase64 = (
    source: CanvasImageSource,
    rawWidth: number,
    rawHeight: number,
    maxWidth: number,
    quality: number,
    preferWebp: boolean
): CompressedImageResult => {
    let w = rawWidth;
    let h = rawHeight;
    if (w === 0 || h === 0) throw new Error("Image has 0 dimensions");

    if (w > maxWidth || h > maxWidth) {
        const ratio = Math.min(maxWidth / w, maxWidth / h);
        w = Math.floor(w * ratio);
        h = Math.floor(h * ratio);
    }

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Canvas context creation failed");

    ctx.drawImage(source, 0, 0, w, h);

    const targetMime: 'image/webp' | 'image/jpeg' =
        preferWebp && supportsWebpExport() ? 'image/webp' : 'image/jpeg';
    const dataUrl = canvas.toDataURL(targetMime, quality);
    if (!dataUrl || dataUrl === 'data:,') throw new Error("Canvas export failed");

    // Release backing store immediately
    canvas.width = 0;
    canvas.height = 0;

    return {
        base64: dataUrl.split(',')[1],
        mimeType: dataUrl.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg',
    };
};

export const compressImageWithMime = async (
    file: File | Blob,
    maxWidth = 1024,
    quality = 0.8,
    preferWebp = true
): Promise<CompressedImageResult> => {
    if (!file) throw new Error("No file provided");
    if (file.size === 0) throw new Error("File is empty");

    if (file.type && !file.type.startsWith('image/')) {
        throw new Error(`Unsupported file type: ${file.type}`);
    }

    // Strategy 0: Off-main-thread C++ image decode via createImageBitmap
    if (typeof createImageBitmap === 'function') {
        try {
            const bitmap = await createImageBitmap(file);
            try {
                return drawSourceToBase64(bitmap, bitmap.width, bitmap.height, maxWidth, quality, preferWebp);
            } finally {
                bitmap.close();
            }
        } catch {
            // Fall through to HTMLImageElement strategies (e.g. certain HEIC/SVG cases)
        }
    }

    // Strategy 1: ObjectURL + HTMLImageElement
    try {
        const res = await new Promise<CompressedImageResult>((resolve, reject) => {
            const objectUrl = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                try {
                    const result = drawSourceToBase64(img, img.width, img.height, maxWidth, quality, preferWebp);
                    URL.revokeObjectURL(objectUrl);
                    resolve(result);
                } catch (e) {
                    URL.revokeObjectURL(objectUrl);
                    reject(e);
                }
            };
            img.onerror = () => {
                URL.revokeObjectURL(objectUrl);
                reject(new Error("Image load failed (Strategy 1)"));
            };
            img.src = objectUrl;
        });
        return res;
    } catch (e) {
        console.warn("Fallback to FileReader", e);
    }

    // Strategy 2: FileReader fallback
    return new Promise<CompressedImageResult>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                try {
                    const result = drawSourceToBase64(img, img.width, img.height, maxWidth, quality, preferWebp);
                    resolve(result);
                } catch (err) { reject(err); }
            };
            img.onerror = () => reject(new Error("Image load failed (Strategy 2)"));
            img.src = e.target?.result as string;
        };
        reader.onerror = () => reject(new Error("File read failed"));
        reader.readAsDataURL(file);
    });
};

export const compressImage = async (file: File | Blob, maxWidth = 1024, quality = 0.8): Promise<string> => {
    const { base64 } = await compressImageWithMime(file, maxWidth, quality, false);
    return base64;
};
