import React, { useState, useCallback } from 'react';
import { BusinessCardData } from '../types';
import { generateBatchSummaries } from '../services/geminiService';
import { saveAllCardsToDB } from '../services/dbService';

export const useBackgroundTasks = (
  setCards: React.Dispatch<React.SetStateAction<BusinessCardData[]>>,
  setFormData: React.Dispatch<React.SetStateAction<BusinessCardData | null>>
) => {
  const [bgTaskCount, setBgTaskCount] = useState(0);

  const runBackgroundSummaryCheck = useCallback(
    async (cardsToCheck: BusinessCardData[]) => {
      const missingSummary = cardsToCheck.filter(
        (c) => !c.summary || String(c.summary).trim() === ''
      );

      if (missingSummary.length > 0) {
        setBgTaskCount(missingSummary.length);

        const chunkSize = 5;
        const process = async () => {
          for (let i = 0; i < missingSummary.length; i += chunkSize) {
            const chunk = missingSummary.slice(i, i + chunkSize);
            try {
              const summaries = await generateBatchSummaries(chunk);
              const updatedBatch: BusinessCardData[] = [];
              const summaryMap = new Map<string, string>();

              for (const result of summaries) {
                const originalCard = chunk.find((c) => c.id === result.id);
                if (originalCard && result.summary) {
                  updatedBatch.push({ ...originalCard, summary: result.summary });
                  summaryMap.set(originalCard.id, result.summary);
                }
              }

              if (updatedBatch.length > 0) {
                await saveAllCardsToDB(updatedBatch);
                setCards((prev) =>
                  prev.map((c) =>
                    summaryMap.has(c.id) ? { ...c, summary: summaryMap.get(c.id)! } : c
                  )
                );
                setFormData((prev) =>
                  prev && summaryMap.has(prev.id)
                    ? { ...prev, summary: summaryMap.get(prev.id)! }
                    : prev
                );
              }

              await new Promise((r) => setTimeout(r, 800));
            } catch (e) {
              console.warn('Failed to process batch summary chunk', e);
            } finally {
              setBgTaskCount((prev) => Math.max(0, prev - chunk.length));
            }
          }
        };
        process();
      }
    },
    [setCards, setFormData]
  );

  return {
    bgTaskCount,
    runBackgroundSummaryCheck,
  };
};
