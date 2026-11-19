
export const compressImage = async (file: File | Blob, maxWidth = 1024, quality = 0.8): Promise<string> => {
    if (!file) throw new Error("No file provided");
    if (file.size === 0) throw new Error("File is empty");
    
    if (file.type && !file.type.startsWith('image/')) {
        throw new Error(`Unsupported file type: ${file.type}`);
    }

    const processImg = (img: HTMLImageElement): string => {
        let w = img.width;
        let h = img.height;
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
        
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        if (!dataUrl || dataUrl === 'data:,') throw new Error("Canvas export failed");
        return dataUrl.split(',')[1];
    };

    try {
        const b64 = await new Promise<string>((resolve, reject) => {
            const objectUrl = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                try {
                    const result = processImg(img);
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
        return b64;
    } catch (e) {
        console.warn("Fallback to FileReader", e);
    }

    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                try {
                    const result = processImg(img);
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
