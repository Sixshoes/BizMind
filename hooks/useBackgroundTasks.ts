import { useState, useCallback } from 'react';
import { BusinessCardData } from '../types';
import { generateBatchSummaries } from '../services/geminiService';
import { saveAllCardsToDB } from '../services/dbService';

export const useBackgroundTasks = (
  setCards: React.Dispatch<React.SetStateAction<BusinessCardData[]>>,
  setFormData: React.Dispatch<React.SetStateAction<BusinessCardData | null>>
) => {
  const [bgTaskCount, setBgTaskCount] = useState(0);

  const runBackgroundSummaryCheck = useCallback(async (cardsToCheck: BusinessCardData[]) => {
    const missingSummary = cardsToCheck.filter(c => !c.summary || String(c.summary).trim() === '');

    if (missingSummary.length > 0) {
      console.log(`Found ${missingSummary.length} cards without summary. Auto-generating in background (Batch Mode)...`);
      setBgTaskCount(missingSummary.length);

      const chunkSize = 8;
      const process = async () => {
        for (let i = 0; i < missingSummary.length; i += chunkSize) {
          const chunk = missingSummary.slice(i, i + chunkSize);
          try {
            const summaries = await generateBatchSummaries(chunk);
            const summaryMap = new Map<string, string>();
            const updatedCards: BusinessCardData[] = [];

            for (const result of summaries) {
              if (!result.summary) continue;
              const originalCard = chunk.find(c => c.id === result.id);
              if (originalCard) {
                summaryMap.set(result.id, result.summary);
                updatedCards.push({ ...originalCard, summary: result.summary });
              }
            }

            if (updatedCards.length > 0) {
              await saveAllCardsToDB(updatedCards);
              setCards(prev => prev.map(c => {
                const newSummary = summaryMap.get(c.id);
                return newSummary !== undefined ? { ...c, summary: newSummary } : c;
              }));
              setFormData(prev => {
                if (!prev) return prev;
                const newSummary = summaryMap.get(prev.id);
                return newSummary !== undefined ? { ...prev, summary: newSummary } : prev;
              });
            }

            await new Promise(r => setTimeout(r, 500));
          } catch (e) {
            console.warn('Failed to process batch summary chunk', e);
          } finally {
            setBgTaskCount(prev => Math.max(0, prev - chunk.length));
          }
        }
      };
      process();
    }
  }, [setCards, setFormData]);

  return {
    bgTaskCount,
    runBackgroundSummaryCheck
  };
};
