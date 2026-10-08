
import { useState, useCallback } from 'react';
import { BusinessCardData } from '../types';
import { generateBatchSummaries } from '../services/geminiService';
import { saveCardToDB } from '../services/dbService';

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

        const chunkSize = 5;
        const process = async () => {
             for (let i = 0; i < missingSummary.length; i += chunkSize) {
                const chunk = missingSummary.slice(i, i + chunkSize);
                try {
                    const summaries = await generateBatchSummaries(chunk);
                    for (const result of summaries) {
                        const originalCard = chunk.find(c => c.id === result.id);
                        if (originalCard && result.summary) {
                            const updatedCard = { ...originalCard, summary: result.summary };
                            await saveCardToDB(updatedCard);
                            setCards(prev => prev.map(c => c.id === updatedCard.id ? { ...c, summary: result.summary } : c));
                            setFormData(prev => prev && prev.id === updatedCard.id ? { ...prev, summary: result.summary } : prev);
                        }
                    }
                    await new Promise(r => setTimeout(r, 1000));
                } catch (e) {
                    console.warn(`Failed to process batch summary chunk`, e);
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
