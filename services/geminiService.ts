import { BusinessCardData } from "../types";

/**
 * [單筆] 針對已有文字資料但缺少簡介的名片，生成摘要
 */
export const generateSummaryFromText = async (card: Partial<BusinessCardData>): Promise<string> => {
    try {
        const response = await fetch('/api/analyze-card', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'summaryFromText', card })
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error);
        return data.summary || "";
    } catch (e) {
        console.warn("Text summary generation failed:", e);
        return "";
    }
};

/**
 * [批次] 針對多筆名片生成摘要
 */
export const generateBatchSummaries = async (cards: Partial<BusinessCardData>[]): Promise<{id: string, summary: string}[]> => {
    if (cards.length === 0) return [];
    
    try {
        const response = await fetch('/api/analyze-card', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'batchSummaries', cards })
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error);
        return data.summaries || [];
    } catch (e) {
        console.warn("Batch summary generation failed:", e);
        return [];
    }
};

/**
 * 提取名片詳細資料
 */
export const extractCardInfo = async (
  base64Image: string, 
  mimeType: string = 'image/jpeg'
): Promise<any> => {
    try {
      const response = await fetch('/api/analyze-card', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'extractInfo', image: base64Image, mimeType })
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || "Extraction failed");
      return data.result;
    } catch (error: any) {
      console.error("Gemini Extraction Error:", error);
      throw error;
    }
};

/**
 * 偵測名片位置 (Bounding Boxes)
 */
export const detectBusinessCards = async (base64Image: string, mimeType: string = 'image/jpeg'): Promise<{ymin: number, xmin: number, ymax: number, xmax: number}[]> => {
    try {
      const response = await fetch('/api/analyze-card', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'detectCards', image: base64Image, mimeType })
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || "Detection failed");
      return data.boxes || [];
    } catch (e) {
      console.warn("AI Detection failed:", e);
      throw e;
    }
};
