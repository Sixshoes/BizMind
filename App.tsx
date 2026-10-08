
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { BusinessCardData, ProcessingTask, ExportMode, SearchPageState } from './types';
import { filterCards, FilterIntent } from './utils/cardFilters';
import { normalizeCountry, STANDARD_COUNTRIES, getCountryBilingualLabel, STANDARD_COUNTRY_OPTIONS } from './utils/countries';
import { detectBusinessCards } from './services/geminiService';
import CameraScanner from './components/CameraScanner';
import EditableField from './components/EditableField';
import PanZoomImage from './components/PanZoomImage';
import SearchPage from './components/SearchPage';
import { getCardById, saveCardToDB, deleteCardFromDB, clearAllCardsFromDB } from './services/dbService';
import { deleteImageFromFirebase, cleanupOrphanedImages } from './utils/firebase';
import { createVCardFile } from './services/vcardService';
import * as pdfjsLib from 'pdfjs-dist';
import { useToast } from './components/ToastProvider';
import { Check, Trash2, Smartphone, Monitor, Info, Loader2, RefreshCcw, Download } from 'lucide-react';

// New Modular Hooks
import { useCardState } from './hooks/useCardState';
import { useNotionSync } from './features/notion-sync/useNotionSync';
import { useImportExport } from './features/import-export/useImportExport';
import { useScanPipeline } from './features/scan-pipeline/useScanPipeline';
import { useBackgroundTasks } from './hooks/useBackgroundTasks';

// New Components
import { TourOverlay, TourStep } from './components/TourOverlay';
import { QsConfirmationModal } from './components/QsConfirmationModal';
import { DuplicateManagerModal } from './components/DuplicateManagerModal';
import { NotionTrashModal } from './components/NotionTrashModal';
import { analyzeDuplicates, mergeDuplicateCards } from './utils/duplicateUtils';
import { SidebarCardItem } from './components/SidebarCardItem';
import { CardThumbnail } from './components/CardThumbnail';

// Config PDF.js worker
const pdfjs = (pdfjsLib as any).default || pdfjsLib;
if (pdfjs.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.js',
        import.meta.url
    ).toString();
}

type ViewMode = 'camera' | 'file' | 'detail' | 'cropper' | 'search';

interface CropRegion {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const App: React.FC = () => {
  // --- Core State Hook ---
  const {
    cards, setCards, cardsRef,
    selectedCardId, setSelectedCardId, selectCard,
    formData, setFormData, isFormDirty, setIsFormDirty,
    tasks, setTasks,
    updateCardInList
  } = useCardState();

  // --- UI & UI Control State ---
  const [viewMode, setViewMode] = useState<ViewMode>('search');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [activeCategory, setActiveCategory] = useState<'all' | 'employer' | 'academic' | 'staff' | 'other'>('all');
  const [activeCountry, setActiveCountry] = useState<string>('all');
  const [showQsFilters, setShowQsFilters] = useState(false);
  const [showCountryFilters, setShowCountryFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [externalChatQuery, setExternalChatQuery] = useState<string | null>(null);
  const [isCleaningFirebase, setIsCleaningFirebase] = useState(false);
  const [showNotionPrompt, setShowNotionPrompt] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showMobileUploadHint, setShowMobileUploadHint] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState<number>(-1);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);

  // --- Modals / Prompts State ---
  const [duplicatePrompt, setDuplicatePrompt] = useState<any>(null);
  const [duplicateFilePrompt, setDuplicateFilePrompt] = useState<any>(null);
  const [showDuplicateManager, setShowDuplicateManager] = useState(false);
  const [showNotionTrashModal, setShowNotionTrashModal] = useState(false);
  const [isDeduplicating, setIsDeduplicating] = useState(false);
  const [sidebarDisplayLimit, setSidebarDisplayLimit] = useState(60);

  // --- QS Selection & Review State ---
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
  const [isQsModalOpen, setIsQsModalOpen] = useState(false);

  // --- Search / Database Page Persistent State ---
  const [searchPageState, setSearchPageState] = useState<SearchPageState>({
    query: '',
    sortBy: 'name_asc',
    isGrouped: true,
    filterHasEmail: false,
    filterHasPhone: false,
    filterCategory: 'all',
    filterCountry: 'all'
  });
  const [openedFromSearch, setOpenedFromSearch] = useState(false);

  // --- Refs ---
  const filesMap = useRef<Map<string, File | Blob>>(new Map());
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const shareMenuRef = useRef<HTMLDivElement>(null);

  // --- Feature Hooks ---
  const { bgTaskCount, runBackgroundSummaryCheck } = useBackgroundTasks(setCards, setFormData);

  const {
    isNotionLoading, isSyncingAll, notionProgress, syncProgress,
    handleLoadFromNotion, handleSaveToNotion, handleSyncAllToNotion, deleteFromNotion
  } = useNotionSync(cards, setCards, formData, setFormData, setSelectedCardId);

  const {
    isExporting, handleExport, handleJsonImport, handleCsvImport
  } = useImportExport(cards, setCards, formData, isMobile, runBackgroundSummaryCheck);

  const {
    isProcessing, isQueuePaused, setIsQueuePaused, handleRetryTask, processBatchFiles
  } = useScanPipeline(cardsRef, setCards, tasks, setTasks, filesMap, setDuplicatePrompt, setDuplicateFilePrompt);
  const { addToast } = useToast();

