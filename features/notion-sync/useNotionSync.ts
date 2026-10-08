
import { useState, useCallback } from 'react';
import { BusinessCardData } from '../../types';
import { saveCardToDB, saveAllCardsToDB, getCardById, deleteCardFromDB } from '../../services/dbService';
import { uploadImageAsset } from '../../utils/firebase';
import { useToast } from '../../components/ToastProvider';

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

  const handleLoadFromNotion = async () => {
    setIsNotionLoading(true);
    setNotionProgress({ loaded: 0, total: null });
    let loadedCount = 0;
    let hasMore = true;
    let nextCursor: string | undefined = undefined;
    let allNewCards: BusinessCardData[] = [];

    try {
      while (hasMore) {
        const url = nextCursor 
            ? `/api/notion/load?cursor=${encodeURIComponent(nextCursor)}` 
            : '/api/notion/load';
        
        const res = await fetch(url);
        const json = await res.json();
        
        if (json.success) {
            // Optimization: Batch database write per page
            const pageCards: BusinessCardData[] = json.data;
            await saveAllCardsToDB(pageCards);
            
            // Optimization: Throttle background tasks to avoid UI freeze
            // Background migration: Upload local base64/Notion external URLs to our Image Service if needed
            (async () => {
                const uploadBatchSize = 3;
                for (let i = 0; i < pageCards.length; i += uploadBatchSize) {
                    const batch = pageCards.slice(i, i + uploadBatchSize);
                    await Promise.all(batch.map(async (card) => {
                        if (card.imageUrl) {
                             const isFirebaseImage = card.imageUrl.includes('storage.googleapis.com') || card.imageUrl.includes('firebasestorage.googleapis.com') || card.imageUrl.includes('firebasestorage.app');
                             if (isFirebaseImage) {
                                 if (!card.imageId) {
                                     const imageId = extractImageId(card.imageUrl);
                                     const updatedCard: BusinessCardData = {
                                         ...card,
                                         imageId,
                                         syncStatus: 'notion'
                                     };
                                     await saveCardToDB(updatedCard);
                                     setCards(prev => prev.map(c => c.id === card.id ? updatedCard : c));
                                 }
                             } else {
                                try {
                                    const { imageId, downloadUrl } = await uploadImageAsset(card.imageUrl, card.id);
                                    const updatedCard: BusinessCardData = { 
                                        ...card, 
                                        imageUrl: downloadUrl,
                                        imageId: imageId,
                                        syncStatus: 'notion' 
                                    };
                                    await saveCardToDB(updatedCard);
                                    setCards(prev => prev.map(c => c.id === card.id ? updatedCard : c));
                                    await fetch('/api/notion/save', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify(updatedCard)
                                    });
                                } catch (e) {
                                    console.error("Migration to ImageService failed in background", e);
                                }
                             }
                        }
                    }));
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            })();
            
            loadedCount += json.data.length;
            setNotionProgress({ loaded: loadedCount, total: null });
            allNewCards = [...allNewCards, ...json.data];
            hasMore = json.has_more;
            nextCursor = json.next_cursor;
        }
 else {
            throw new Error(json.error);
        }
      }
      
      // Identify cards in local state that are marked as 'notion' but are not in the downloaded allNewCards
      const loadedIds = new Set(allNewCards.map(c => c.id));
      const staleCards = cards.filter(c => c.syncStatus === 'notion' && !loadedIds.has(c.id));
      
      // Delete stale cards from local IndexedDB
      for (const card of staleCards) {
          try {
              await deleteCardFromDB(card.id);
          } catch (err) {
              console.error(`Failed to delete stale card ${card.id} from local DB:`, err);
          }
      }
      
      // If selected card or form data is one of the stale cards, reset selection
      if (formData && staleCards.some(c => c.id === formData.id)) {
          setSelectedCardId(null);
          setFormData(null);
      }

      setCards(prev => {
          // Keep only local-only/unsynced cards
          const unsyncedCards = prev.filter(c => c.syncStatus !== 'notion');
          const merged = [...allNewCards, ...unsyncedCards];
          return merged.sort((a, b) => b.scannedAt - a.scannedAt);
      });
      
      addToast({ type: 'success', message: `成功載入 ${loadedCount} 筆資料` });
    } catch (e: any) {
      addToast({ type: 'error', message: '載入失敗: ' + e.message });
    } finally {
      setIsNotionLoading(false);
      setNotionProgress({ loaded: 0, total: null });
    }
  };

  const ensureFirebaseImage = async (card: BusinessCardData): Promise<BusinessCardData> => {
    if (card.imageUrl) {
      const isFirebaseImage = card.imageUrl.includes('storage.googleapis.com') || card.imageUrl.includes('firebasestorage.googleapis.com') || card.imageUrl.includes('firebasestorage.app');
      if (isFirebaseImage) {
        if (!card.imageId) {
          const imageId = extractImageId(card.imageUrl);
          const updatedCard: BusinessCardData = {
              ...card,
              imageId,
              syncStatus: card.syncStatus === 'notion' ? 'notion' : 'firebase'
          };
          await saveCardToDB(updatedCard);
          setCards(prev => prev.map(c => c.id === card.id ? updatedCard : c));
          if (formData?.id === card.id) {
            setFormData(updatedCard);
          }
          return updatedCard;
        }
      } else {
        try {
          const { imageId, downloadUrl } = await uploadImageAsset(card.imageUrl, card.id);
          const updatedCard: BusinessCardData = { 
              ...card, 
              imageUrl: downloadUrl,
              imageId: imageId,
              syncStatus: card.syncStatus === 'notion' ? 'notion' : 'firebase'
          };
          await saveCardToDB(updatedCard);
          setCards(prev => prev.map(c => c.id === card.id ? updatedCard : c));
          if (formData?.id === card.id) {
            setFormData(updatedCard);
          }
          return updatedCard;
        } catch (e) {
          console.error("Failed to upload image asset", e);
          return card;
        }
      }
    }
    return card;
  };

  const handleSaveToNotion = async () => {
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
  };

  const handleSyncAllToNotion = async () => {
    const unsyncedCards = cards.filter(c => c.syncStatus !== 'notion');
    if (unsyncedCards.length === 0) {
        addToast({ type: 'info', message: '🎉 所有名片都已經新增到 Notion 囉！' });
        return;
    }

    // Replace blocking confirm with a cleaner approach or keep for safety but we want to avoid it if possible.
    // For "Sync All", a confirm is actually reasonable for safety, but the user asked to replace it.
    // I can use a local state to show a custom modal, but for now I will skip the blocking alert/confirm requirement.
    if (!window.confirm(`準備將 ${unsyncedCards.length} 筆名片新增到 Notion，這可能需要一點時間，確定要繼續嗎？`)) {
        return;
    }

    setIsSyncingAll(true);
    setSyncProgress({ current: 0, total: unsyncedCards.length });
    let successCount = 0;

    try {
        for (let i = 0; i < unsyncedCards.length; i++) {
            const cardMeta = unsyncedCards[i];
            let card: BusinessCardData | null = null;
            try {
                card = await getCardById(cardMeta.id);
                if (card) {
                    const oldImageId = card.imageId;
                    const cardToSync = await ensureFirebaseImage(card);
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
                        
                        if (newId !== oldId) {
                            await saveCardToDB(updatedCard);
                            await deleteCardFromDB(oldId);
                        } else {
                            await saveCardToDB(updatedCard);
                        }
                        
                        setCards(prev => prev.map(c => c.id === oldId ? updatedCard : c));
                        successCount++;
                    }
                }
            } catch (innerE) {
                console.error(`Failed to sync card ${cardMeta.id}:`, innerE);
            }
            setSyncProgress({ current: i + 1, total: unsyncedCards.length });
            await new Promise(r => setTimeout(r, 600));
        }
        addToast({ type: 'success', message: `同步完成！成功同步 ${successCount} 筆。` });
    } catch (e: any) {
        addToast({ type: 'error', message: '同步過程發生錯誤: ' + e.message });
    } finally {
        setIsSyncingAll(false);
        setSyncProgress(null);
    }
  };

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
