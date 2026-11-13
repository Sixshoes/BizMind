import { useState, useCallback } from 'react';
import { BusinessCardData } from '../../types';
import { saveCardToDB, saveAllCardsToDB, deleteCardFromDB, deleteCardsFromDB } from '../../services/dbService';
import { uploadImageAsset } from '../../utils/firebase';
import { useToast } from '../../components/ToastProvider';

const NOTION_SYNC_CONCURRENCY = 3;

const extractImageId = (url: string): string => {
  try {
    const decoded = decodeURIComponent(url);
    const match = decoded.match(/business_cards[\/]([^.\/?#]+)/);
    if (match && match[1]) {
      return match[1];
    }
  } catch (e) {
    console.error(e);
  }
  return Math.random().toString(36).substring(2);
};

const isFirebaseHostedUrl = (url: string): boolean =>
  url.includes('storage.googleapis.com') ||
  url.includes('firebasestorage.googleapis.com') ||
  url.includes('firebasestorage.app');

export const useNotionSync = (
  cards: BusinessCardData[],
  setCards: React.Dispatch<React.SetStateAction<BusinessCardData[]>>,
  formData: BusinessCardData | null,
  setFormData: React.Dispatch<React.SetStateAction<BusinessCardData | null>>,
  setSelectedCardId: React.Dispatch<React.SetStateAction<string | null>>
) => {
  const [isNotionLoading, setIsNotionLoading] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [notionProgress, setNotionProgress] = useState<{ loaded: number, total: number | null }>({ loaded: 0, total: null });
  const [syncProgress, setSyncProgress] = useState<{ current: number, total: number } | null>(null);
  const { addToast } = useToast();

  const deleteFromNotion = useCallback(async (id: string, imageId?: string, name?: string) => {
    try {
      const url = imageId ? `/api/notion/delete/${id}?imageId=${imageId}` : `/api/notion/delete/${id}`;
      const res = await fetch(url, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) {
        console.error('Failed to delete from Notion:', json.error);
        addToast({ type: 'error', message: `無法從 Notion 刪除資料: ${json.error}` });
      } else {
        addToast({ type: 'success', message: `${name || '這筆資料'} 已從 Notion 移除` });
      }
    } catch (e: any) {
      console.error('Failed to delete from Notion:', e);
      addToast({ type: 'error', message: `無法從 Notion 刪除資料: ${e.message || e}` });
    }
  }, [addToast]);

  const handleLoadFromNotion = useCallback(async () => {
    setIsNotionLoading(true);
    setNotionProgress({ loaded: 0, total: null });
    let loadedCount = 0;
    let hasMore = true;
    let nextCursor: string | undefined = undefined;
    const allNewCards: BusinessCardData[] = [];
    const cardsNeedingUpload: BusinessCardData[] = [];

    try {
      while (hasMore) {
        const url = nextCursor
          ? `/api/notion/load?cursor=${encodeURIComponent(nextCursor)}`
          : '/api/notion/load';

        const res = await fetch(url);
        const json = await res.json();

        if (!json.success) {
          throw new Error(json.error);
        }

        const pageCards: BusinessCardData[] = (json.data || []).map((card: BusinessCardData) => {
          if (card.imageUrl && isFirebaseHostedUrl(card.imageUrl) && !card.imageId) {
            return {
              ...card,
              imageId: extractImageId(card.imageUrl),
              syncStatus: 'notion' as const,
            };
          }
          if (card.imageUrl && !isFirebaseHostedUrl(card.imageUrl)) {
            cardsNeedingUpload.push(card);
          }
          return card;
        });

        await saveAllCardsToDB(pageCards);
        loadedCount += pageCards.length;
        setNotionProgress({ loaded: loadedCount, total: null });
        allNewCards.push(...pageCards);
        hasMore = json.has_more;
        nextCursor = json.next_cursor;
      }

      // Identify and batch-delete stale local Notion cards in a single transaction
      const loadedIds = new Set(allNewCards.map(c => c.id));
      const staleIds = cards.filter(c => c.syncStatus === 'notion' && !loadedIds.has(c.id)).map(c => c.id);

      if (staleIds.length > 0) {
        try {
          await deleteCardsFromDB(staleIds);
        } catch (err) {
          console.error('Failed to delete stale cards from local DB:', err);
        }

        if (formData && staleIds.includes(formData.id)) {
          setSelectedCardId(null);
          setFormData(null);
        }
      }

      setCards(prev => {
        const unsyncedCards = prev.filter(c => c.syncStatus !== 'notion');
        const merged = [...allNewCards, ...unsyncedCards];
        return merged.sort((a, b) => b.scannedAt - a.scannedAt);
      });

      addToast({ type: 'success', message: `成功載入 ${loadedCount} 筆資料` });

      // Controlled background migration only for external non-Firebase images
      if (cardsNeedingUpload.length > 0) {
        (async () => {
          const uploadBatchSize = 3;
          for (let i = 0; i < cardsNeedingUpload.length; i += uploadBatchSize) {
            const batch = cardsNeedingUpload.slice(i, i + uploadBatchSize);
            const migratedInBatch: BusinessCardData[] = [];

            await Promise.all(batch.map(async (card) => {
              if (!card.imageUrl) return;
              try {
                const { imageId, downloadUrl } = await uploadImageAsset(card.imageUrl, card.id);
                const updatedCard: BusinessCardData = {
                  ...card,
                  imageUrl: downloadUrl,
                  imageId,
                  syncStatus: 'notion'
                };
                migratedInBatch.push(updatedCard);
                await fetch('/api/notion/save', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(updatedCard)
                });
              } catch (e) {
                console.error("Migration to ImageService failed in background", e);
              }
            }));

            if (migratedInBatch.length > 0) {
              await saveAllCardsToDB(migratedInBatch);
              const migratedMap = new Map(migratedInBatch.map(c => [c.id, c]));
              setCards(prev => prev.map(c => migratedMap.get(c.id) || c));
            }
            await new Promise(resolve => setTimeout(resolve, 250));
          }
        })();
      }
    } catch (e: any) {
      addToast({ type: 'error', message: '載入失敗: ' + e.message });
    } finally {
      setIsNotionLoading(false);
      setNotionProgress({ loaded: 0, total: null });
    }
  }, [addToast, cards, formData, setCards, setFormData, setSelectedCardId]);

  const ensureFirebaseImage = useCallback(async (card: BusinessCardData, skipStateUpdate = false): Promise<BusinessCardData> => {
    if (card.imageUrl) {
      if (isFirebaseHostedUrl(card.imageUrl)) {
        if (!card.imageId) {
          const imageId = extractImageId(card.imageUrl);
          const updatedCard: BusinessCardData = {
            ...card,
            imageId,
            syncStatus: card.syncStatus === 'notion' ? 'notion' : 'firebase'
          };
          if (!skipStateUpdate) {
            await saveCardToDB(updatedCard);
            setCards(prev => prev.map(c => c.id === card.id ? updatedCard : c));
            if (formData?.id === card.id) {
              setFormData(updatedCard);
            }
          }
          return updatedCard;
        }
      } else {
        try {
          const { imageId, downloadUrl } = await uploadImageAsset(card.imageUrl, card.id);
          const updatedCard: BusinessCardData = {
            ...card,
            imageUrl: downloadUrl,
            imageId,
            syncStatus: card.syncStatus === 'notion' ? 'notion' : 'firebase'
          };
          if (!skipStateUpdate) {
            await saveCardToDB(updatedCard);
            setCards(prev => prev.map(c => c.id === card.id ? updatedCard : c));
            if (formData?.id === card.id) {
              setFormData(updatedCard);
            }
          }
          return updatedCard;
        } catch (e) {
          console.error("Failed to upload image asset", e);
          return card;
        }
      }
    }
    return card;
  }, [formData?.id, setCards, setFormData]);

  const handleSaveToNotion = useCallback(async () => {
    if (!formData) return;
    const oldImageId = formData.imageId;
    setIsNotionLoading(true);
    try {
      const cardToSync = await ensureFirebaseImage(formData);
      const res = await fetch('/api/notion/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...cardToSync, oldImageId })
      });
      const json = await res.json();
      if (json.success) {
        addToast({ type: 'success', message: '成功新增至 Notion！' });
        const oldId = cardToSync.id;
        const newId = json.notionId || oldId;
        const updatedCard: BusinessCardData = {
          ...cardToSync,
          id: newId,
          syncStatus: 'notion'
        };

        if (newId !== oldId) {
          await saveCardToDB(updatedCard);
          await deleteCardFromDB(oldId);
        } else {
          await saveCardToDB(updatedCard);
        }

        setCards(prev => prev.map(c => c.id === oldId ? updatedCard : c));
        setFormData(updatedCard);
        setSelectedCardId(newId);
      } else {
        throw new Error(json.error);
      }
    } catch (e: any) {
      addToast({ type: 'error', message: '新增失敗，請檢查網路或金鑰: ' + e.message });
    } finally {
      setIsNotionLoading(false);
    }
  }, [addToast, ensureFirebaseImage, formData, setCards, setFormData, setSelectedCardId]);

  const handleSyncAllToNotion = useCallback(async () => {
    const unsyncedCards = cards.filter(c => c.syncStatus !== 'notion');
    if (unsyncedCards.length === 0) {
      addToast({ type: 'info', message: '🎉 所有名片都已經新增到 Notion 囉！' });
      return;
    }

    if (!window.confirm(`準備將 ${unsyncedCards.length} 筆名片新增到 Notion，這可能需要一點時間，確定要繼續嗎？`)) {
      return;
    }

    setIsSyncingAll(true);
    setSyncProgress({ current: 0, total: unsyncedCards.length });
    let successCount = 0;
    let completedCount = 0;
    let cursorIdx = 0;

    try {
      const worker = async () => {
        while (true) {
          const i = cursorIdx++;
          if (i >= unsyncedCards.length) break;

          const card = unsyncedCards[i];
          try {
            const oldImageId = card.imageId;
            const cardToSync = await ensureFirebaseImage(card, true);
            const res = await fetch('/api/notion/save', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...cardToSync, oldImageId })
            });
            const json = await res.json();
            if (json.success) {
              const oldId = cardToSync.id;
              const newId = json.notionId || oldId;
              const updatedCard: BusinessCardData = {
                ...cardToSync,
                id: newId,
                syncStatus: 'notion'
              };

              await saveCardToDB(updatedCard);
              if (newId !== oldId) {
                await deleteCardFromDB(oldId);
              }

              setCards(prev => prev.map(c => c.id === oldId ? updatedCard : c));
              successCount++;
            }
          } catch (innerE) {
            console.error(`Failed to sync card ${card.id}:`, innerE);
          } finally {
            completedCount++;
            setSyncProgress({ current: completedCount, total: unsyncedCards.length });
            // Respect Notion ~3 req/s rate limit across workers
            await new Promise(r => setTimeout(r, 350));
          }
        }
      };

      const workerCount = Math.min(NOTION_SYNC_CONCURRENCY, unsyncedCards.length);
      await Promise.all(Array.from({ length: workerCount }, () => worker()));

      addToast({ type: 'success', message: `同步完成！成功同步 ${successCount} 筆。` });
    } catch (e: any) {
      addToast({ type: 'error', message: '同步過程發生錯誤: ' + e.message });
    } finally {
      setIsSyncingAll(false);
      setSyncProgress(null);
    }
  }, [addToast, cards, ensureFirebaseImage, setCards]);

  return {
    isNotionLoading,
    isSyncingAll,
    notionProgress,
    syncProgress,
    handleLoadFromNotion,
    handleSaveToNotion,
    handleSyncAllToNotion,
    deleteFromNotion
  };
};
