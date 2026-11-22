import {
  BusinessCardData,
  FollowUpEmailDraft,
  BackSideExtractionResult,
  VoiceNoteResult,
  CardEnrichmentResult,
} from '../types';
import { apiFetch } from '../utils/apiClient';

/**
 * [單筆] 針對已有文字資料但缺少簡介的名片，生成摘要
 */
export const generateSummaryFromText = async (card: Partial<BusinessCardData>): Promise<string> => {
  try {
    const response = await apiFetch('/api/analyze-card', {
      method: 'POST',
      body: JSON.stringify({ action: 'summaryFromText', card }),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.summary || '';
  } catch (e) {
    console.warn('Text summary generation failed:', e);
    return '';
  }
};

/**
 * [批次] 針對多筆名片生成摘要
 */
export const generateBatchSummaries = async (
  cards: Partial<BusinessCardData>[]
): Promise<{ id: string; summary: string }[]> => {
  if (cards.length === 0) return [];
  try {
    const response = await apiFetch('/api/analyze-card', {
      method: 'POST',
      body: JSON.stringify({ action: 'batchSummaries', cards }),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.summaries || [];
  } catch (e) {
    console.warn('Batch summary generation failed:', e);
    return [];
  }
};

/**
 * 提取名片詳細資料 (正面 + 欄位信心度)
 */
export const extractCardInfo = async (
  base64Image: string,
  mimeType: string = 'image/jpeg'
): Promise<any> => {
  const response = await apiFetch('/api/analyze-card', {
    method: 'POST',
    body: JSON.stringify({ action: 'extractInfo', image: base64Image, mimeType }),
  });
  const data = await response.json();
  if (!data.success) throw new Error(data.error || 'Extraction failed');
  return data.result;
};

/**
 * [AI 2.0] 將貼上的 Email 簽名檔、LINE 自我介紹或純文字聯絡資訊解析為結構化名片
 */
export const parseTextSignatureCard = async (rawText: string): Promise<any> => {
  const response = await apiFetch('/api/analyze-card', {
    method: 'POST',
    body: JSON.stringify({ action: 'parseTextCard', rawText }),
  });
  const data = await response.json();
  if (!data.success) throw new Error(data.error || '簽名檔解析失敗');
  return data.result;
};

/**
 * [AI 2.0] 語音會談紀要：將口述音訊整理為結構化備註、建議標籤與跟進天數
 */
export const transcribeVoiceNote = async (
  audioBase64: string,
  mimeType: string,
  card: Partial<BusinessCardData>
): Promise<VoiceNoteResult> => {
  const response = await apiFetch('/api/analyze-card', {
    method: 'POST',
    body: JSON.stringify({ action: 'transcribeVoiceNote', audioBase64, mimeType, card }),
  });
  const data = await response.json();
  if (!data.success) throw new Error(data.error || '語音紀要解析失敗');
  return data.result as VoiceNoteResult;
};

/**
 * [AI 2.0] 透過 Google Search Grounding 補完名片機構背景、產業與官網
 */
export const enrichCardWithWebSearch = async (
  card: Partial<BusinessCardData>
): Promise<CardEnrichmentResult> => {
  const response = await apiFetch('/api/analyze-card', {
    method: 'POST',
    body: JSON.stringify({ action: 'enrichCard', card }),
  });
  const data = await response.json();
  if (!data.success) throw new Error(data.error || '機構背景查證失敗');
  return data.result as CardEnrichmentResult;
};

/**
 * 提取名片反面獨立資料並與正面進行語意關係判讀（雙語鏡像 / 同人雙職稱 / 不同機構或人物）
 */
export const extractBackCardInfo = async (
  base64Image: string,
  frontCard: Partial<BusinessCardData>,
  mimeType: string = 'image/jpeg'
): Promise<BackSideExtractionResult> => {
  const response = await apiFetch('/api/analyze-card', {
    method: 'POST',
    body: JSON.stringify({
      action: 'extractBackInfo',
      image: base64Image,
      imageUrl: !base64Image ? frontCard.backImageUrl : undefined,
      mimeType,
      card: frontCard,
    }),
  });
  const data = await response.json();
  if (!data.success) throw new Error(data.error || 'Back-side extraction failed');
  return data.result as BackSideExtractionResult;
};

/**
 * 生成個人化會後跟進開發信草稿
 */
export const generateFollowUpEmailDraft = async (
  card: BusinessCardData,
  options: {
    tone: 'business' | 'academic' | 'event_followup';
    language: 'zh-TW' | 'en';
    senderName?: string;
    senderOrg?: string;
    customContext?: string;
  }
): Promise<FollowUpEmailDraft> => {
  const response = await apiFetch('/api/analyze-card', {
    method: 'POST',
    body: JSON.stringify({
      action: 'generateFollowUpEmail',
      card,
      emailOptions: options,
    }),
  });
  const data = await response.json();
  if (!data.success) throw new Error(data.error || 'Failed to generate email draft');
  return data.draft;
};

/**
 * 偵測名片位置 (Bounding Boxes)
 */
export const detectBusinessCards = async (
  base64Image: string,
  mimeType: string = 'image/jpeg'
): Promise<{ ymin: number; xmin: number; ymax: number; xmax: number }[]> => {
  const response = await apiFetch('/api/analyze-card', {
    method: 'POST',
    body: JSON.stringify({ action: 'detectCards', image: base64Image, mimeType }),
  });
  const data = await response.json();
  if (!data.success) throw new Error(data.error || 'Detection failed');
  return data.boxes || [];
};