  // --- Cropper State ---
  const [cropperImage, setCropperImage] = useState<string | null>(null);
  const [cropRegions, setCropRegions] = useState<CropRegion[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [isResizing, setIsResizing] = useState<string | null>(null); 
  const [activeCropId, setActiveCropId] = useState<string | null>(null);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [initialRect, setInitialRect] = useState<CropRegion | null>(null);
  const [currentRect, setCurrentRect] = useState<CropRegion | null>(null);
  const cropperImgRef = useRef<HTMLImageElement>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPdfPage, setCurrentPdfPage] = useState(1);
  const [isRenderingPdf, setIsRenderingPdf] = useState(false);
  const [isAiDetecting, setIsAiDetecting] = useState(false);
  const [cropperTransform, setCropperTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [isCropperPanning, setIsCropperPanning] = useState(false);
  const cropperDragStart = useRef({ x: 0, y: 0 });

  // --- Computed Values ---
  const activeTasks = useMemo(() => tasks, [tasks]);

  const duplicateAnalysis = useMemo(() => {
      return analyzeDuplicates(cards);
  }, [cards]);

  const duplicateIds = useMemo(() => {
      return duplicateAnalysis.duplicateCardIds;
  }, [duplicateAnalysis]);

  const sidebarCountries = useMemo(() => {
      const map = new Map<string, number>();
      cards.forEach(c => {
          const rawCtry = (c.country || c.translations?.country || '').trim();
          const ctry = normalizeCountry(rawCtry);
          if (ctry) {
              map.set(ctry, (map.get(ctry) || 0) + 1);
          }
      });
      return Array.from(map.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-Hant'));
  }, [cards]);

  const visibleCards = useMemo(() => {
      const filtered = filterCards(cards, {
          searchText: searchQuery,
          category: activeCategory,
          country: activeCountry
      });
      return [...filtered].sort((a, b) => {
          const aDup = duplicateIds.has(a.id);
          const bDup = duplicateIds.has(b.id);
          const aUnsynced = a.syncStatus !== 'notion';
          const bUnsynced = b.syncStatus !== 'notion';

          const aSpecial = aDup || aUnsynced;
          const bSpecial = bDup || bUnsynced;

          if (aSpecial && !bSpecial) return -1;
          if (!aSpecial && bSpecial) return 1;

          // If both have a special status, prioritize duplicates first, then unsynced
          if (aSpecial && bSpecial) {
              if (aDup && !bDup) return -1;
              if (!aDup && bDup) return 1;
              if (aUnsynced && !bUnsynced) return -1;
              if (!aUnsynced && bUnsynced) return 1;
          }

          return b.scannedAt - a.scannedAt;
      });
  }, [cards, activeCategory, activeCountry, searchQuery, duplicateIds]);

  // --- Effects & Lifecycle ---
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    const handleClickOutside = (event: MouseEvent) => {
        if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) setShowExportMenu(false);
        if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target as Node)) setShowSettingsMenu(false);
        if (shareMenuRef.current && !shareMenuRef.current.contains(event.target as Node)) setShowShareMenu(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
            event.preventDefault();
            setViewMode(prev => prev === 'search' ? 'detail' : 'search');
        }
    };
    window.addEventListener('resize', handleResize);
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    
    const hasVisited = localStorage.getItem('qs_scanner_v1_visited');
    if (!hasVisited) {
        setTimeout(() => setTourStepIndex(0), 1000);
    } else {
        setTimeout(() => setShowNotionPrompt(true), 500);
    }
    
    return () => {
        window.removeEventListener('resize', handleResize);
        document.removeEventListener('mousedown', handleClickOutside);
        window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (selectedCardId && viewMode !== 'search') {
      setTimeout(() => {
        const el = document.getElementById(`card-list-item-${selectedCardId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);
    }
  }, [selectedCardId, viewMode]);

  // --- Handlers ---
  const updateField = (field: keyof BusinessCardData, value: any) => {
    if (!formData) return;
    setFormData({ ...formData, [field]: value });
    setIsFormDirty(true);
  };

  const handleSave = async () => {
      if (!formData) return;
      const normalizedData: BusinessCardData = {
          ...formData,
          country: normalizeCountry(formData.country),
          translations: formData.translations ? {
              ...formData.translations,
              country: formData.translations.country ? normalizeCountry(formData.translations.country) : ''
          } : undefined
      };
      await saveCardToDB(normalizedData);
      updateCardInList(normalizedData);
      setFormData(normalizedData);
      setIsFormDirty(false);
      
      if (normalizedData.syncStatus === 'notion') {
          handleSaveToNotion(); // Use hook version
      }

      const btn = document.getElementById('save-btn');
      if (btn) {
          const originalText = btn.innerHTML;
          btn.innerHTML = '<i class="fa-solid fa-check"></i>';
          setTimeout(() => btn.innerHTML = originalText, 2000);
      }
  };

  const handleQuickCategoryChange = useCallback(async (cardId: string, newCategory: 'employer' | 'academic' | 'staff' | 'other') => {
      const cardToUpdate = cards.find(c => c.id === cardId);
      if (!cardToUpdate) return;
      const updatedCard: BusinessCardData = { ...cardToUpdate, category: newCategory };
      await saveCardToDB(updatedCard);
      updateCardInList(updatedCard);
      if (formData && formData.id === cardId) {
          setFormData(updatedCard);
      }
      const labelMap = {
          employer: '🏢 QS 雇主 (Employer)',
          academic: '🎓 QS 學者 (Academic)',
          staff: '🤝 QS 職員 (Staff)',
          other: '🚫 非 QS (Not QS)'
      };
      addToast({
          type: 'success',
          message: `已將分類切換為「${labelMap[newCategory]}」`
      });
  }, [cards, formData, addToast, updateCardInList]);

  const handleStandardizeAllCountries = useCallback(async () => {
      let modifiedCount = 0;
      const updatedCards = cards.map(c => {
          const origC = c.country || '';
          const origTrans = c.translations?.country || '';
          const effectiveC = origC || origTrans;
          const normC = normalizeCountry(effectiveC);
          const normTrans = origTrans ? normalizeCountry(origTrans) : '';

          const changed = (!origC && normC) || (origC && origC !== normC) || (origTrans && origTrans !== normTrans);
          if (changed) {
              modifiedCount++;
              return {
                  ...c,
                  country: normC,
                  translations: c.translations ? {
                      ...c.translations,
                      country: normTrans || normC || c.translations.country
                  } : undefined
              };
          }
          return c;
      });

      if (modifiedCount === 0) {
          addToast({
              type: 'info',
              message: '目前所有名片的國家名稱均已符合 QS 197 國標準（包含 Taiwan 統一為 Taiwan SAR）！'
          });
          return;
      }

      try {
          for (const card of updatedCards) {
              await saveCardToDB(card);
          }
          setCards(updatedCards);
          if (formData) {
              const currentUpdated = updatedCards.find(c => c.id === formData.id);
              if (currentUpdated) setFormData(currentUpdated);
          }
          addToast({
              type: 'success',
              message: `成功將 ${modifiedCount} 筆名片的國家名稱整合為 QS 標準格式 (統一 Taiwan SAR)！`
          });
      } catch (err: any) {
          addToast({
              type: 'error',
              message: `標準化失敗：${err.message}`
          });
      }
  }, [cards, formData, addToast, setCards]);

  const handleDeleteCard = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    
    if (!window.confirm("確定要移除這筆資料嗎？")) {
      return;
    }
    
    // Find card from local state or DB
    const cardToDelete = cards.find(c => c.id === id) || (await getCardById(id));
    if (!cardToDelete) return;

    // Capture state for undo
    const originalCards = [...cards];
    const originalFormData = formData;
    const originalSelectedId = selectedCardId;
    const originalViewMode = viewMode;

    let isUndone = false;

    // Optimistic UI delete
    setCards(prev => prev.filter(c => c.id !== id));
    if (selectedCardId === id) {
      setSelectedCardId(null);
      setFormData(null);
      setViewMode('file');
    }

    // Immediately remove from local DB so page refresh or sync won't bring it back
    try {
      await deleteCardFromDB(id);
    } catch (err) {
      console.error('Error deleting from local DB:', err);
    }

    addToast({
      type: 'info',
      message: `已移除 ${cardToDelete.lastName || ''}${cardToDelete.firstName || ''} 的資料`,
      duration: 5000,
      onUndo: async () => {
        isUndone = true;
        // Restore to local DB
        try {
          await saveCardToDB(cardToDelete);
        } catch (err) {
          console.error('Error restoring card to DB:', err);
        }
        setCards(originalCards);
        setFormData(originalFormData);
        setSelectedCardId(originalSelectedId);
        setViewMode(originalViewMode);
      }
    });

    // If card was synced to Notion, delete from Notion after undo window expires
    setTimeout(async () => {
      if (!isUndone && cardToDelete.syncStatus === 'notion') {
        try {
          await deleteFromNotion(id, cardToDelete.imageId, `${cardToDelete.lastName || ''}${cardToDelete.firstName || ''}`);
        } catch (err) {
          console.error('Error deleting from Notion:', err);
        }
      }
    }, 5500);
  };

  const handleClearAll = async () => {
    if (cards.length === 0) return;
    
    // Using custom modal or just keeping confirm for "DANGEROUS" destructive actions
    if (!window.confirm("⚠️ 警告：這將會永久刪除所有紀錄！此動作無法復原。")) return;
    
    const success = await clearAllCardsFromDB();
    if (success) {
      addToast({ type: 'success', message: '已清除所有本地資料' });
      setCards([]);
      setSelectedCardId(null);
      setFormData(null);
      setViewMode('file');
    }
  };

  const handleFindDuplicates = () => {
      if (duplicateAnalysis.groups.length === 0) {
          addToast({ type: 'success', message: '🎉 恭喜！您的名片庫非常乾淨，沒有發現任何重複名片。' });
          return;
      }
      setShowDuplicateManager(true);
      setShowSettingsMenu(false);
  };

  const handleAutoDeduplicate = async (customKeepMap?: Map<string, string>) => {
      const analysis = analyzeDuplicates(cards);
      if (analysis.groups.length === 0) {
          addToast({ type: 'success', message: '🎉 名片庫非常乾淨，沒有發現重複名片！' });
          return;
      }

      const keepMap = customKeepMap || analysis.recommendedKeep;
      const totalToDelete = analysis.totalDuplicateCount;

      if (!customKeepMap) {
          if (!window.confirm(`⚠️ 系統偵測到 ${analysis.groups.length} 組重複名片 (共 ${totalToDelete} 張冗餘資料)。\n\n執行「自動清理」將會：\n1. 智慧保留每組資訊最完整、最新的主名片\n2. 自動將重複名片的電話、Email、備註與次數智慧合併至主名片中\n3. 安全刪除多餘的重複名片\n\n確定要立即執行自動清理嗎？`)) {
              return;
          }
      }

      setIsDeduplicating(true);
      addToast({ type: 'info', message: `正在智慧整合並清理 ${totalToDelete} 張重複名片...` });

      try {
          let updatedCardsList = [...cards];
          const allDeletedIds = new Set<string>();

          for (const group of analysis.groups) {
              const keepCardId = keepMap.get(group.id) || group.primaryCardId;
              const primaryCard = group.cards.find(c => c.id === keepCardId) || group.cards[0];
              const redundantCards = group.cards.filter(c => c.id !== primaryCard.id);

              if (redundantCards.length === 0) continue;

              // 1. Merge complementary info into primaryCard
              const mergedPrimary = mergeDuplicateCards(primaryCard, redundantCards);
              await saveCardToDB(mergedPrimary);

              // Update primary in list
              updatedCardsList = updatedCardsList.map(c => c.id === mergedPrimary.id ? mergedPrimary : c);

              // 2. Delete redundants
              for (const red of redundantCards) {
                  allDeletedIds.add(red.id);
                  try {
                      if (red.syncStatus === 'notion') {
                          await deleteFromNotion(red.id, red.imageId, `${red.lastName || ''}${red.firstName || ''}`);
                      }
                      await deleteCardFromDB(red.id);
                  } catch (err) {
                      console.error(`Error deleting redundant card ${red.id}:`, err);
                  }
              }
          }

          // Finalize state
          const finalizedCards = updatedCardsList.filter(c => !allDeletedIds.has(c.id));
          setCards(finalizedCards);

          if (selectedCardId && allDeletedIds.has(selectedCardId)) {
              setSelectedCardId(null);
              setFormData(null);
          } else if (formData) {
              const refreshed = finalizedCards.find(c => c.id === formData.id);
              if (refreshed) setFormData(refreshed);
          }

          setShowDuplicateManager(false);
          addToast({ 
              type: 'success', 
              message: `✨ 已成功自動清理 ${allDeletedIds.size} 張重複名片！資料已智慧整合完畢。` 
          });
      } catch (err: any) {
          console.error('Error during auto-deduplication:', err);
          addToast({ type: 'error', message: `自動清理失敗: ${err.message || '未知錯誤'}` });
      } finally {
          setIsDeduplicating(false);
      }
  };

  const handleDeleteDuplicateSingle = async (cardId: string) => {
      if (!confirm('確定要刪除這張重複名片嗎？此動作無法復原。')) return;
      
      const cardToDelete = cards.find(c => c.id === cardId) || (await getCardById(cardId));
      if (cardToDelete?.syncStatus === 'notion') {
          await deleteFromNotion(cardId, cardToDelete?.imageId);
      }
      await deleteCardFromDB(cardId);
      setCards(prev => prev.filter(c => c.id !== cardId));
      if (selectedCardId === cardId) {
          setSelectedCardId(null);
          setFormData(null);
      }
      addToast({ type: 'success', message: '已刪除該筆重複名片' });
  };

  const handleBatchDeleteDuplicateCards = async (cardIds: string[]) => {
      if (cardIds.length === 0) return;
      if (!confirm(`確定要刪除選取的 ${cardIds.length} 張名片嗎？此動作無法復原。`)) return;

      setIsDeduplicating(true);
      const idSet = new Set(cardIds);
      for (const cardId of cardIds) {
          const cardToDelete = cards.find(c => c.id === cardId) || (await getCardById(cardId));
          if (cardToDelete?.syncStatus === 'notion') {
              await deleteFromNotion(cardId, cardToDelete?.imageId);
          }
          await deleteCardFromDB(cardId);
      }

      setCards(prev => prev.filter(c => !idSet.has(c.id)));
      if (selectedCardId && idSet.has(selectedCardId)) {
          setSelectedCardId(null);
          setFormData(null);
      }
      setIsDeduplicating(false);
      addToast({ type: 'success', message: `✅ 已成功刪除 ${cardIds.length} 張重複名片！` });
  };

  const handleRemoveNoImageCards = async () => {
      const noImageCards = cards.filter(c => !c.imageUrl || c.imageUrl.trim() === '');
      if (noImageCards.length === 0) {
          addToast({ type: 'success', message: '🎉 恭喜！所有名片都包含圖片，沒有發現無圖片名片。' });
          return;
      }
      if (!window.confirm(`⚠️ 確定要刪除這 ${noImageCards.length} 張沒有圖片的名片嗎？\n此動作會同步從本地及 Notion（若已同步）移除。`)) return;

      const idsToRemove = noImageCards.map(c => c.id);
      
      // Update state optimistically
      setCards(prev => prev.filter(c => !idsToRemove.includes(c.id)));
      if (selectedCardId && idsToRemove.includes(selectedCardId)) {
          setSelectedCardId(null);
          setFormData(null);
          setViewMode('file');
      }

      addToast({ type: 'info', message: `正在移除 ${noImageCards.length} 張無圖片名片...` });

      // Run deletion in background/sequence
      let deletedCount = 0;
      for (const card of noImageCards) {
          try {
              await deleteFromNotion(card.id, card.imageId, `${card.lastName || ''}${card.firstName || ''}`);
              await deleteCardFromDB(card.id);
              deletedCount++;
          } catch (e) {
              console.error(`Failed to delete card ${card.id}:`, e);
          }
      }

      addToast({ type: 'success', message: `✅ 已成功移除 ${deletedCount} 張沒有圖片的名片！` });
      setShowSettingsMenu(false);
  };

  const handleCleanupFirebase = async () => {
      if (!confirm("這將會掃描並清理所有「引用數為 0」且已過保留期的圖片。\n\n確定要執行嗎？")) return;

      setIsCleaningFirebase(true);
      try {
          const res = await fetch('/api/images/gc', { method: 'POST' });
          const data = await res.json();
          if (data.success) {
            addToast({ type: 'success', message: `清理完成！成功刪除 ${data.deletedCount} 張無效圖片。` });
          } else {
            throw new Error(data.error);
          }
      } catch (e: any) {
          addToast({ type: 'error', message: "清理失敗: " + e.message });
      } finally {
          setIsCleaningFirebase(false);
          setShowSettingsMenu(false);
      }
  };

  // --- QS Selection & Batch Handlers ---
  const handleToggleCardSelect = useCallback((id: string) => {
    setSelectedCardIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelectBatch = useCallback((ids: string[]) => {
    setSelectedCardIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.add(id));
      return next;
    });
    addToast({ type: 'info', message: `已勾選 ${ids.length} 筆 QS 聯絡人` });
  }, [addToast]);

  const handleSelectCategory = useCallback((cat: 'employer' | 'academic' | 'staff' | 'all') => {
    const matching = cards.filter(c => cat === 'all' ? (c.category !== 'other') : (c.category === cat));
    const ids = matching.map(c => c.id);
    setSelectedCardIds(new Set(ids));
    const label = cat === 'all' ? '所有 QS' : cat === 'employer' ? 'QS 雇主' : cat === 'academic' ? 'QS 學者' : 'QS 職員';
    addToast({ type: 'info', message: `已選取全部 ${label} 名單 (${ids.length} 位)` });
  }, [cards, addToast]);

  const handleDeselectAll = useCallback(() => {
    setSelectedCardIds(new Set());
    addToast({ type: 'info', message: "已清除所有勾選" });
  }, [addToast]);

  const handleUpdateCardCategory = useCallback(async (id: string, newCategory: 'employer' | 'academic' | 'staff' | 'other') => {
    const card = cards.find(c => c.id === id);
    if (!card) return;
    const updated = { ...card, category: newCategory };
    await saveCardToDB(updated);
    setCards(prev => prev.map(c => c.id === id ? updated : c));
    if (formData && formData.id === id) {
      setFormData(updated);
    }
    const catName = newCategory === 'employer' ? 'QS 雇主' : newCategory === 'academic' ? 'QS 學者' : newCategory === 'staff' ? 'QS 職員' : 'Not QS';
    addToast({ type: 'success', message: `已將分類更新為「${catName}」` });
  }, [cards, formData, setCards, setFormData, addToast]);

  const handleStandardizeSelectedCountries = useCallback(async () => {
    let count = 0;
    const updatedCards = [...cards];
    for (let i = 0; i < updatedCards.length; i++) {
      const c = updatedCards[i];
      if (selectedCardIds.has(c.id)) {
        const norm = normalizeCountry(c.country || c.translations?.country || '');
        if (norm && norm !== c.country) {
          const updated = { ...c, country: norm };
          if (updated.translations?.country) {
            updated.translations.country = norm;
          }
          await saveCardToDB(updated);
          updatedCards[i] = updated;
          count++;
        }
      }
    }
    if (count > 0) {
      setCards(updatedCards);
      if (formData && selectedCardIds.has(formData.id)) {
        const currentUpdated = updatedCards.find(c => c.id === formData.id);
        if (currentUpdated) setFormData(currentUpdated);
      }
      addToast({ type: 'success', message: `已將 ${count} 筆已勾選名片的國家名稱標準化為 QS 規範格式！` });
    } else {
      addToast({ type: 'info', message: "已選名片的國家名稱均已符合標準" });
    }
  }, [cards, selectedCardIds, formData, setCards, setFormData, addToast]);

  const handleExportCustomList = useCallback(async (mode: ExportMode, selectedCards: BusinessCardData[]) => {
    await handleExport(mode, selectedCards);
  }, [handleExport]);

  // --- Mobile Share Handler ---
  const handleShare = async (withSummary: boolean) => {
      if (!formData) return;
      const cardToShare = { ...formData };
      if (!withSummary) {
          cardToShare.summary = '';
      }

      try {
          const vCardFile = createVCardFile([cardToShare]);
          if (navigator.canShare && navigator.canShare({ files: [vCardFile] })) {
              await navigator.share({
                  files: [vCardFile],
                  title: `${cardToShare.lastName || ''}${cardToShare.firstName || ''} 的名片`,
                  text: '透過 EcoScan 分享的名片'
              });
              return;
          }
      } catch (err) {
          console.warn('vCard file share not supported or failed, falling back to text.', err);
      }

      let shareText = '';
      if (withSummary && formData.summary) {
          shareText += `${formData.summary}\n\n`;
      }
      shareText += `姓名: ${formData.lastName || ''}${formData.firstName || ''}\n` +
          `公司: ${formData.company || ''}\n` +
          `職稱: ${formData.title || ''}\n` +
          (formData.phone ? `電話: ${formData.phone}\n` : '') +
          (formData.email ? `信箱: ${formData.email}\n` : '');
      
      if (withSummary && formData.summary) {
          shareText += `\n(⚠️ AI 生成說明僅供參考，請務必查證)`;
      }

      if (navigator.share) {
          try {
              await navigator.share({
                  title: `${formData.lastName || ''}${formData.firstName || ''}`,
                  text: shareText
              });
          } catch (err) {
              console.warn('Share cancelled or failed', err);
          }
      } else {
          navigator.clipboard.writeText(shareText);
          addToast({ type: 'info', message: "已複製到剪貼簿 (您的裝置不支援檔案分享)" });
      }
  };

  const processFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    // JSON Restore
    if (files.length === 1 && files[0].name.toLowerCase().endsWith('.json')) {
        await handleJsonImport(files[0]);
        setShowMobileUploadHint(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
    }
    
    // CSV Restore
    if (files.length === 1 && files[0].name.toLowerCase().endsWith('.csv')) {
        await handleCsvImport(files[0]);
        setShowMobileUploadHint(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
    }
    
    // Legacy Excel Check
    if (files.length === 1 && files[0].name.endsWith('.xlsx')) {
        addToast({ 
            type: 'error', 
            message: "⚠️ 錯誤：系統不再支援 Excel 還原備份。請使用 .json 或 .csv 格式的備份檔以確保圖片能正確恢復。" 
        });
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
    }

    const firstFile = files[0];
    
    // PDF / Single Image for Cropper
    if (firstFile.type === 'application/pdf') {
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const typedarray = new Uint8Array(ev.target?.result as ArrayBuffer);
            try {
                const pdf = await pdfjs.getDocument(typedarray).promise;
                setPdfDoc(pdf); setCurrentPdfPage(1); await renderPdfPage(pdf, 1);
                setViewMode('cropper');
                setShowMobileUploadHint(false);
            } catch (err) { addToast({ type: 'error', message: "PDF 解析失敗" }); }
        };
        reader.readAsArrayBuffer(firstFile);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
    }

    if (files.length === 1 && firstFile.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const b64 = event.target?.result as string;
            setCropperImage(b64); setCropRegions([]); setViewMode('cropper'); setCropperTransform({scale:1, x:0, y:0});
            autoDetectInCropper(b64.split(',')[1]);
        };
        reader.readAsDataURL(firstFile);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setShowMobileUploadHint(false);
        return;
    }

    // Batch Processing via Hook
    processBatchFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setShowMobileUploadHint(false);
  };

  // Drag & Drop
  const handleDragEnter = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current++;
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
          setIsDragOver(true);
      }
  };

  const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current--;
      if (dragCounter.current <= 0) {
          setIsDragOver(false);
          dragCounter.current = 0; // ensure reset
      }
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      dragCounter.current = 0;
      processFiles(e.dataTransfer.files);
  };

  // --- Cropper Functions ---
  const autoDetectInCropper = async (b64: string) => {
    setIsAiDetecting(true);
    try {
      const boxes = await detectBusinessCards(b64);
      if (boxes && boxes.length > 0) {
        setCropRegions(boxes.map(box => ({
          id: crypto.randomUUID(), x: (box.xmin/1000)*100, y: (box.ymin/1000)*100, w: ((box.xmax-box.xmin)/1000)*100, h: ((box.ymax-box.ymin)/1000)*100
        })));
      } else {
        addToast({ 
          type: 'info', 
          message: '未自動偵測到名片邊框。請在畫面上用滑鼠拖曳手動框選名片，或使用上方旋轉按鈕調整方向。' 
        });
      }
    } catch (e: any) { 
      console.warn(e); 
      addToast({
        type: 'error',
        message: e.message || 'AI 偵測連線失敗'
      });
    } finally { 
      setIsAiDetecting(false); 
    }
  };
  
  const renderPdfPage = async (pdf: any, pageNum: number) => {
    setIsRenderingPdf(true);
    try {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        canvas.height = viewport.height; canvas.width = viewport.width;
        const context = canvas.getContext('2d');
        if (context) {
            await page.render({ canvasContext: context, viewport }).promise;
            const b64 = canvas.toDataURL('image/jpeg');
            setCropperImage(b64); setCropRegions([]); setCropperTransform({scale:1, x:0, y:0});
            autoDetectInCropper(b64.split(',')[1]);
        }
    } catch (e) { addToast({ type: 'error', message: "無法讀取 PDF" }); } finally { setIsRenderingPdf(false); }
  };

  // Cropper Pan & Zoom Handlers
  const handleCropperWheel = (e: React.WheelEvent) => {
      e.preventDefault();
      const scaleChange = -e.deltaY * 0.001;
      setCropperTransform(prev => ({
          ...prev,
          scale: Math.min(Math.max(0.5, prev.scale + scaleChange), 5)
      }));
  };
  
  const handleCropperMouseDown = (e: React.MouseEvent) => {
      // Only pan if we are NOT clicking a crop region or a handle
      const target = e.target as HTMLElement;
      if (target.closest('.crop-box') || isDrawing || isMoving || isResizing) return;
      
      setIsCropperPanning(true);
      cropperDragStart.current = { x: e.clientX - cropperTransform.x, y: e.clientY - cropperTransform.y };
  };

  const handleCropperMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
      let clientX: number, clientY: number;

      if ('touches' in e) {
          if (e.touches.length === 0) return;
          clientX = e.touches[0].clientX;
          clientY = e.touches[0].clientY;
      } else {
          clientX = (e as React.MouseEvent).clientX;
          clientY = (e as React.MouseEvent).clientY;
      }

      if (isCropperPanning) {
          if (e.cancelable) e.preventDefault();
          setCropperTransform(prev => ({
              ...prev,
              x: clientX - cropperDragStart.current.x,
              y: clientY - cropperDragStart.current.y
          }));
          return;
      }
      handleCropMove(e); // Delegate to crop logic if not panning
  };

  const handleCropperMouseUp = () => {
      setIsCropperPanning(false);
      handleCropEnd();
  };

  // Crop Logic (Coordinate Calculation)
  const getMousePos = (e: React.MouseEvent | React.TouchEvent) => {
      if (!cropperImgRef.current) return { x: 0, y: 0 };
      const rect = cropperImgRef.current.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
      
      // Calculate position relative to the SCALED image
      return { 
          x: ((clientX - rect.left) / rect.width) * 100, 
          y: ((clientY - rect.top) / rect.height) * 100 
      };
  };

  const handleCropStart = (e: React.MouseEvent | React.TouchEvent, action: 'draw' | 'move' | 'resize' = 'draw', cropId?: string, handle?: string) => {
      // If pressing controls, don't trigger draw
      e.stopPropagation(); 
      const pos = getMousePos(e); setStartPos(pos);
      if (action === 'draw') { setCurrentRect({ id: 'temp', x: pos.x, y: pos.y, w: 0, h: 0 }); setIsDrawing(true); setActiveCropId(null); }
      else if (action === 'move' && cropId) { const crop = cropRegions.find(r => r.id === cropId); if (crop) { setInitialRect({ ...crop }); setIsMoving(true); setActiveCropId(cropId); } }
      else if (action === 'resize' && cropId && handle) { const crop = cropRegions.find(r => r.id === cropId); if (crop) { setInitialRect({ ...crop }); setIsResizing(handle); setActiveCropId(cropId); } }
  };

  const handleCropMove = (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing && !isMoving && !isResizing) return;
      const pos = getMousePos(e);
      if (isDrawing && currentRect) { setCurrentRect({ ...currentRect, x: Math.min(pos.x, startPos.x), y: Math.min(pos.y, startPos.y), w: Math.abs(pos.x - startPos.x), h: Math.abs(pos.y - startPos.y) }); }
      else if (isMoving && activeCropId && initialRect) { setCropRegions(prev => prev.map(r => r.id === activeCropId ? { ...r, x: Math.max(0, Math.min(100 - r.w, initialRect.x + (pos.x - startPos.x))), y: Math.max(0, Math.min(100 - r.h, initialRect.y + (pos.y - startPos.y))) } : r)); }
      else if (isResizing && activeCropId && initialRect) { 
          const dx = pos.x - startPos.x; const dy = pos.y - startPos.y;
          setCropRegions(prev => prev.map(r => {
              if (r.id !== activeCropId) return r;
              let { x, y, w, h } = initialRect;
              if (isResizing.includes('t')) { const newY = Math.max(0, y + dy); h = h + (y - newY); y = newY; }
              if (isResizing.includes('b')) { h = Math.max(1, Math.min(100 - y, h + dy)); }
              if (isResizing.includes('l')) { const newX = Math.max(0, x + dx); w = w + (x - newX); x = newX; }
              if (isResizing.includes('r')) { w = Math.max(1, Math.min(100 - x, w + dx)); }
              return { ...r, x, y, w, h };
          })); 
      }
  };

  const handleCropEnd = () => {
      if (isDrawing && currentRect && currentRect.w > 2 && currentRect.h > 2) { const newCrop = { ...currentRect, id: crypto.randomUUID() }; setCropRegions(prev => [...prev, newCrop]); setActiveCropId(newCrop.id); }
      setIsDrawing(false); setIsMoving(false); setIsResizing(null); setCurrentRect(null);
  };

  const processCrops = async () => {
      if (!cropperImage || !cropperImgRef.current) return;
      if (cropRegions.length === 0) {
          addToast({ 
              type: 'warning', 
              message: '請先在畫面上用滑鼠或觸控拖曳框選名片範圍，再點擊確認裁切。' 
          });
          return;
      }
      const sourceImg = new Image(); sourceImg.src = cropperImage;
      await new Promise(r => sourceImg.onload = r);
      const newTasks: ProcessingTask[] = [];
      for (let i = 0; i < cropRegions.length; i++) {
          const crop = cropRegions[i];
          const canvas = document.createElement('canvas');
          canvas.width = (crop.w/100)*sourceImg.naturalWidth; canvas.height = (crop.h/100)*sourceImg.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
              ctx.drawImage(sourceImg, (crop.x/100)*sourceImg.naturalWidth, (crop.y/100)*sourceImg.naturalHeight, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
              const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.95));
              if (blob) {
                  const id = crypto.randomUUID(); filesMap.current.set(id, blob);
                  newTasks.push({ id, fileName: `CROP_${i+1}.jpg`, status: 'pending', progress: 0, batchIndex: 1, previewUrl: URL.createObjectURL(blob) });
              }
          }
      }
      setTasks(prev => [...prev, ...newTasks]); setPdfDoc(null); setCropperImage(null); setViewMode('file');
  };
  
  const handleRotateCropImage = async (direction: 'left' | 'right') => {
      if (!cropperImage) return;
      
      const img = new Image();
      img.src = cropperImage;
      await new Promise(r => img.onload = r);
      
      const canvas = document.createElement('canvas');
      canvas.width = img.height;
      canvas.height = img.width;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(direction === 'right' ? 90 * Math.PI / 180 : -90 * Math.PI / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      
      const newB64 = canvas.toDataURL('image/jpeg', 0.95);
      
      setCropperImage(newB64);
      setCropRegions([]); 
      setCropperTransform({ scale: 1, x: 0, y: 0 }); 
      
      // Re-run AI detection on rotated image
      autoDetectInCropper(newB64.split(',')[1]);
  };

  const handleAddClick = () => {
      if (isMobile) {
          setShowMobileUploadHint(true);
      } else {
          fileInputRef.current?.click();
      }
  };

  // --- Onboarding Logic ---
  const tourSteps: TourStep[] = [
      {
          targetId: 'btn-upload',
          title: '開始第一步',
          content: '點擊此按鈕上傳名片圖片 (支援 JPG, PNG, PDF)，或使用相機拍照。',
          position: isMobile ? 'bottom-left' : 'right'
      },
      {
          targetId: 'btn-search',
          title: '資料庫搜尋',
          content: '點擊這裡進入全螢幕資料庫，您可以進行篩選、排序或搜尋特定名片。',
          position: 'bottom-left'
      },
      {
          targetId: 'detail-panel',
          title: '名片詳情與 AI 分析',
          content: '當您選擇名片後，這裡會顯示完整資訊。您可以編輯任何欄位，並查看 AI 提供的分類理由摘要。',
          position: 'left'
      },
      {
          targetId: 'btn-export',
          title: '匯出資料',
          content: '這裡可以將掃描好的資料匯出成 QS 格式、Excel 或備份檔。',
          position: 'bottom-right'
      },
      {
          targetId: 'btn-settings',
          title: '系統設定',
          content: '清除所有資料（危險區域）都在這裡。',
          position: 'bottom-right'
      }
  ];

  const handleTourNext = () => {
      if (tourStepIndex < tourSteps.length - 1) {
          setTourStepIndex(prev => prev + 1);
      } else {
          setTourStepIndex(-1);
          localStorage.setItem('qs_scanner_v1_visited', 'true');
          setShowNotionPrompt(true);
      }
  };

  const handleTourSkip = () => {
      setTourStepIndex(-1);
      localStorage.setItem('qs_scanner_v1_visited', 'true');
      setShowNotionPrompt(true);
  };

  const handleSearchSelectCard = useCallback((id: string) => {
      const c = cardsRef.current.find(x => x.id === id);
      if (c) setActiveCategory(c.category);
      selectCard(id); 
      setOpenedFromSearch(true);
      setViewMode('detail'); 
  }, [selectCard]);

  const handleSearchBack = useCallback(() => {
      setOpenedFromSearch(false);
      setViewMode('file');
  }, []);

  const handleCameraCapture = useCallback(async (b64: string) => {
      const id = crypto.randomUUID(); 
      const res = await fetch(`data:image/jpeg;base64,${b64}`);
      const blob = await res.blob(); 
      filesMap.current.set(id, blob);
      const previewUrl = URL.createObjectURL(blob);
      setTasks(prev => [...prev, { id, fileName: `SCAN_${Date.now()}`, status: 'pending', progress: 0, batchIndex: 1, previewUrl }]);
      setViewMode('file'); 
  }, []);

  const handleCameraClose = useCallback(() => {
      setViewMode('file');
  }, []);

  // --- Render ---
  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-900 font-sans overflow-hidden" 
         onDragEnter={handleDragEnter} 
         onDragLeave={handleDragLeave} 
         onDragOver={handleDragOver} 
         onDrop={handleDrop}>
         
      {/* Global Progress Bar (Non-blocking) */}
      {(isNotionLoading || isSyncingAll) && (
          <div className="fixed top-0 left-0 right-0 z-[9999] h-1.5 bg-slate-100 overflow-hidden shadow-sm">
              <div 
                  className="h-full bg-indigo-600 transition-all duration-300" 
                  style={{ 
                      width: isSyncingAll 
                          ? `${((syncProgress?.current || 0) / (syncProgress?.total || 1)) * 100}%` 
                          : `${Math.min(95, 10 + (notionProgress.loaded * 2))}%` 
                  }} 
              />
              <div className="absolute top-1.5 right-4 bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-b-md shadow-md animate-pulse">
                  {isSyncingAll ? `同步中... ${syncProgress?.current}/${syncProgress?.total}` : `載入 Notion 中... ${notionProgress.loaded} 筆`}
              </div>
          </div>
      )}
      {/* Remove .xlsx from accept to prevent confusion */}
      <input type="file" ref={fileInputRef} className="hidden" accept=".jpg, .jpeg, .png, .heic, .pdf, .json, .csv" multiple onChange={(e) => processFiles(e.target.files)} />

      {/* Onboarding Tour */}
      {tourStepIndex >= 0 && (
          <TourOverlay 
            stepIndex={tourStepIndex} 
            steps={tourSteps} 
            onNext={handleTourNext} 
            onSkip={handleTourSkip} 
          />
      )}

      {/* Mobile Upload Hint Modal */}
      {showMobileUploadHint && (
          <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-fadeIn">
              <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 text-center">
                  <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <i className="fa-solid fa-cloud-arrow-up text-2xl"></i>
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mb-2">上傳檔案</h3>
                  <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                      請選擇檔案進行上傳。<br/>支援 <b>JPG, PNG, PDF</b> 圖片掃描<br/>或 <b>JSON</b> 備份還原。
                  </p>
                  <div className="flex flex-col gap-3">
                      <button onClick={() => fileInputRef.current?.click()} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 active:scale-95 transition-all">
                          選擇檔案
                      </button>
                      <button onClick={() => setShowMobileUploadHint(false)} className="w-full py-3 text-slate-400 font-bold hover:text-slate-600">
                          取消
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Drag & Drop Overlay */}
      {isDragOver && (
          <div className="fixed inset-0 z-[1000] bg-indigo-600/95 backdrop-blur-sm flex items-center justify-center animate-fadeIn">
              <div className="text-white text-center px-6">
                  <i className="fa-solid fa-cloud-arrow-up text-6xl mb-6 animate-bounce"></i>
                  <h2 className="text-2xl font-bold mb-4">釋放以匯入檔案</h2>
                  <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto text-left">
                      <div className="bg-white/10 p-3 rounded-lg border border-white/20">
                          <h3 className="font-bold text-sm mb-1"><i className="fa-regular fa-image mr-2"></i>名片掃描</h3>
                          <p className="text-xs opacity-70">支援 JPG, PNG, PDF 圖片檔</p>
                      </div>
                      <div className="bg-white/10 p-3 rounded-lg border border-white/20">
                          <h3 className="font-bold text-sm mb-1"><i className="fa-solid fa-rotate mr-2"></i>資料還原</h3>
                          <p className="text-xs opacity-70">支援 JSON 或 CSV 完整備份檔</p>
                      </div>
                  </div>
                  <p className="mt-8 text-xs font-mono opacity-50 bg-black/20 inline-block px-3 py-1 rounded">不支援 Excel (.xlsx) 還原</p>
              </div>
          </div>
      )}

      {/* --- LEFT SIDEBAR (Navigation & List) --- */}
      <aside className={`${(isMobile ? viewMode === 'file' : (viewMode === 'file' || viewMode === 'detail')) ? 'flex' : 'hidden'} w-full md:w-[320px] lg:w-[380px] flex-row bg-white border-r border-slate-200 shadow-xl lg:shadow-none z-10 shrink-0`}>
         
         {/* 1. Left Task Rail (Queue & Quick Action) */}
         <div className="w-[64px] bg-slate-50 border-r border-slate-200 flex flex-col items-center py-4 gap-3 shrink-0 z-20">
             {/* Add Button - Updated Handler */}
             <button id="btn-upload" onClick={handleAddClick} className="w-10 h-10 rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center" title="上傳名片">
                 <i className="fa-solid fa-plus text-sm"></i>
             </button>
             
             {/* Divider */}
             <div className="w-6 h-px bg-slate-200 my-1"></div>

             {/* Task List */}
             <div className="flex-1 w-full overflow-y-auto custom-scrollbar flex flex-col items-center gap-2 px-1 pb-4">
                 {activeTasks.map(task => (
                     <div 
                         key={task.id} 
                         className={`relative w-10 h-10 rounded-lg bg-white border border-slate-200 shadow-sm shrink-0 overflow-hidden group transition-all ${task.status === 'error' ? 'cursor-pointer hover:ring-2 hover:ring-red-400' : 'cursor-help'}`}
                         onClick={() => task.status === 'error' && handleRetryTask(task.id)}
                     >
                         {task.previewUrl ? (
                             <img src={task.previewUrl} className="w-full h-full object-contain bg-slate-100" />
                         ) : (
                             <div className="w-full h-full flex items-center justify-center text-slate-300"><i className="fa-solid fa-image"></i></div>
                         )}
                         {task.status === 'processing' && (
                             <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                 <i className="fa-solid fa-circle-notch fa-spin text-white text-xs"></i>
                             </div>
                         )}
                         {task.status === 'completed' && (
                             <div className="absolute inset-0 bg-emerald-500/90 flex items-center justify-center animate-fadeIn">
                                 <i className="fa-solid fa-check text-white text-sm"></i>
                             </div>
                         )}
                         {task.status === 'error' && (
                             <div className="absolute inset-0 border-2 border-red-500 rounded-lg flex flex-col items-center justify-center bg-red-50/80 backdrop-blur-[1px] transition-colors hover:bg-red-100/80">
                                 <i className="fa-solid fa-rotate-right text-red-600 text-sm mb-0.5"></i>
                                 <span className="text-[6px] font-black text-red-600 leading-none">RETRY</span>
                             </div>
                         )}
                     </div>
                 ))}
             </div>
         </div>

         {/* 2. Right Sidebar Content */}
         <div className="flex-1 flex flex-col min-w-0 bg-white relative">
            <div className="p-4 border-b border-slate-100 bg-white sticky top-0 z-20" style={{paddingTop: isMobile ? 'calc(1rem + var(--sat))' : '1.5rem'}}>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                            <i className="fa-solid fa-leaf text-lg"></i>
                        </div>
                        <div>
                            <h1 className="text-lg font-black text-slate-900 tracking-tight leading-none">EcoScan 🌱✨</h1>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] font-bold text-slate-400 tracking-widest">Sustainable Contact Manager 🌍</span>
                                {bgTaskCount > 0 && (
                                    <div className="flex items-center gap-1.5 px-1.5 py-0.5 bg-indigo-50 rounded-md border border-indigo-100 animate-pulse">
                                        <i className="fa-solid fa-wand-magic-sparkles text-indigo-500 text-[9px]"></i>
                                        <span className="text-[9px] font-bold text-indigo-600">AI 補全簡介中 ({bgTaskCount})</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        {/* Export Menu */}
                        <div className="relative" ref={exportMenuRef}>
                            <button id="btn-export" onClick={() => setShowExportMenu(!showExportMenu)} className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${showExportMenu ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`} title="匯出選項">
                                <i className="fa-solid fa-file-export"></i>
                            </button>
                            {showExportMenu && (
                                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-50 animate-fadeIn origin-top-right">
                                    {/* Group 0: QS Selection Action */}
                                    {selectedCardIds.size > 0 && (
                                        <>
                                            <div className="px-4 py-1.5 text-[10px] font-bold text-indigo-700 uppercase tracking-widest bg-indigo-50/80 flex items-center justify-between">
                                                <span>已勾選 QS 名單 ({selectedCardIds.size} 位)</span>
                                                <span className="text-[9px] bg-indigo-200 text-indigo-800 px-1.5 py-0.5 rounded-full font-bold">自訂選取</span>
                                            </div>
                                            <button 
                                                onClick={() => {
                                                    setShowExportMenu(false);
                                                    setIsQsModalOpen(true);
                                                }} 
                                                className="w-full text-left px-4 py-2.5 text-sm text-indigo-700 bg-indigo-50/40 hover:bg-indigo-100 transition-colors flex items-center gap-2 font-black"
                                            >
                                                <i className="fa-solid fa-clipboard-check w-4 text-center text-indigo-600"></i> 審查名單並匯出 ({selectedCardIds.size})
                                            </button>
                                            <button 
                                                onClick={() => {
                                                    setShowExportMenu(false);
                                                    const selected = cards.filter(c => selectedCardIds.has(c.id));
                                                    handleExport('selected_qs', selected);
                                                }} 
                                                className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-emerald-600 transition-colors flex items-center gap-2"
                                            >
                                                <i className="fa-solid fa-file-excel w-4 text-center text-emerald-600"></i> 快速匯出勾選 QS Excel
                                            </button>
                                            <div className="h-px bg-slate-100 my-1"></div>
                                        </>
                                    )}

                                    {/* Group 1: QS Format */}
                                    <div className="px-4 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">QS 格式匯出</div>
                                    <button onClick={() => handleExport('employer')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors flex items-center gap-2">
                                        <i className="fa-solid fa-briefcase w-4 text-center text-slate-400"></i> QS Employer
                                    </button>
                                    <button onClick={() => handleExport('academic')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors flex items-center gap-2">
                                        <i className="fa-solid fa-graduation-cap w-4 text-center text-slate-400"></i> QS Academic
                                    </button>
                                    <button onClick={() => handleExport('staff')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors flex items-center gap-2">
                                        <i className="fa-solid fa-user-tag w-4 text-center text-slate-400"></i> QS Staff
                                    </button>
                                    
                                    {/* Group 2: Details */}
                                    <div className="px-4 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50 mt-1">名片詳情匯出</div>
                                    <button onClick={() => handleExport('all_clean')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors flex items-center gap-2">
                                        <i className="fa-solid fa-language w-4 text-center text-slate-400"></i> 所有名片原文 (Excel)
                                    </button>
                                    <button onClick={() => handleExport('all_original')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors flex items-center gap-2">
                                        <i className="fa-solid fa-database w-4 text-center text-slate-400"></i> 所有資料含註解 (Excel)
                                    </button>
                                    
                                    {/* Group 3: vCard */}
                                    <div className="px-4 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50 mt-1">電子名片</div>
                                    <button onClick={() => handleExport('vcard')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors flex items-center gap-2">
                                        <i className="fa-regular fa-address-card w-4 text-center text-slate-400"></i> vCard (.vcf)
                                    </button>
                                    
                                    {/* Group 4: Batch Export */}
                                    <div className="px-4 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50 mt-1">批量匯出</div>
                                    <button onClick={() => handleExport('zip')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors flex items-center gap-2">
                                        <i className="fa-solid fa-file-zipper w-4 text-center text-slate-400"></i> 批量匯出 (ZIP)
                                    </button>

                                    {/* Group 5: Backup */}
                                    <div className="px-4 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50 mt-1">備份</div>
                                    <button onClick={() => handleExport('full_backup')} className="w-full text-left px-4 py-2 text-sm text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100 transition-colors flex items-center gap-2">
                                        <i className="fa-solid fa-cloud-arrow-down w-4 text-center"></i> 完整備份 (JSON - 含圖片)
                                    </button>
                                    <button onClick={() => handleExport('csv')} className="w-full text-left px-4 py-2 text-sm text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100 transition-colors flex items-center gap-2">
                                        <i className="fa-solid fa-file-csv w-4 text-center"></i> 完整備份 (CSV)
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Settings Menu */}
                        <div className="relative" ref={settingsMenuRef}>
                            <button id="btn-settings" onClick={() => setShowSettingsMenu(!showSettingsMenu)} className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${showSettingsMenu ? 'bg-slate-100 text-slate-700' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`} title="設定">
                                <i className="fa-solid fa-gear"></i>
                            </button>
                            {showSettingsMenu && (
                                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-50 animate-fadeIn origin-top-right">
                                    <div className="px-4 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">系統設定</div>
                                    
                                    {/* Sync All to Notion Button */}
                                    <button onClick={handleSyncAllToNotion} disabled={isSyncingAll} className="w-full text-left px-4 py-3 text-sm text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100 transition-colors flex items-center gap-2 font-bold">
                                        {isSyncingAll ? <i className="fa-solid fa-circle-notch fa-spin w-4 text-center"></i> : <i className="fa-solid fa-cloud-arrow-up w-4 text-center text-indigo-500"></i>}
                                        一鍵新增到 Notion 🚀
                                    </button>

                                    {/* Notion Load Button */}
                                    <button onClick={handleLoadFromNotion} disabled={isNotionLoading} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2">
                                        {isNotionLoading ? <i className="fa-solid fa-circle-notch fa-spin w-4 text-center"></i> : <i className="fa-solid fa-cloud-arrow-down w-4 text-center text-slate-400"></i>}
                                        載入 Notion 資料 📥
                                    </button>

                                    {/* Notion Trash Scan & Restore Button */}
                                    <button onClick={() => { setShowSettingsMenu(false); setShowNotionTrashModal(true); }} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center gap-2 font-medium">
                                        <i className="fa-solid fa-box-archive w-4 text-center text-indigo-500"></i>
                                        檢查並還原 Notion 封存名片 ♻️
                                    </button>

                                    {/* Find Duplicates Button */}
                                    <button onClick={handleFindDuplicates} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-between">
                                        <span className="flex items-center gap-2">
                                            <i className="fa-solid fa-clone w-4 text-center text-slate-400"></i>
                                            <span>尋找並清理重複名片</span>
                                        </span>
                                        {duplicateAnalysis.totalDuplicateCount > 0 && (
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                                {duplicateAnalysis.totalDuplicateCount}
                                            </span>
                                        )}
                                    </button>

                                    {/* Remove No Image Cards Button */}
                                    <button onClick={handleRemoveNoImageCards} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2">
                                        <i className="fa-solid fa-image-slash w-4 text-center text-slate-400"></i> 移除無圖片名片
                                    </button>

                                    {/* Cleanup Firebase Button Removed */}

                                    <button onClick={() => { setShowSettingsMenu(false); handleClearAll(); }} className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2 font-bold">
                                        <i className="fa-solid fa-trash-can w-4 text-center"></i> 清理本地緩存
                                    </button>
                                </div>
                            )}
                        </div>

                    </div>
                </div>

                {isMobile && (
                    <div className="mb-4">
                        <button onClick={() => setViewMode('camera')} className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-50 text-indigo-700 rounded-xl font-bold text-xs uppercase tracking-wide hover:bg-indigo-100 transition-colors">
                            <i className="fa-solid fa-camera"></i> 拍照
                        </button>
                    </div>
                )}
                
                {/* Search / Filter Area */}
                <div className="mb-3 space-y-2">
                    <button id="btn-search" onClick={() => setViewMode('search')} className="w-full flex items-center gap-3 bg-slate-100 rounded-lg px-3 py-2.5 text-xs text-slate-400 hover:bg-slate-200 transition-colors group">
                        <i className="fa-solid fa-search text-slate-400 group-hover:text-indigo-600"></i>
                        <span className="font-medium group-hover:text-indigo-600">開啟全螢幕搜尋庫 (支援AI摘要)...</span>
                        <span className="ml-auto bg-white px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-400 border border-slate-200">⌘K</span>
                    </button>
                    
                    {/* Updated Navigation: All vs QS Classification vs Country */}
                    <button 
                        onClick={() => { setActiveCategory('all'); setActiveCountry('all'); setShowQsFilters(false); setShowCountryFilters(false); }} 
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeCategory === 'all' && activeCountry === 'all' && !showQsFilters && !showCountryFilters ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200' : 'text-slate-500 hover:bg-slate-100'}`}
                    >
                        <i className="fa-solid fa-inbox w-4 text-center"></i>
                        全部名片 📂
                        <span className="ml-auto text-[10px] bg-slate-200 px-1.5 rounded-full text-slate-500">{cards.length}</span>
                    </button>

                    <div className="flex flex-col">
                        <button 
                            onClick={() => setShowQsFilters(!showQsFilters)} 
                            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${showQsFilters || activeCategory !== 'all' ? 'text-indigo-700 bg-slate-50' : 'text-slate-500 hover:bg-slate-100'}`}
                        >
                            <i className="fa-solid fa-layer-group w-4 text-center"></i>
                            QS 分類 🏷️
                            <i className={`fa-solid fa-chevron-down ml-auto text-[10px] transition-transform ${showQsFilters ? 'rotate-180' : ''}`}></i>
                        </button>

                        {showQsFilters && (
                            <div className="flex flex-col gap-1 mt-1 pl-4 border-l-2 border-slate-100 ml-3 animate-fadeIn">
                                {(['employer', 'academic', 'staff', 'other'] as const).map(cat => {
                                    const emojiMap: Record<string, string> = {
                                        employer: '🏢',
                                        academic: '🎓',
                                        staff: '🤝',
                                        other: '🌟'
                                    };
                                    return (
                                        <button 
                                            key={cat} 
                                            onClick={() => setActiveCategory(cat)} 
                                            className={`text-left px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all flex items-center justify-between ${activeCategory === cat ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-50'}`}
                                        >
                                            <span>{emojiMap[cat]} {cat === 'other' ? 'Not QS' : cat}</span>
                                            <span className={`text-[9px] px-1.5 rounded-full ${activeCategory === cat ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                                {cards.filter(c => c.category === cat).length}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Country Filter Navigation */}
                    {sidebarCountries.length > 0 && (
                        <div className="flex flex-col">
                            <button 
                                onClick={() => setShowCountryFilters(!showCountryFilters)} 
                                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${showCountryFilters || activeCountry !== 'all' ? 'text-indigo-700 bg-slate-50' : 'text-slate-500 hover:bg-slate-100'}`}
                            >
                                <i className="fa-solid fa-earth-americas w-4 text-center"></i>
                                <span>國家篩選 🌍</span>
                                {activeCountry !== 'all' && (
                                    <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold truncate max-w-[80px]">
                                        {getCountryBilingualLabel(activeCountry)}
                                    </span>
                                )}
                                <i className={`fa-solid fa-chevron-down ml-auto text-[10px] transition-transform ${showCountryFilters ? 'rotate-180' : ''}`}></i>
                            </button>

                            {showCountryFilters && (
                                <div className="flex flex-col gap-1 mt-1 pl-4 border-l-2 border-slate-100 ml-3 animate-fadeIn max-h-48 overflow-y-auto custom-scrollbar">
                                    <button
                                        onClick={() => setActiveCountry('all')}
                                        className={`text-left px-3 py-1.5 rounded-md text-[10px] font-bold transition-all flex items-center justify-between ${activeCountry === 'all' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-50'}`}
                                    >
                                        <span>全部國家</span>
                                        <span className={`text-[9px] px-1.5 rounded-full ${activeCountry === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                            {cards.length}
                                        </span>
                                    </button>
                                    {sidebarCountries.map(([ctryName, count]) => (
                                        <button 
                                            key={ctryName} 
                                            onClick={() => setActiveCountry(ctryName)} 
                                            className={`text-left px-3 py-1.5 rounded-md text-[10px] font-bold transition-all flex items-center justify-between ${activeCountry === ctryName ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-50'}`}
                                        >
                                            <span className="truncate mr-2">📍 {getCountryBilingualLabel(ctryName)}</span>
                                            <span className={`text-[9px] px-1.5 rounded-full shrink-0 ${activeCountry === ctryName ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                                {count}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* QS Batch Selection Bar */}
                <div className="mt-2 pt-2 border-t border-slate-100 flex flex-col gap-1.5 bg-slate-50/90 p-2 rounded-xl border border-slate-200/60">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-[11px] font-bold text-slate-700">
                            <i className="fa-solid fa-check-square text-indigo-600"></i>
                            <span>QS 勾選名單</span>
                            <span className="bg-indigo-100 text-indigo-800 text-[10px] px-1.5 py-0.2 rounded-full font-black">
                                {selectedCardIds.size}
                            </span>
                        </div>
                        {selectedCardIds.size > 0 && (
                            <button
                                type="button"
                                onClick={handleDeselectAll}
                                className="text-[10px] text-slate-400 hover:text-rose-600 font-bold transition-colors cursor-pointer"
                            >
                                清除全部
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-1 flex-wrap">
                        <button
                            type="button"
                            onClick={() => handleSelectCategory('all')}
                            className="px-2 py-0.5 bg-white hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 text-[10px] font-bold rounded border border-slate-200 shadow-2xs transition-all cursor-pointer"
                            title="選取全部 QS 聯絡人 (雇主/學者/職員)"
                        >
                            全選 QS
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSelectCategory('employer')}
                            className="px-1.5 py-0.5 bg-white hover:bg-blue-50 text-slate-600 text-[10px] font-bold rounded border border-slate-200 transition-all cursor-pointer"
                            title="選取全部 QS 雇主"
                        >
                            🏢 雇主
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSelectCategory('academic')}
                            className="px-1.5 py-0.5 bg-white hover:bg-amber-50 text-slate-600 text-[10px] font-bold rounded border border-slate-200 transition-all cursor-pointer"
                            title="選取全部 QS 學者"
                        >
                            🎓 學者
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSelectCategory('staff')}
                            className="px-1.5 py-0.5 bg-white hover:bg-emerald-50 text-slate-600 text-[10px] font-bold rounded border border-slate-200 transition-all cursor-pointer"
                            title="選取全部 QS 職員"
                        >
                            🤝 職員
                        </button>
                    </div>

                    {selectedCardIds.size > 0 && (
                        <button
                            type="button"
                            onClick={() => setIsQsModalOpen(true)}
                            className="w-full mt-0.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black flex items-center justify-center gap-1.5 shadow-sm shadow-indigo-200 transition-all cursor-pointer"
                        >
                            <i className="fa-solid fa-clipboard-check text-xs"></i>
                            <span>確認名單並匯出 ({selectedCardIds.size})</span>
                        </button>
                    )}
                </div>
            </div>

            <div 
                className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2 bg-slate-50/50"
                onScroll={(e) => {
                    const target = e.currentTarget;
                    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 200) {
                        if (sidebarDisplayLimit < visibleCards.length) {
                            setSidebarDisplayLimit(prev => Math.min(visibleCards.length, prev + 50));
                        }
                    }
                }}
            >
                {visibleCards.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-slate-300">
                        {searchQuery ? (
                             <>
                                <span className="text-4xl mb-2">🔍👻</span>
                                <span className="text-xs font-medium">找不到符合的資料耶～</span>
                             </>
                        ) : (
                             <>
                                <span className="text-4xl mb-2">📦✨</span>
                                <span className="text-xs font-medium">這裡空空的，趕快來新增吧！</span>
                             </>
                        )}
                    </div>
                ) : (
                    <>
                        {visibleCards.slice(0, sidebarDisplayLimit).map(c => (
                            <SidebarCardItem
                                key={c.id}
                                card={c}
                                isSelected={selectedCardId === c.id}
                                isQsChecked={selectedCardIds.has(c.id)}
                                isDuplicate={duplicateIds.has(c.id)}
                                onSelect={(id) => { selectCard(id); setViewMode('detail'); }}
                                onToggleQs={handleToggleCardSelect}
                                onDelete={handleDeleteCard}
                            />
                        ))}
                        {sidebarDisplayLimit < visibleCards.length && (
                            <button
                                type="button"
                                onClick={() => setSidebarDisplayLimit(prev => Math.min(visibleCards.length, prev + 100))}
                                className="w-full py-2.5 bg-white hover:bg-slate-100 text-slate-500 rounded-xl text-xs font-bold border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                            >
                                載入更多名片 (剩餘 {visibleCards.length - sidebarDisplayLimit} 筆)...
                            </button>
                        )}
                    </>
                )}
            </div>
         </div>
      </aside>

      {/* --- MAIN CONTENT AREA --- */}
      <main className={`flex-1 flex flex-col min-w-0 relative bg-slate-100/50 ${isMobile && viewMode === 'file' ? 'hidden' : 'flex'}`}>
         
         {/* Render Active View */}
         {viewMode === 'search' ? (
             <SearchPage 
                cards={cards} 
                onSelectCard={handleSearchSelectCard} 
                onDeleteCard={handleDeleteCard}
                onStandardizeCountries={handleStandardizeAllCountries}
                onBack={cards.length > 0 && selectedCardId ? handleSearchBack : undefined} 
                selectedCardIds={selectedCardIds}
                onToggleCard={handleToggleCardSelect}
                onSelectBatch={handleSelectBatch}
                onDeselectAll={handleDeselectAll}
                onOpenQsModal={() => setIsQsModalOpen(true)}
                searchState={searchPageState}
                onSearchStateChange={setSearchPageState}
                onUpdateCardCategory={handleQuickCategoryChange}
                onAddNewCard={() => setViewMode('file')}
                onScanCamera={() => setViewMode('camera')}
                onExport={handleExport}
                onSyncAllToNotion={handleSyncAllToNotion}
                isSyncingAll={isSyncingAll}
                onLoadFromNotion={handleLoadFromNotion}
                isNotionLoading={isNotionLoading}
                onOpenNotionTrash={() => setShowNotionTrashModal(true)}
                onOpenDuplicateModal={() => setShowDuplicateManager(true)}
                onRemoveNoImageCards={handleRemoveNoImageCards}
                onClearAll={handleClearAll}
                onAutoDeduplicate={() => handleAutoDeduplicate()}
                duplicateGroupCount={duplicateAnalysis.groups.length}
                redundantDuplicateCount={duplicateAnalysis.totalDuplicateCount}
                duplicateCardIds={duplicateIds}
                bgTaskCount={bgTaskCount}
                isMobile={isMobile}
             />
         ) : (
             <>
                 {/* Top Toolbar (Unified for Mobile/Desktop) */}
                 <div className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur px-4 md:px-6 flex items-center justify-between shrink-0">
                     <div className="flex items-center gap-2.5 md:gap-4 overflow-hidden">
                         {isMobile ? (
                             <button 
                                 onClick={() => {
                                     if (openedFromSearch) {
                                         setViewMode('search');
                                     } else {
                                         setViewMode('file');
                                     }
                                 }} 
                                 className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-600 shrink-0 hover:bg-slate-200 cursor-pointer"
                                 title={openedFromSearch ? "返回資料庫搜尋" : "返回列表"}
                             >
                                 <i className="fa-solid fa-arrow-left"></i>
                             </button>
                         ) : (
                             openedFromSearch ? (
                                 <button 
                                     type="button"
                                     onClick={() => setViewMode('search')}
                                     className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border border-indigo-200 shrink-0 cursor-pointer shadow-2xs group"
                                     title="返回名片資料庫搜尋（已保留所有搜尋關鍵字與篩選條件）"
                                 >
                                     <i className="fa-solid fa-arrow-left transition-transform group-hover:-translate-x-0.5"></i>
                                     <span>返回資料庫</span>
                                     {(searchPageState.query || searchPageState.filterCategory !== 'all' || searchPageState.filterCountry !== 'all' || searchPageState.filterHasEmail || searchPageState.filterHasPhone) && (
                                         <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" title="已保留篩選條件"></span>
                                     )}
                                 </button>
                             ) : (
                                 <button 
                                     type="button"
                                     onClick={() => setViewMode('search')}
                                     className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-all hidden sm:flex items-center gap-1.5 shrink-0 cursor-pointer"
                                     title="開啟全螢幕資料庫"
                                 >
                                     <i className="fa-solid fa-database text-slate-500 text-xs"></i>
                                     <span>資料庫</span>
                                 </button>
                             )
                         )}
                         {formData ? (
                             <div className="flex flex-col min-w-0">
                                <h2 className="text-base font-black text-slate-900 leading-tight truncate">
                                    {(formData.firstName || formData.lastName) ? `${formData.firstName} ${formData.lastName}` : (formData.company || '未知名片')}
                                </h2>
                                <span className="text-xs text-slate-500 font-medium truncate uppercase tracking-wider">{formData.company}</span>
                             </div>
                         ) : (
                            <div className="text-sm font-bold text-slate-400 flex items-center gap-2">
                                <span className="text-lg">👀</span> 尚未選擇名片
                            </div>
                         )}
                     </div>
                     
                     {/* Right Action Buttons */}
                     <div className="flex items-center gap-2 md:gap-3 shrink-0">
                         {formData && (
                             <>
                                {/* QS Selection Toggle */}
                                <button
                                    type="button"
                                    onClick={() => handleToggleCardSelect(formData.id)}
                                    className={`h-9 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                        selectedCardIds.has(formData.id)
                                            ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-500'
                                            : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                                    }`}
                                    title={selectedCardIds.has(formData.id) ? '從 QS 匯出名單中取消勾選' : '勾選此名片至 QS 匯出名單'}
                                >
                                    <i className={`fa-solid ${selectedCardIds.has(formData.id) ? 'fa-square-check' : 'fa-square'}`}></i>
                                    <span className="hidden sm:inline">{selectedCardIds.has(formData.id) ? '已勾選 QS' : '勾選 QS'}</span>
                                </button>
                                {/* Save Button */}
                                <button id="save-btn" onClick={handleSave} disabled={!isFormDirty} className={`h-9 px-3 md:px-5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all flex items-center justify-center gap-2 ${isFormDirty ? 'bg-indigo-600 text-white shadow-md shadow-indigo-300 hover:bg-indigo-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
                                   {isMobile ? <i className="fa-solid fa-floppy-disk text-sm"></i> : <><i className="fa-solid fa-floppy-disk"></i> 儲存</>}
                                </button>
                                
                                <div className="w-px h-6 bg-slate-300 hidden md:block"></div>
                                
                                {/* Share/Export Button */}
                                {isMobile ? (
                                     <div className="relative" ref={shareMenuRef}>
                                         <button onClick={() => setShowShareMenu(!showShareMenu)} className={`h-9 px-3 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors flex items-center justify-center ${showShareMenu ? 'bg-indigo-100 text-indigo-600' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}>
                                             <i className="fa-solid fa-share-nodes text-sm"></i>
                                         </button>
                                         {showShareMenu && (
                                            <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-50 animate-fadeIn origin-top-right">
                                                <button onClick={() => { handleShare(true); setShowShareMenu(false); }} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2">
                                                    <i className="fa-solid fa-wand-magic-sparkles w-4 text-center text-indigo-500"></i> 分享 (含 AI 簡介)
                                                </button>
                                                <button onClick={() => { handleShare(false); setShowShareMenu(false); }} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2">
                                                    <i className="fa-regular fa-id-card w-4 text-center text-slate-400"></i> 分享 (僅資料)
                                                </button>
                                            </div>
                                         )}
                                     </div>
                                ) : (
                                     <>
                                         <button onClick={() => handleExport('single')} disabled={isExporting} className="h-9 px-4 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold uppercase tracking-wide hover:bg-emerald-100 transition-colors flex items-center gap-2">
                                            {isExporting ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-file-excel"></i>} 匯出此筆
                                         </button>
                                         
                                         {/* Save to Notion Button */}
                                         <button 
                                            onClick={handleSaveToNotion} 
                                            disabled={isNotionLoading || formData.syncStatus === 'notion'} 
                                            className={`h-9 px-4 rounded-lg text-xs font-bold uppercase tracking-wide transition-all flex items-center gap-2 ml-2 ${
                                                formData.syncStatus === 'notion' 
                                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                                                : 'bg-slate-800 text-white hover:bg-slate-700 shadow-sm'
                                            }`}
                                         >
                                            {isNotionLoading ? (
                                                <i className="fa-solid fa-circle-notch fa-spin"></i>
                                            ) : formData.syncStatus === 'notion' ? (
                                                <i className="fa-solid fa-check-double"></i>
                                            ) : (
                                                <i className="fa-solid fa-cloud-arrow-up"></i>
                                            )}
                                            {formData.syncStatus === 'notion' ? '已同步到 Notion' : '新增至 Notion'}
                                         </button>
                                     </>
                                )}
                             </>
                         )}
                         {/* Delete Button */}
                         {formData ? (
                             <button onClick={(e) => handleDeleteCard(e, formData.id)} className="h-9 w-9 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="刪除此筆">
                                 <i className="fa-solid fa-trash"></i>
                             </button>
                         ) : (
                             <button onClick={handleClearAll} disabled={cards.length === 0} className="h-9 px-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="清空全部">
                                 <i className="fa-solid fa-trash-can"></i>
                             </button>
                         )}
                     </div>
                 </div>

                 {/* Content Body */}
                 <div className="flex-1 relative overflow-hidden" id="detail-panel">
                    {viewMode === 'camera' && (
                        <div className="absolute inset-0 z-50 bg-black">
                           <CameraScanner onCapture={async (b64) => { 
                               const id = crypto.randomUUID(); const res = await fetch(`data:image/jpeg;base64,${b64}`);
                               const blob = await res.blob(); filesMap.current.set(id, blob);
                               const previewUrl = URL.createObjectURL(blob);
                               setTasks(prev => [...prev, { id, fileName: `SCAN_${Date.now()}`, status: 'pending', progress: 0, batchIndex: 1, previewUrl }]);
                               setViewMode('file'); 
                           }} onClose={() => setViewMode('file')} isMobile={isMobile} />
                        </div>
                    )}

                    {viewMode === 'cropper' && cropperImage && (
                       <div className="absolute inset-0 z-40 bg-slate-100 flex flex-col" onMouseMove={handleCropperMouseMove} onMouseUp={handleCropperMouseUp} onTouchMove={handleCropperMouseMove} onTouchEnd={handleCropperMouseUp}>
                           <div className="h-14 bg-white border-b border-slate-200 px-4 md:px-6 flex items-center justify-between shrink-0">
                               <div className="font-bold text-slate-700 flex items-center gap-2">
                                   <span>智慧裁切 ({cropRegions.length})</span>
                                   {isAiDetecting ? (
                                       <span className="text-[10px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-bold animate-pulse">AI 偵測中...</span>
                                   ) : cropRegions.length === 0 ? (
                                       <span className="text-xs text-amber-600 font-normal hidden sm:inline-flex items-center gap-1">
                                           <i className="fa-solid fa-arrow-pointer"></i> 請在畫面上拖曳框選名片區塊
                                       </span>
                                   ) : null}
                               </div>
                               <div className="flex gap-2 items-center">
                                   {/* Zoom Controls */}
                                   <div className="hidden md:flex bg-slate-100 rounded-lg mr-2">
                                       <button onClick={() => setCropperTransform(t => ({...t, scale: Math.max(0.5, t.scale - 0.2)}))} className="w-8 h-8 text-slate-500 hover:bg-white rounded"><i className="fa-solid fa-minus text-xs"></i></button>
                                       <button onClick={() => setCropperTransform(t => ({...t, scale: 1, x: 0, y: 0}))} className="w-8 h-8 text-slate-500 hover:bg-white rounded text-xs font-bold">{Math.round(cropperTransform.scale * 100)}%</button>
                                       <button onClick={() => setCropperTransform(t => ({...t, scale: t.scale + 0.2}))} className="w-8 h-8 text-slate-500 hover:bg-white rounded"><i className="fa-solid fa-plus text-xs"></i></button>
                                   </div>

                                   {/* Rotate Controls (New) */}
                                   <div className="flex bg-slate-100 rounded-lg mr-2">
                                       <button onClick={() => handleRotateCropImage('left')} className="w-8 h-8 text-slate-500 hover:bg-white rounded" title="向左旋轉"><i className="fa-solid fa-rotate-left text-xs"></i></button>
                                       <div className="w-px h-4 bg-slate-300 my-2"></div>
                                       <button onClick={() => handleRotateCropImage('right')} className="w-8 h-8 text-slate-500 hover:bg-white rounded" title="向右旋轉"><i className="fa-solid fa-rotate-right text-xs"></i></button>
                                   </div>

                                   <button onClick={() => { setViewMode('file'); setCropperImage(null); }} className="px-4 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg">取消</button>
                                   <button onClick={processCrops} className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 rounded-lg shadow-lg hover:bg-indigo-700">確認裁切</button>
                               </div>
                           </div>
                           
                           <div className="flex-1 overflow-hidden relative bg-slate-200/50 select-none cursor-grab active:cursor-grabbing" 
                                onWheel={handleCropperWheel}
                                onMouseDown={handleCropperMouseDown}>
                                
                                <div className="w-full h-full flex items-center justify-center transform-gpu"
                                     style={{
                                         transform: `translate(${cropperTransform.x}px, ${cropperTransform.y}px) scale(${cropperTransform.scale})`,
                                         transition: isCropperPanning ? 'none' : 'transform 0.1s ease-out'
                                     }}>
                                     
                                    {/* Wrapper determines the coordinate reference frame. It should fit the image exactly. */}
                                    <div className="relative shadow-2xl bg-white group">
                                        {isRenderingPdf && <div className="absolute inset-0 bg-white/80 z-50 flex items-center justify-center"><i className="fa-solid fa-spinner fa-spin text-2xl text-indigo-500"></i></div>}
                                        
                                        {/* AI Scanning Indicator Overlay */}
                                        {isAiDetecting && (
                                            <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden">
                                                <div className="absolute inset-0 bg-indigo-500/10"></div>
                                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50 animate-[scan_1.5s_infinite_linear]"></div>
                                                <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg shadow-lg text-xs font-bold text-indigo-600 flex items-center gap-2">
                                                    <i className="fa-solid fa-wand-magic-sparkles fa-bounce"></i> AI 正在分析名片位置...
                                                </div>
                                            </div>
                                        )}

                                        <img 
                                            ref={cropperImgRef} 
                                            src={cropperImage} 
                                            className="block pointer-events-none" 
                                            style={{ maxWidth: '85vw', maxHeight: '80vh', objectFit: 'contain' }} // Constrain image so wrapper fits
                                            draggable={false} 
                                        />
                                        <div className="absolute inset-0 z-10 crop-draw-layer" onMouseDown={(e)=>{e.stopPropagation(); handleCropStart(e, 'draw')}}></div>
                                        
                                        {/* Render Existing Crops */}
                                        {cropRegions.map((crop, idx) => (
                                            <div key={crop.id} 
                                                 className={`crop-box absolute z-20 transition-all ${activeCropId===crop.id ? 'cursor-move' : 'cursor-pointer border-2 border-emerald-400 bg-emerald-400/10'}`} 
                                                 style={{left:`${crop.x}%`, top:`${crop.y}%`, width:`${crop.w}%`, height:`${crop.h}%`, 
                                                         boxShadow: activeCropId === crop.id ? '0 0 0 9999px rgba(0, 0, 0, 0.5)' : 'none',
                                                         zIndex: activeCropId === crop.id ? 30 : 20
                                                 }} 
                                                 onMouseDown={(e)=>{e.stopPropagation();handleCropStart(e,'move',crop.id)}}
                                            >
                                                {/* Active Crop Border & Controls */}
                                                {activeCropId === crop.id && (
                                                    <div className="absolute inset-0 border-2 border-indigo-500">
                                                        <div className="absolute -top-1 -left-1 w-3 h-3 bg-indigo-500 cursor-nw-resize rounded-full shadow-sm" onMouseDown={(e)=>{e.stopPropagation();handleCropStart(e,'resize',crop.id,'tl')}}></div>
                                                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-500 cursor-ne-resize rounded-full shadow-sm" onMouseDown={(e)=>{e.stopPropagation();handleCropStart(e,'resize',crop.id,'tr')}}></div>
                                                        <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-indigo-500 cursor-sw-resize rounded-full shadow-sm" onMouseDown={(e)=>{e.stopPropagation();handleCropStart(e,'resize',crop.id,'bl')}}></div>
                                                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-indigo-500 cursor-se-resize rounded-full shadow-sm" onMouseDown={(e)=>{e.stopPropagation();handleCropStart(e,'resize',crop.id,'br')}}></div>
                                                    </div>
                                                )}

                                                <div className={`absolute top-0 left-0 text-white text-[9px] px-1 font-bold ${activeCropId===crop.id ? 'bg-indigo-600' : 'bg-emerald-500'}`}>#{idx+1}</div>
                                                <button className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow hover:bg-red-600 z-50" onClick={(e)=>{e.stopPropagation();setCropRegions(p=>p.filter(r=>r.id!==crop.id))}}><i className="fa-solid fa-times text-[10px]"></i></button>
                                            </div>
                                        ))}

                                        {/* Render Drawing Rectangle with Mask */}
                                        {isDrawing && currentRect && (
                                            <div className="absolute border-2 border-dashed border-indigo-500 z-40 pointer-events-none" 
                                                 style={{left:`${currentRect.x}%`, top:`${currentRect.y}%`, width:`${currentRect.w}%`, height:`${currentRect.h}%`, boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)'}}>
                                            </div>
                                        )}
                                    </div>
                                </div>
                           </div>
                       </div>
                    )}

                    {/* Split View: Detail */}
                    {formData ? (
                        <div className="h-full flex flex-col md:flex-row bg-slate-50">
                            {/* Left Pane: Pan & Zoom Image Viewer */}
                            <div className="md:w-[35%] lg:w-[30%] h-[35vh] md:h-full bg-slate-900 relative flex flex-col overflow-hidden group shrink-0 border-r border-slate-200">
                               {formData.imageUrl ? (
                                   <PanZoomImage 
                                       src={formData.imageUrl} 
                                       rotation={formData.rotation || 0} 
                                       onRotate={(deg) => {
                                           const updatedCard = formData ? {...formData, rotation: deg} : null;
                                           setFormData(updatedCard);
                                           if (updatedCard) {
                                               setCards(prev => prev.map(c => c.id === updatedCard.id ? updatedCard : c));
                                               saveCardToDB(updatedCard);
                                           }
                                       }} 
                                   />
                               ) : (
                                   <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
                                       <i className="fa-regular fa-image text-4xl mb-2 opacity-50"></i>
                                       <span className="text-xs font-medium">無影像資料</span>
                                       <span className="text-[10px] opacity-60">(來自 Excel 匯入)</span>
                                   </div>
                               )}
                            </div>

                            {/* Right Pane: Editable Data Form */}
                            <div className="flex-1 h-full overflow-y-auto custom-scrollbar bg-white p-4 lg:p-6">
                                <div className="max-w-6xl mx-auto">
                                    
                                    {/* Duplicate Warning Section */}
                                    {(() => {
                                        if (!formData?.id) return null;
                                        const curGroup = duplicateAnalysis.groups.find(g => g.cards.some(c => c.id === formData.id));
                                        if (!curGroup) return null;
                                        const otherDuplicates = curGroup.cards.filter(c => c.id !== formData.id);
                                        if (otherDuplicates.length === 0) return null;

                                        return (
                                            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4 animate-fadeIn">
                                                <div className="flex items-start gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shrink-0 mt-0.5">
                                                        <i className="fa-solid fa-triangle-exclamation"></i>
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex items-center justify-between gap-2 mb-1">
                                                            <h4 className="text-sm font-bold text-amber-800">
                                                                發現 {otherDuplicates.length} 筆相同或極為相似的名片
                                                            </h4>
                                                            <button
                                                                onClick={() => setShowDuplicateManager(true)}
                                                                className="text-xs font-bold text-amber-800 bg-amber-200/70 hover:bg-amber-200 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
                                                            >
                                                                <i className="fa-solid fa-layer-group text-[10px]"></i>
                                                                開啟重複管理
                                                            </button>
                                                        </div>
                                                        <p className="text-xs text-amber-700/80 mb-3">
                                                            比對原因：{curGroup.reason}
                                                        </p>
                                                        <div className="flex flex-col gap-2">
                                                            {otherDuplicates.map(dup => (
                                                                <div key={dup.id} className="flex items-center justify-between bg-white/80 p-2.5 rounded-lg border border-amber-200/60 shadow-xs">
                                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                                        <CardThumbnail card={dup} size="sm" />
                                                                        <div className="truncate">
                                                                            <div className="text-xs font-bold text-slate-700 truncate">
                                                                                {dup.lastName || ''}{dup.firstName || ''} {dup.title ? `(${dup.title})` : ''}
                                                                            </div>
                                                                            <div className="text-[10px] text-slate-500 truncate">
                                                                                {dup.company || '無公司'} • {dup.email || dup.phone || '無聯絡資訊'}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <button 
                                                                        onClick={() => { selectCard(dup.id); setViewMode('detail'); }}
                                                                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-md transition-colors whitespace-nowrap"
                                                                    >
                                                                        查看此筆
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    <div className="grid grid-cols-12 gap-x-4 gap-y-3 items-start">
                                        {/* Row 0: Category Switcher (Always Rendered) */}
                                        <div className="col-span-12 mb-3">
                                            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                                                <div className="flex items-center justify-between mb-2.5">
                                                    <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                                        <i className="fa-solid fa-layer-group text-indigo-600"></i> QS 名片分類 (Classification)
                                                    </label>
                                                    <span className={`text-xs font-black px-2.5 py-0.5 rounded-full uppercase flex items-center gap-1.5 border shadow-2xs ${
                                                        formData.category === 'academic' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                        formData.category === 'staff' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                        formData.category === 'other' ? 'bg-slate-100 text-slate-700 border-slate-200' :
                                                        'bg-blue-50 text-blue-700 border-blue-200'
                                                    }`}>
                                                        <span className="w-1.5 h-1.5 rounded-full" style={{
                                                            backgroundColor: formData.category === 'academic' ? '#d97706' :
                                                                            formData.category === 'staff' ? '#059669' :
                                                                            formData.category === 'other' ? '#64748b' : '#2563eb'
                                                        }}></span>
                                                        目前：{
                                                            formData.category === 'employer' ? '🏢 QS 雇主' :
                                                            formData.category === 'academic' ? '🎓 QS 學者' :
                                                            formData.category === 'staff' ? '🤝 QS 職員' :
                                                            '🚫 非 QS'
                                                        }
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                    {[
                                                        { id: 'employer', label: 'QS 雇主', sub: 'Employer', icon: 'fa-briefcase', emoji: '🏢', activeCls: 'bg-blue-600 text-white shadow-md ring-2 ring-blue-500/20' },
                                                        { id: 'academic', label: 'QS 學者', sub: 'Academic', icon: 'fa-graduation-cap', emoji: '🎓', activeCls: 'bg-amber-500 text-white shadow-md ring-2 ring-amber-500/20' },
                                                        { id: 'staff', label: 'QS 職員', sub: 'Staff', icon: 'fa-user-tag', emoji: '🤝', activeCls: 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-500/20' },
                                                        { id: 'other', label: '非 QS', sub: 'Not QS', icon: 'fa-ban', emoji: '🚫', activeCls: 'bg-slate-600 text-white shadow-md ring-2 ring-slate-500/20' }
                                                    ].map(cat => {
                                                        const isSelected = formData.category === cat.id;
                                                        return (
                                                            <button
                                                                key={cat.id}
                                                                type="button"
                                                                onClick={() => {
                                                                    updateField('category', cat.id);
                                                                    const updatedCard = { ...formData, category: cat.id as any };
                                                                    setCards(prev => prev.map(c => c.id === formData.id ? updatedCard : c));
                                                                    saveCardToDB(updatedCard);
                                                                }}
                                                                className={`py-2 px-2.5 rounded-xl text-xs font-black transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer border ${
                                                                    isSelected
                                                                        ? `${cat.activeCls} border-transparent scale-[1.02]`
                                                                        : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-slate-200'
                                                                }`}
                                                            >
                                                                <div className="flex items-center gap-1.5">
                                                                    <span>{cat.emoji}</span>
                                                                    <span>{cat.label}</span>
                                                                </div>
                                                                <span className={`text-[10px] font-semibold uppercase tracking-wider ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                                                                    {cat.sub}
                                                                </span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Row 0.5: Summary Field (NEW) */}
                                        <div className="col-span-12 mb-2">
                                            <EditableField 
                                                label="Intro Summary (簡介)" 
                                                value={formData.summary} 
                                                onChange={v => updateField('summary', v)} 
                                                icon="fa-user-pen" 
                                                isTextArea
                                                className="bg-emerald-50/30 p-2 rounded-lg border border-emerald-100"
                                            />
                                        </div>

                                        {/* Row 1: Identity */}
                                        <div className="col-span-12 md:col-span-3">
                                            <EditableField label="Prefix (稱謂)" value={formData.prefix} onChange={v => updateField('prefix', v)} icon="fa-user-tag" />
                                        </div>
                                        <div className="col-span-12 md:col-span-4">
                                            <EditableField label="Last Name (姓氏)" value={formData.lastName} onChange={v => updateField('lastName', v)} />
                                        </div>
                                        <div className="col-span-12 md:col-span-5">
                                            <EditableField label="First Name (名字)" value={formData.firstName} onChange={v => updateField('firstName', v)} />
                                        </div>

                                        {/* Row 2: Professional */}
                                        <div className="col-span-12 md:col-span-6">
                                            <EditableField label="Job Title / Position (職稱)" value={formData.title} translation={formData.translations?.title} onChange={v => updateField('title', v)} icon="fa-id-badge" />
                                        </div>
                                        <div className="col-span-12 md:col-span-6">
                                            <EditableField label="Company / Institution (公司/機構)" value={formData.company} translation={formData.translations?.company} onChange={v => updateField('company', v)} icon="fa-building" />
                                        </div>

                                        {/* Row 3: Org Details */}
                                        <div className="col-span-12 md:col-span-4">
                                            <EditableField label="Department (部門)" value={formData.department} translation={formData.translations?.department} onChange={v => updateField('department', v)} />
                                        </div>
                                        <div className="col-span-12 md:col-span-4">
                                            <EditableField label="Industry (產業)" value={formData.industry} translation={formData.translations?.industry} onChange={v => updateField('industry', v)} />
                                        </div>
                                        <div className="col-span-12 md:col-span-4">
                                            {formData.category === 'academic' ? (
                                                <EditableField label="Subject (學科)" value={formData.subject} translation={formData.translations?.subject} onChange={v => updateField('subject', v)} icon="fa-book" className="bg-amber-50/50 rounded" />
                                            ) : (
                                                <EditableField 
                                                    label="Country (國家)" 
                                                    value={formData.country} 
                                                    translation={formData.translations?.country} 
                                                    onChange={v => updateField('country', v)} 
                                                    onBlur={() => {
                                                        if (formData.country) updateField('country', normalizeCountry(formData.country));
                                                    }}
                                                    options={STANDARD_COUNTRY_OPTIONS}
                                                    placeholder="例如: Taiwan SAR"
                                                    icon="fa-flag" 
                                                />
                                            )}
                                        </div>

                                        {/* Row 4: Digital Contact */}
                                        <div className="col-span-12 md:col-span-6">
                                            <EditableField label="Email" value={formData.email} onChange={v => updateField('email', v)} icon="fa-envelope" />
                                        </div>
                                        <div className="col-span-12 md:col-span-6">
                                            <EditableField label="Website" value={formData.website} onChange={v => updateField('website', v)} icon="fa-globe" />
                                        </div>

                                        {/* Row 5: Phone & Fax */}
                                        <div className="col-span-12 md:col-span-6">
                                            <EditableField label="Phone" value={formData.phone} onChange={v => updateField('phone', v)} icon="fa-phone" />
                                        </div>
                                        <div className="col-span-12 md:col-span-6">
                                            <EditableField label="Fax" value={formData.fax} onChange={v => updateField('fax', v)} icon="fa-fax" />
                                        </div>
                                        
                                        {/* Row 6: Extra (Country for Academic if not shown above) */}
                                        {formData.category === 'academic' && (
                                            <div className="col-span-12 md:col-span-6">
                                                <EditableField 
                                                    label="Country (國家)" 
                                                    value={formData.country} 
                                                    translation={formData.translations?.country} 
                                                    onChange={v => updateField('country', v)} 
                                                    onBlur={() => {
                                                        if (formData.country) updateField('country', normalizeCountry(formData.country));
                                                    }}
                                                    options={STANDARD_COUNTRY_OPTIONS}
                                                    placeholder="例如: Taiwan SAR"
                                                    icon="fa-flag" 
                                                />
                                            </div>
                                        )}

                                        {/* Row 7: Address (Full Width) */}
                                        <div className="col-span-12">
                                            <EditableField label="Address" value={formData.address} onChange={v => updateField('address', v)} icon="fa-location-dot" />
                                        </div>

                                        {/* Row 8: Reasoning & Notes (Compact Side-by-Side) */}
                                        <div className="col-span-12 md:col-span-6 bg-indigo-50/50 p-3 rounded-lg border border-indigo-100">
                                            <h4 className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-1 flex items-center gap-2">
                                                <i className="fa-solid fa-wand-magic-sparkles"></i> AI Classification Reasoning
                                            </h4>
                                            <p className="text-sm text-slate-600 leading-tight font-medium h-20 overflow-y-auto whitespace-pre-line">{formData.reasoning}</p>
                                        </div>
                                        <div className="col-span-12 md:col-span-6">
                                            <EditableField label="Notes" value={formData.notes} onChange={v => updateField('notes', v)} icon="fa-sticky-note" isTextArea className="h-full" />
                                        </div>
                                    </div>

                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Empty State */
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 p-6">
                            <div className="w-24 h-24 bg-white rounded-[2rem] shadow-xl shadow-indigo-100 flex items-center justify-center mb-6 animate-float">
                                <span className="text-5xl">📇✨</span>
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800 mb-2">準備開始工作啦！ 🚀</h2>
                            <p className="max-w-md text-center text-slate-500 mb-6 leading-relaxed">
                                點擊左邊的名片，讓我為你展示詳細資訊吧！<br/>或是拖曳檔案進來開始掃描～ 🪄✨
                            </p>
                            <div className="flex gap-4 text-xs font-medium text-slate-500">
                                <div className="bg-white border border-slate-200 px-4 py-2 rounded-lg shadow-sm flex items-center gap-2">
                                    <i className="fa-regular fa-image text-indigo-500"></i>
                                    <span>名片掃描 (JPG, PNG, PDF)</span>
                                </div>
                                <div className="bg-white border border-slate-200 px-4 py-2 rounded-lg shadow-sm flex items-center gap-2">
                                    <i className="fa-solid fa-rotate text-emerald-500"></i>
                                    <span>資料還原 (JSON)</span>
                                </div>
                            </div>
                            <p className="mt-4 text-[10px] text-red-400 bg-red-50 px-3 py-1 rounded">注意：系統不支援 Excel 備份還原</p>
                        </div>
                    )}
                 </div>
             </>
         )}

      </main>

      {/* Duplicate Manager Modal */}
      {showDuplicateManager && (
          <DuplicateManagerModal
              groups={duplicateAnalysis.groups}
              onClose={() => setShowDuplicateManager(false)}
              onAutoCleanAll={handleAutoDeduplicate}
              onDeleteSingle={handleDeleteDuplicateSingle}
              onBatchDelete={handleBatchDeleteDuplicateCards}
              isProcessing={isDeduplicating}
          />
      )}

      {/* Duplicate File Prompt Modal */}
      {duplicateFilePrompt && (
          <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-fadeIn">
              <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 text-center">
                  <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <i className="fa-solid fa-file-circle-exclamation text-2xl"></i>
                  </div>
                  <h3 className="text-xl font-black text-slate-800 mb-2">檔案可能已存在</h3>
                  <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                      系統偵測到檔案 <strong>{duplicateFilePrompt.fileName}</strong> 似乎已經上傳過。請問您要繼續處理這個檔案嗎？
                  </p>
                  <div className="flex flex-col gap-3">
                      <button 
                          onClick={() => duplicateFilePrompt.resolve('process')} 
                          className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors shadow-md flex items-center justify-center gap-2"
                      >
                          <i className="fa-solid fa-play"></i> 繼續處理
                      </button>
                      <button 
                          onClick={() => duplicateFilePrompt.resolve('skip')} 
                          className="w-full bg-slate-100 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                      >
                          <i className="fa-solid fa-forward-step"></i> 跳過此檔案
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Duplicate Prompt Modal */}
      {duplicatePrompt && (
          <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-fadeIn">
              <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 text-center">
                  <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <i className="fa-solid fa-triangle-exclamation text-2xl"></i>
                  </div>
                  <h3 className="text-xl font-black text-slate-800 mb-2">發現重複或相似名片</h3>
                  <p className="text-sm text-slate-500 mb-3 leading-relaxed">
                      系統偵測到您掃描的名片 <strong>{(duplicatePrompt.newCard as any).name || `${duplicatePrompt.newCard.lastName || ''}${duplicatePrompt.newCard.firstName || ''}`}</strong> ({duplicatePrompt.newCard.company}) 已經存在於資料庫中，或與現有名片高度相似。
                  </p>
                  {duplicatePrompt.reason && (
                      <div className="bg-amber-50 border border-amber-100 text-amber-800 text-xs py-2 px-3 rounded-lg font-medium mb-4 inline-flex items-center gap-1.5">
                          <i className="fa-solid fa-circle-info"></i>
                          <span>相似原因：{duplicatePrompt.reason}</span>
                      </div>
                  )}
                  <div className="flex flex-col gap-3">
                      <button 
                          onClick={() => duplicatePrompt.resolve('replace')} 
                          className="w-full bg-amber-500 text-white font-bold py-3 rounded-xl hover:bg-amber-600 transition-colors shadow-md flex items-center justify-center gap-2"
                      >
                          <i className="fa-solid fa-arrows-rotate"></i> 覆蓋舊資料 (保留新掃描)
                      </button>
                      <button 
                          onClick={() => duplicatePrompt.resolve('keep')} 
                          className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-colors shadow-md flex items-center justify-center gap-2"
                      >
                          <i className="fa-solid fa-copy"></i> 皆保留 (建立新的一筆)
                      </button>
                      <button 
                          onClick={() => duplicatePrompt.resolve('discard')} 
                          className="w-full bg-slate-100 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-200 transition-colors"
                      >
                          刪除新掃描 (保留舊資料)
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Initial Notion Prompt Modal */}
      {showNotionPrompt && (
          <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-fadeIn">
              <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 text-center">
                  <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <i className="fa-solid fa-cloud-arrow-down text-2xl"></i>
                  </div>
                  <h3 className="text-xl font-black text-slate-800 mb-2">要接入 Notion 資料嗎？</h3>
                  <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                      系統偵測到您剛進入 APP，是否要立即從 Notion 載入您之前新增的名片資料？
                  </p>
                  <div className="flex flex-col gap-3">
                      <button 
                          onClick={() => {
                              setShowNotionPrompt(false);
                              handleLoadFromNotion();
                          }} 
                          className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200 flex items-center justify-center gap-2"
                      >
                          <i className="fa-solid fa-check"></i> 是的，立即載入
                      </button>
                      <button 
                          onClick={() => setShowNotionPrompt(false)} 
                          className="w-full bg-slate-100 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-200 transition-colors"
                      >
                          先不要
                      </button>
                  </div>
              </div>
          </div>
      )}

      {isNotionLoading && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center backdrop-blur-sm">
            <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4 max-w-sm w-full mx-4 animate-fadeIn">
                <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                <div className="text-center">
                    <h3 className="text-lg font-bold text-slate-800 mb-1">
                        {syncProgress ? '正在新增至 Notion... 🚀' : '正在載入 Notion 資料... 📥'}
                    </h3>
                    <p className="text-slate-500 text-sm">
                        {syncProgress 
                            ? `已新增 ${syncProgress.current} / ${syncProgress.total} 筆`
                            : `已載入 ${notionProgress.loaded} 筆`
                        }
                    </p>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-2">
                    {syncProgress ? (
                        <div 
                            className="h-full bg-indigo-500 rounded-full transition-all duration-300" 
                            style={{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }}
                        ></div>
                    ) : (
                        <div className="h-full bg-indigo-500 w-1/3 rounded-full relative overflow-hidden animate-[scan_2s_linear_infinite]"></div>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* QS Confirmation & Review Modal */}
      <QsConfirmationModal
        isOpen={isQsModalOpen}
        onClose={() => setIsQsModalOpen(false)}
        selectedCardIds={selectedCardIds}
        allCards={cards}
        onToggleCard={handleToggleCardSelect}
        onSelectAll={() => handleSelectCategory('all')}
        onDeselectAll={handleDeselectAll}
        onUpdateCardCategory={handleUpdateCardCategory}
        onStandardizeSelectedCountries={handleStandardizeSelectedCountries}
        onExport={handleExportCustomList}
        isExporting={isExporting}
        onOpenCardDetail={(id) => {
          selectCard(id);
          setViewMode('detail');
          setIsQsModalOpen(false);
        }}
      />

      {/* Notion Trash Scan & Restore Modal */}
      <NotionTrashModal
        isOpen={showNotionTrashModal}
        onClose={() => setShowNotionTrashModal(false)}
        onLoadAllFromNotion={handleLoadFromNotion}
        onRestoredCards={(restored) => {
          setCards(prev => {
            const existingIds = new Set(prev.map(c => c.id));
            const newOnes = restored.filter(c => !existingIds.has(c.id));
            const updated = prev.map(c => {
              const r = restored.find(item => item.id === c.id);
              return r || c;
            });
            return [...newOnes, ...updated].sort((a, b) => b.scannedAt - a.scannedAt);
          });
        }}
      />

      {/* Global Floating QS Review Pill when cards are selected (visible in detail/file views) */}
      {selectedCardIds.size > 0 && viewMode !== 'search' && (
          <div className="fixed bottom-5 right-6 z-40 bg-slate-900/95 text-white px-4 py-2.5 rounded-2xl shadow-2xl border border-slate-700/80 backdrop-blur-md flex items-center gap-3 animate-fadeIn">
              <div className="flex items-center gap-2">
                  <span className="flex h-2.5 w-2.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
                  </span>
                  <span className="text-xs font-bold text-slate-200">
                      已選 <span className="text-indigo-400 font-black">{selectedCardIds.size}</span> 位 QS
                  </span>
              </div>
              <button
                  type="button"
                  onClick={() => setIsQsModalOpen(true)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-indigo-900 transition-all cursor-pointer"
              >
                  <i className="fa-solid fa-clipboard-check"></i>
                  <span>審查與匯出</span>
              </button>
              <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="text-xs text-slate-400 hover:text-rose-400 transition-colors cursor-pointer px-1.5 py-1"
                  title="清除勾選"
              >
                  <i className="fa-solid fa-xmark"></i>
              </button>
          </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes h-bounce { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(-25%); } }
        .animate-float { animation: float 4s ease-in-out infinite; }
        .animate-h-bounce { animation: h-bounce 1s infinite; }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out forwards; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scan { 
          0% { left: -50%; }
          100% { left: 150%; }
        }
      `}</style>
    </div>
  );
};

export default App;
