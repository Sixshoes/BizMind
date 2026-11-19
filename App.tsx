import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { User } from 'firebase/auth';
import {
  ScanLine,
  Database,
  LayoutPanelLeft,
  Layers,
  Keyboard,
  Download,
  Settings,
  Camera,
  Plus,
  Search,
  ChevronDown,
  Check,
  Trash2,
  Loader2,
  RefreshCw,
  Upload,
  FileSpreadsheet,
  QrCode,
  Mail,
  Share2,
  Cloud,
  CloudUpload,
  Sparkles,
  ImageOff,
  ArrowLeft,
  AlertTriangle,
  FileWarning,
  CheckSquare,
  Square,
  CheckCircle2,
  RotateCw,
  ShieldCheck,
  BookOpen,
  RotateCcw,
  Type,
  FlipHorizontal2,
  Leaf,
  LogOut,
  LogIn,
} from 'lucide-react';

import {
  BusinessCardData,
  ProcessingTask,
  SearchPageState,
  DualSideConflictItem,
  DualSideResolutionStrategy,
} from './types';
import { filterCards } from './utils/cardFilters';
import { normalizeCountry, getCountryBilingualLabel } from './utils/countries';
import {
  inferCountryFromCard,
  auditCardQsCategory,
  getBoundQsSubmissionList,
  stripQsAuditNotes,
} from './utils/qsValidation';
import { detectBusinessCards, extractBackCardInfo } from './services/geminiService';
import {
  getCardById,
  saveCardToDB,
  saveCardLocalOnly,
  saveAllCardsToDB,
  deleteCardFromDB,
  deleteCardsFromDB,
  clearAllCardsFromDB,
} from './services/dbService';
import { uploadImageAsset } from './utils/firebase';
import {
  watchAuth,
  isGuestSessionActive,
  setGuestSessionActive,
  signInWithGoogle,
  signOut,
  authErrorMessage,
} from './utils/auth';
import { fetchCloudCards } from './utils/cardCloud';
import { createDemoCards } from './utils/demoCards';
import { createVCardFile } from './services/vcardService';

import LoginScreen from './components/LoginScreen';
import CameraScanner from './components/CameraScanner';
import SearchPage from './components/SearchPage';
import ChatBox from './components/ChatBox';
import { useToast } from './components/ToastProvider';
import { useConfirm } from './components/ConfirmDialogProvider';
import { TourOverlay, TourStep } from './components/TourOverlay';
import { QsConfirmationModal } from './components/QsConfirmationModal';
import { DuplicateManagerModal } from './components/DuplicateManagerModal';
import { SidebarCardItem } from './components/SidebarCardItem';
import { CropperWorkspace, CropRegion } from './components/CropperWorkspace';
import { CardDetailPanel } from './components/CardDetailPanel';
import { BatchEditBar } from './components/BatchEditBar';
import { QrCodeModal } from './components/QrCodeModal';
import { FollowUpEmailDrawer } from './components/FollowUpEmailDrawer';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { UserGuideModal } from './components/UserGuideModal';
import { DualSideConflictModal } from './components/DualSideConflictModal';
import { ThreeGoodImpactModal } from './components/ThreeGoodImpactModal';
import { compressImage } from './utils/imageUtils';
import {
  detectDualSideConflict,
  applyDualSideMerge,
  splitDualSideIntoTwoCards,
} from './utils/dualSideCardUtils';

import { useCardState } from './hooks/useCardState';
import { useImportExport } from './features/import-export/useImportExport';
import { useScanPipeline } from './features/scan-pipeline/useScanPipeline';
import { useBackgroundTasks } from './hooks/useBackgroundTasks';
import { analyzeDuplicates, mergeDuplicateCards } from './utils/duplicateUtils';

const pdfjs = (pdfjsLib as any).default || pdfjsLib;
if (pdfjs.GlobalWorkerOptions) {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.js',
    import.meta.url
  ).toString();
}

type ViewMode = 'camera' | 'file' | 'detail' | 'cropper' | 'search';

const CATEGORY_DISPLAY_LABELS: Record<BusinessCardData['category'], string> = {
  employer: '企業夥伴',
  academic: '學研專家',
  staff: '機關社團',
  other: '一般聯絡人',
};

const App: React.FC = () => {
  // --- Auth & Session State ---
  const [authUser, setAuthUser] = useState<User | null | undefined>(undefined);
  const [isGuestMode, setIsGuestMode] = useState<boolean>(() => isGuestSessionActive());
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);

  // --- Core Card State & Auto-Save ---
  const {
    cards,
    setCards,
    cardsRef,
    selectedCardId,
    setSelectedCardId,
    selectCard,
    formData,
    setFormData,
    saveStatus,
    scheduleAutoSave,
    flushPendingSave,
    persistCardNow,
    tasks,
    setTasks,
    loadCards,
    updateCardInList,
  } = useCardState();

  const { addToast } = useToast();
  const confirm = useConfirm();

  // --- Workspace & Navigation State ---
  const [viewMode, setViewMode] = useState<ViewMode>('search');
  const [cameraTarget, setCameraTarget] = useState<'new_card' | 'back_side'>('new_card');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [activeCategory, setActiveCategory] = useState<
    'all' | 'employer' | 'academic' | 'staff' | 'other'
  >('all');
  const [activeCountry, setActiveCountry] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [externalChatQuery, setExternalChatQuery] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showMobileUploadHint, setShowMobileUploadHint] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState<number>(-1);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);

  // --- Modals & Drawers State ---
  const [duplicatePrompt, setDuplicatePrompt] = useState<any>(null);
  const [duplicateFilePrompt, setDuplicateFilePrompt] = useState<any>(null);
  const [showDuplicateManager, setShowDuplicateManager] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [showUserGuideModal, setShowUserGuideModal] = useState(false);
  const [showImpactModal, setShowImpactModal] = useState(false);
  const [fontScale, setFontScale] = useState<'standard' | 'comfortable' | 'large'>(() => {
    const saved = localStorage.getItem('bizmind_font_scale');
    if (saved === 'standard' || saved === 'comfortable' || saved === 'large') return saved;
    return 'comfortable';
  });
  const [qrModalCard, setQrModalCard] = useState<BusinessCardData | null>(null);
  const [emailDrawerCard, setEmailDrawerCard] = useState<BusinessCardData | null>(null);
  const [isDeduplicating, setIsDeduplicating] = useState(false);
  const [sidebarDisplayLimit, setSidebarDisplayLimit] = useState(60);

  // --- Multi-Selection, Roster Review & Dual-Side Reorganization State ---
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
  const [isQsModalOpen, setIsQsModalOpen] = useState(false);
  const [isAutoUprighting, setIsAutoUprighting] = useState(false);
  const [dualSideConflictQueue, setDualSideConflictQueue] = useState<DualSideConflictItem[]>([]);
  const [isResolvingDualConflict, setIsResolvingDualConflict] = useState(false);
  const [dualSideReorgProgress, setDualSideReorgProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  // --- Search / Database Persistent Filter State ---
  const [searchPageState, setSearchPageState] = useState<SearchPageState>({
    query: '',
    sortBy: 'name_asc',
    isGrouped: true,
    displayMode: 'table',
    filterHasEmail: false,
    filterHasPhone: false,
    filterCategory: 'all',
    filterCountry: 'all',
    filterTag: 'all',
    filterSource: 'all',
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

  const { isExporting, handleExport, handleJsonImport, handleCsvImport } = useImportExport(
    cards,
    setCards,
    formData,
    isMobile,
    runBackgroundSummaryCheck
  );

  const { handleRetryTask, processBatchFiles } = useScanPipeline(
    cardsRef,
    setCards,
    tasks,
    setTasks,
    filesMap,
    setDuplicatePrompt,
    setDuplicateFilePrompt
  );

  // --- Auth & Cloud Sync Lifecycle ---
  useEffect(() => {
    const unsubscribe = watchAuth(async (user) => {
      setAuthUser(user);
      if (user) {
        setIsGuestMode(false);
        setIsCloudSyncing(true);
        try {
          const cloudCards = await fetchCloudCards();
          for (const remote of cloudCards) {
            await saveCardLocalOnly({
              ...remote,
              ownerUid: user.uid,
              syncStatus: 'firebase',
            });
          }
        } catch (err) {
          console.error('Failed to pull cloud cards:', err);
        } finally {
          await loadCards();
          setIsCloudSyncing(false);
        }
      } else if (isGuestSessionActive()) {
        setIsGuestMode(true);
        await loadCards();
      } else {
        setIsGuestMode(false);
        setCards([]);
        setSelectedCardId(null);
        setFormData(null);
      }
    });
    return () => unsubscribe();
  }, [loadCards, setCards, setSelectedCardId, setFormData]);

  const handleLoadDemoCards = useCallback(async () => {
    try {
      const demos = createDemoCards();
      await saveAllCardsToDB(demos);
      await loadCards();
      addToast({
        type: 'success',
        message: '已載入 6 筆跨領域示範名片，可直接體驗篩選、QR 名片與問候信草稿！',
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        message: `載入示範名片失敗：${err.message || '未知錯誤'}`,
      });
    }
  }, [loadCards, addToast]);

  const handleEnterGuestMode = useCallback(
    async (withDemoCards = false) => {
      setGuestSessionActive(true);
      setIsGuestMode(true);
      if (withDemoCards) {
        const demos = createDemoCards();
        await saveAllCardsToDB(demos);
      }
      await loadCards();
      addToast({
        type: 'success',
        message: withDemoCards
          ? '已進入本機體驗模式並載入 6 筆示範聯絡人'
          : '已進入本機體驗工作區',
      });
    },
    [loadCards, addToast]
  );

  const handleManualCloudSync = useCallback(async () => {
    if (!authUser) return;
    setIsCloudSyncing(true);
    try {
      await flushPendingSave();
      const unsynced = cards.filter((c) => c.syncStatus !== 'firebase');
      if (unsynced.length > 0) {
        await saveAllCardsToDB(unsynced);
      }
      const remoteCards = await fetchCloudCards();
      for (const remote of remoteCards) {
        await saveCardLocalOnly({
          ...remote,
          ownerUid: authUser.uid,
          syncStatus: 'firebase',
        });
      }
      await loadCards();
      addToast({ type: 'success', message: '已完成個人雲端雙向同步' });
    } catch (err: any) {
      addToast({ type: 'error', message: `雲端同步失敗：${err.message || '未知錯誤'}` });
    } finally {
      setIsCloudSyncing(false);
    }
  }, [authUser, cards, flushPendingSave, loadCards, addToast]);

  const handleSwitchToGoogleLogin = useCallback(async () => {
    setShowSettingsMenu(false);
    try {
      await signInWithGoogle();
      addToast({ type: 'success', message: '已成功登入 Google 個人雲端帳號' });
    } catch (err) {
      addToast({ type: 'error', message: authErrorMessage(err) });
    }
  }, [addToast]);

  const handleSignOut = useCallback(async () => {
    setShowSettingsMenu(false);
    await flushPendingSave();
    await signOut();
    setIsGuestMode(false);
    setSelectedCardId(null);
    setFormData(null);
    setSelectedCardIds(new Set());
    setCards([]);
  }, [flushPendingSave, setSelectedCardId, setFormData, setCards]);

  // --- Cropper State ---
  const [cropperImage, setCropperImage] = useState<string | null>(null);
  const [cropRegions, setCropRegions] = useState<CropRegion[]>([]);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPdfPage, setCurrentPdfPage] = useState(1);
  const [isRenderingPdf, setIsRenderingPdf] = useState(false);
  const [isAiDetecting, setIsAiDetecting] = useState(false);

  // --- Debounced Duplicate Analysis (Prevents blocking keystrokes) ---
  const [debouncedCards, setDebouncedCards] = useState<BusinessCardData[]>(cards);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedCards(cards);
    }, 400);
    return () => clearTimeout(timer);
  }, [cards]);

  const duplicateAnalysis = useMemo(() => {
    return analyzeDuplicates(debouncedCards);
  }, [debouncedCards]);

  const duplicateIds = duplicateAnalysis.duplicateCardIds;

  const boundQsSummary = useMemo(() => {
    return getBoundQsSubmissionList(debouncedCards);
  }, [debouncedCards]);

  // --- Tag & Source Suggestions ---
  const { existingTags, existingSources, sidebarCountries } = useMemo(() => {
    const tagSet = new Set<string>();
    const sourceSet = new Set<string>();
    const countryMap = new Map<string, number>();

    cards.forEach((c) => {
      (c.tags || []).forEach((t) => {
        if (t.trim()) tagSet.add(t.trim());
      });
      if (c.source && c.source.trim()) {
        sourceSet.add(c.source.trim());
      }
      const rawCtry = (c.country || c.translations?.country || '').trim();
      const ctry = normalizeCountry(rawCtry);
      if (ctry) {
        countryMap.set(ctry, (countryMap.get(ctry) || 0) + 1);
      }
    });

    return {
      existingTags: Array.from(tagSet).sort(),
      existingSources: Array.from(sourceSet).sort(),
      sidebarCountries: Array.from(countryMap.entries()).sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-Hant')
      ),
    };
  }, [cards]);

  const visibleCards = useMemo(() => {
    const filtered = filterCards(cards, {
      searchText: searchQuery,
      category: activeCategory,
      country: activeCountry,
    });
    return [...filtered].sort((a, b) => {
      const aDup = duplicateIds.has(a.id);
      const bDup = duplicateIds.has(b.id);
      if (aDup && !bDup) return -1;
      if (!aDup && bDup) return 1;
      return b.scannedAt - a.scannedAt;
    });
  }, [cards, activeCategory, activeCountry, searchQuery, duplicateIds]);

  // --- Window Listeners ---
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target as Node)) {
        setShowSettingsMenu(false);
      }
      if (shareMenuRef.current && !shareMenuRef.current.contains(event.target as Node)) {
        setShowShareMenu(false);
      }
    };

    window.addEventListener('resize', handleResize);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.fontScale = fontScale;
    localStorage.setItem('bizmind_font_scale', fontScale);
  }, [fontScale]);

  const handleCycleFontScale = useCallback(() => {
    const next =
      fontScale === 'standard'
        ? 'comfortable'
        : fontScale === 'comfortable'
          ? 'large'
          : 'standard';
    const labelMap = {
      standard: '標準字級',
      comfortable: '舒適字級（預設）',
      large: '放大字級（高易讀模式）',
    };
    setFontScale(next);
    addToast({ type: 'info', message: `已切換顯示字體大小：${labelMap[next]}` });
  }, [fontScale, addToast]);

  // --- Global Keyboard Shortcuts ---
  useEffect(() => {
    if (!authUser && !isGuestMode) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        flushPendingSave();
        setViewMode((prev) => (prev === 'search' ? 'detail' : 'search'));
        return;
      }

      const activeEl = document.activeElement as HTMLElement | null;
      const isTypingInInput =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT' ||
          activeEl.isContentEditable);

      if (isTypingInInput) return;

      if (
        isQsModalOpen ||
        showDuplicateManager ||
        showUserGuideModal ||
        showImpactModal ||
        dualSideConflictQueue.length > 0 ||
        tourStepIndex >= 0 ||
        Boolean(qrModalCard) ||
        Boolean(emailDrawerCard) ||
        Boolean(duplicatePrompt) ||
        Boolean(duplicateFilePrompt)
      ) {
        return;
      }

      if (event.key === '?') {
        event.preventDefault();
        setShowShortcutsModal((prev) => !prev);
        return;
      }

      if (viewMode === 'detail' || viewMode === 'file') {
        if (event.key === 'j' || event.key === 'ArrowDown') {
          if (visibleCards.length === 0) return;
          event.preventDefault();
          const curIdx = visibleCards.findIndex((c) => c.id === selectedCardId);
          const nextIdx = curIdx < 0 ? 0 : Math.min(visibleCards.length - 1, curIdx + 1);
          selectCard(visibleCards[nextIdx].id);
          setViewMode('detail');
          return;
        }

        if (event.key === 'k' || event.key === 'ArrowUp') {
          if (visibleCards.length === 0) return;
          event.preventDefault();
          const curIdx = visibleCards.findIndex((c) => c.id === selectedCardId);
          const prevIdx = curIdx <= 0 ? 0 : curIdx - 1;
          selectCard(visibleCards[prevIdx].id);
          setViewMode('detail');
          return;
        }

        if (formData) {
          if (event.key === '1') {
            event.preventDefault();
            persistCardNow({ ...formData, category: 'employer' });
            addToast({ type: 'info', message: '已切換分類：企業夥伴' });
          } else if (event.key === '2') {
            event.preventDefault();
            persistCardNow({ ...formData, category: 'academic' });
            addToast({ type: 'info', message: '已切換分類：學研專家' });
          } else if (event.key === '3') {
            event.preventDefault();
            persistCardNow({ ...formData, category: 'staff' });
            addToast({ type: 'info', message: '已切換分類：機關社團' });
          } else if (event.key === '4') {
            event.preventDefault();
            persistCardNow({ ...formData, category: 'other' });
            addToast({ type: 'info', message: '已切換分類：一般聯絡人' });
          } else if (event.key.toLowerCase() === 'q') {
            event.preventDefault();
            setQrModalCard(formData);
          } else if (event.key.toLowerCase() === 'e') {
            event.preventDefault();
            setEmailDrawerCard(formData);
          }
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    authUser,
    isGuestMode,
    flushPendingSave,
    isQsModalOpen,
    showDuplicateManager,
    showUserGuideModal,
    showImpactModal,
    dualSideConflictQueue.length,
    tourStepIndex,
    qrModalCard,
    emailDrawerCard,
    duplicatePrompt,
    duplicateFilePrompt,
    viewMode,
    visibleCards,
    selectedCardId,
    selectCard,
    formData,
    persistCardNow,
    addToast,
  ]);

  useEffect(() => {
    if (selectedCardId && viewMode !== 'search') {
      setTimeout(() => {
        const el = document.getElementById(`card-list-item-${selectedCardId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 120);
    }
  }, [selectedCardId, viewMode]);

  // --- Card Update & Batch Handlers ---
  const handleQuickCategoryChange = useCallback(
    async (cardId: string, newCategory: 'employer' | 'academic' | 'staff' | 'other') => {
      const cardToUpdate = cards.find((c) => c.id === cardId);
      if (!cardToUpdate) return;
      const saved = await saveCardToDB({
        ...cardToUpdate,
        category: newCategory,
      });
      updateCardInList(saved);
      if (formData && formData.id === cardId) {
        setFormData(saved);
      }
      addToast({
        type: 'success',
        message: `已將分類更新為「${CATEGORY_DISPLAY_LABELS[newCategory]}」`,
      });
    },
    [cards, formData, addToast, updateCardInList, setFormData]
  );

  const handleBatchUpdateCategory = useCallback(
    async (category: 'employer' | 'academic' | 'staff' | 'other') => {
      if (selectedCardIds.size === 0) return;
      const toSave: BusinessCardData[] = [];
      const updatedAll = cards.map((c) => {
        if (!selectedCardIds.has(c.id)) return c;
        const next: BusinessCardData = { ...c, category };
        toSave.push(next);
        return next;
      });
      await saveAllCardsToDB(toSave);
      setCards(updatedAll);
      if (formData && selectedCardIds.has(formData.id)) {
        const refreshed = toSave.find((x) => x.id === formData.id);
        if (refreshed) setFormData(refreshed);
      }
      addToast({
        type: 'success',
        message: `已批次將 ${toSave.length} 筆名片設為「${CATEGORY_DISPLAY_LABELS[category]}」`,
      });
    },
    [cards, selectedCardIds, formData, setCards, setFormData, addToast]
  );

  const handleBatchUpdateCountry = useCallback(
    async (rawCountry: string) => {
      if (selectedCardIds.size === 0) return;
      const normalized = normalizeCountry(rawCountry);
      const toSave: BusinessCardData[] = [];
      const updatedAll = cards.map((c) => {
        if (!selectedCardIds.has(c.id)) return c;
        const next: BusinessCardData = {
          ...c,
          country: normalized,
          translations: c.translations
            ? { ...c.translations, country: normalized }
            : c.translations,
        };
        toSave.push(next);
        return next;
      });
      await saveAllCardsToDB(toSave);
      setCards(updatedAll);
      if (formData && selectedCardIds.has(formData.id)) {
        const refreshed = toSave.find((x) => x.id === formData.id);
        if (refreshed) setFormData(refreshed);
      }
      addToast({
        type: 'success',
        message: `已將 ${toSave.length} 筆名片的國家設為「${normalized}」`,
      });
    },
    [cards, selectedCardIds, formData, setCards, setFormData, addToast]
  );

  const handleBatchUpdateSource = useCallback(
    async (source: string) => {
      if (selectedCardIds.size === 0) return;
      const toSave: BusinessCardData[] = [];
      const updatedAll = cards.map((c) => {
        if (!selectedCardIds.has(c.id)) return c;
        const next: BusinessCardData = { ...c, source };
        toSave.push(next);
        return next;
      });
      await saveAllCardsToDB(toSave);
      setCards(updatedAll);
      if (formData && selectedCardIds.has(formData.id)) {
        const refreshed = toSave.find((x) => x.id === formData.id);
        if (refreshed) setFormData(refreshed);
      }
      addToast({
        type: 'success',
        message: `已將 ${toSave.length} 筆名片的活動來源設為「${source}」`,
      });
    },
    [cards, selectedCardIds, formData, setCards, setFormData, addToast]
  );

  const handleBatchAddTag = useCallback(
    async (tag: string) => {
      if (selectedCardIds.size === 0) return;
      const cleanTag = tag.trim();
      if (!cleanTag) return;
      const toSave: BusinessCardData[] = [];
      const updatedAll = cards.map((c) => {
        if (!selectedCardIds.has(c.id)) return c;
        const mergedTags = Array.from(new Set([...(c.tags || []), cleanTag]));
        const next: BusinessCardData = { ...c, tags: mergedTags };
        toSave.push(next);
        return next;
      });
      await saveAllCardsToDB(toSave);
      setCards(updatedAll);
      if (formData && selectedCardIds.has(formData.id)) {
        const refreshed = toSave.find((x) => x.id === formData.id);
        if (refreshed) setFormData(refreshed);
      }
      addToast({
        type: 'success',
        message: `已為 ${toSave.length} 筆名片新增標籤「#${cleanTag}」`,
      });
    },
    [cards, selectedCardIds, formData, setCards, setFormData, addToast]
  );

  const handleStandardizeAllCountries = useCallback(async () => {
    const modifiedList: BusinessCardData[] = [];
    const updatedCards = cards.map((c) => {
      const origC = c.country || '';
      const origTrans = c.translations?.country || '';
      const effectiveC = origC || origTrans;
      const normC = normalizeCountry(effectiveC);
      const normTrans = origTrans ? normalizeCountry(origTrans) : '';

      const changed =
        (!origC && normC) ||
        (origC && origC !== normC) ||
        (origTrans && origTrans !== normTrans);
      if (changed) {
        const next: BusinessCardData = {
          ...c,
          country: normC,
          translations: c.translations
            ? {
                ...c.translations,
                country: normTrans || normC || c.translations.country,
              }
            : undefined,
        };
        modifiedList.push(next);
        return next;
      }
      return c;
    });

    if (modifiedList.length === 0) {
      addToast({
        type: 'info',
        message: '所有名片的國家與地區名稱皆已符合國際標準格式',
      });
      return;
    }

    try {
      await saveAllCardsToDB(modifiedList);
      setCards(updatedCards);
      if (formData) {
        const currentUpdated = updatedCards.find((c) => c.id === formData.id);
        if (currentUpdated) setFormData(currentUpdated);
      }
      addToast({
        type: 'success',
        message: `已將 ${modifiedList.length} 筆名片的國家名稱統一為標準格式`,
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        message: `標準化失敗：${err.message}`,
      });
    }
  }, [cards, formData, addToast, setCards, setFormData]);

  const handleAutoFixQsCategories = useCallback(async () => {
    if (cards.length === 0) return;
    const toSave: BusinessCardData[] = [];
    let catFixed = 0;
    let ctryFixed = 0;

    const updatedCards = cards.map((c) => {
      let changed = false;
      let next: BusinessCardData = { ...c };

      const infCtry = inferCountryFromCard(next);
      if (infCtry && infCtry !== next.country) {
        next.country = infCtry;
        ctryFixed++;
        changed = true;
      }

      const cleanedReasoning = stripQsAuditNotes(next.reasoning);
      if (cleanedReasoning !== (next.reasoning || '').trim()) {
        next.reasoning = cleanedReasoning;
        changed = true;
      }

      const audit = auditCardQsCategory(next);
      if (audit.hasError && audit.suggestedCategory !== next.category) {
        next = {
          ...next,
          category: audit.suggestedCategory,
        };
        catFixed++;
        changed = true;
      }

      if (changed) {
        toSave.push(next);
      }
      return next;
    });

    if (toSave.length === 0) {
      addToast({
        type: 'success',
        message: '全庫聯絡人角色分類與國家欄位皆已通過健檢，無需修正',
      });
      return;
    }

    await saveAllCardsToDB(toSave);
    setCards(updatedCards);
    if (formData) {
      const refreshed = updatedCards.find((c) => c.id === formData.id);
      if (refreshed) setFormData(refreshed);
    }
    addToast({
      type: 'success',
      message: `已完成聯絡人資料健檢修正：更新 ${catFixed} 筆分類、補齊 ${ctryFixed} 筆國家`,
    });
  }, [cards, formData, setCards, setFormData, addToast]);

  const handleAutoUprightAllCards = useCallback(async () => {
    const withImages = cards.filter((c) => c.imageUrl);
    if (withImages.length === 0 || isAutoUprighting) {
      if (withImages.length === 0) {
        addToast({ type: 'info', message: '目前沒有包含影像的名片可供翻正' });
      }
      return;
    }

    setIsAutoUprighting(true);
    addToast({
      type: 'info',
      message: `正在檢測並自動翻正 ${withImages.length} 張名片影像方向...`,
    });

    try {
      const CHUNK = 60;
      const changedMap = new Map<string, { rotation: number; backRotation?: number }>();
      for (let i = 0; i < withImages.length; i += CHUNK) {
        const slice = withImages.slice(i, i + CHUNK).map((c) => ({
          id: c.id,
          imageUrl: c.imageUrl,
          backImageUrl: c.backImageUrl,
          rotation: c.rotation || 0,
          backRotation: c.backRotation || 0,
        }));
        const res = await fetch('/api/cards/auto-upright', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cards: slice }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || '自動翻正失敗');
        for (const u of json.updates || []) {
          if (u.changed) {
            changedMap.set(u.id, { rotation: u.rotation, backRotation: u.backRotation });
          }
        }
      }

      if (changedMap.size === 0) {
        addToast({ type: 'success', message: '全部名片影像皆已為正立方向，無需額外翻轉' });
        return;
      }

      const toSave: BusinessCardData[] = [];
      const updatedCards = cards.map((c) => {
        const r = changedMap.get(c.id);
        if (!r) return c;
        const next: BusinessCardData = {
          ...c,
          rotation: r.rotation,
          backRotation: r.backRotation !== undefined ? r.backRotation : c.backRotation,
        };
        toSave.push(next);
        return next;
      });

      await saveAllCardsToDB(toSave);
      setCards(updatedCards);
      if (formData && changedMap.has(formData.id)) {
        const refreshed = updatedCards.find((c) => c.id === formData.id);
        if (refreshed) setFormData(refreshed);
      }
      addToast({
        type: 'success',
        message: `已自動翻正 ${changedMap.size} 張橫躺或方向偏移的名片影像`,
      });
    } catch (err: any) {
      addToast({ type: 'error', message: `名片翻正失敗：${err.message || '未知錯誤'}` });
    } finally {
      setIsAutoUprighting(false);
    }
  }, [cards, formData, isAutoUprighting, setCards, setFormData, addToast]);

  // --- Dual-Side Smart Extraction, Conflict Resolution & Batch Reorganization ---
  const handleProcessBackSideExtraction = useCallback(
    async (targetCard: BusinessCardData, rawBase64: string) => {
      const extracted = await extractBackCardInfo(rawBase64, targetCard, 'image/jpeg');
      const cardWithRot: BusinessCardData =
        extracted.recommendedBackRotation !== undefined &&
        extracted.recommendedBackRotation !== (targetCard.backRotation || 0)
          ? {
              ...targetCard,
              backRotation: extracted.recommendedBackRotation,
            }
          : targetCard;

      const conflict = detectDualSideConflict(cardWithRot, extracted);
      if (conflict.hasConflict) {
        await persistCardNow(cardWithRot);
        setDualSideConflictQueue((prev) => [
          ...prev.filter((item) => item.card.id !== cardWithRot.id),
          {
            card: cardWithRot,
            extraction: extracted,
            conflictReason: conflict.conflictReason,
            isDifferentPerson: conflict.isDifferentPerson,
            isDifferentOrg: conflict.isDifferentOrg,
          },
        ]);
        addToast({
          type: 'info',
          message: '偵測到正反面機構或身分差異，請於對照視窗選擇合併或拆分方式',
        });
        return;
      }

      const { updatedCard, highlights } = applyDualSideMerge(cardWithRot, extracted, 'auto');
      await persistCardNow(updatedCard);
      addToast({
        type: 'success',
        message:
          highlights.length > 0
            ? `雙面整合完成：${highlights.join(' · ')}`
            : '已完成雙面資訊比對與欄位合併',
      });
    },
    [persistCardNow, addToast]
  );

  const handleResolveDualSideConflict = useCallback(
    async (
      item: DualSideConflictItem,
      strategy: Exclude<DualSideResolutionStrategy, 'auto'>
    ) => {
      setIsResolvingDualConflict(true);
      try {
        const baseCard: BusinessCardData =
          item.extraction.recommendedBackRotation !== undefined
            ? { ...item.card, backRotation: item.extraction.recommendedBackRotation }
            : item.card;

        if (strategy === 'split_into_two') {
          const { cleanedFrontCard, newBackCard } = splitDualSideIntoTwoCards(
            baseCard,
            item.extraction
          );
          await saveAllCardsToDB([cleanedFrontCard, newBackCard]);
          setCards((prev) => {
            const updated = prev.map((c) => (c.id === cleanedFrontCard.id ? cleanedFrontCard : c));
            return [newBackCard, ...updated];
          });
          if (formData && formData.id === cleanedFrontCard.id) {
            setFormData(cleanedFrontCard);
          }
          runBackgroundSummaryCheck([newBackCard]);
          const newLabel =
            `${newBackCard.firstName} ${newBackCard.lastName}`.trim() ||
            newBackCard.company ||
            '新聯絡人';
          addToast({
            type: 'success',
            message: `已拆分為兩筆獨立名片，新增「${newLabel}」`,
          });
        } else {
          const { updatedCard, highlights } = applyDualSideMerge(
            baseCard,
            item.extraction,
            strategy
          );
          const saved = await saveCardToDB(updatedCard);
          updateCardInList(saved);
          if (formData && formData.id === saved.id) {
            setFormData(saved);
          }
          addToast({
            type: 'success',
            message:
              highlights.length > 0
                ? `已套用雙面處理：${highlights.join(' · ')}`
                : '已儲存雙面名片處理結果',
          });
        }

        setDualSideConflictQueue((prev) => prev.filter((q) => q.card.id !== item.card.id));
      } catch (err: any) {
        addToast({
          type: 'error',
          message: `處理雙面衝突失敗：${err.message || '未知錯誤'}`,
        });
      } finally {
        setIsResolvingDualConflict(false);
      }
    },
    [formData, setCards, setFormData, updateCardInList, runBackgroundSummaryCheck, addToast]
  );

  const handleBatchReorganizeDualSideCards = useCallback(async () => {
    const dualCards = cards.filter((c) => Boolean(c.backImageUrl));
    if (dualCards.length === 0) {
      addToast({ type: 'info', message: '目前名片庫尚無包含反面影像的雙面名片' });
      return;
    }
    if (dualSideReorgProgress) return;

    setDualSideReorgProgress({ current: 0, total: dualCards.length });
    addToast({
      type: 'info',
      message: `開始批次重整 ${dualCards.length} 筆雙面名片（雙語升降、雙職稱整合與差異檢查）...`,
    });

    const autoMergedMap = new Map<string, BusinessCardData>();
    const collectedConflicts: DualSideConflictItem[] = [];
    let failedCount = 0;

    try {
      for (let i = 0; i < dualCards.length; i++) {
        const target = dualCards[i];
        setDualSideReorgProgress({ current: i + 1, total: dualCards.length });

        try {
          let rawBase64 = '';
          if (target.backImageUrl?.startsWith('data:image')) {
            rawBase64 = target.backImageUrl.split(',')[1] || '';
          } else if (target.backImageUrl) {
            try {
              const resp = await fetch(target.backImageUrl);
              if (resp.ok) {
                const blob = await resp.blob();
                rawBase64 = await compressImage(blob, 1400, 0.85);
              }
            } catch {
              rawBase64 = '';
            }
          }

          const extracted = await extractBackCardInfo(rawBase64, target, 'image/jpeg');
          const cardWithRot: BusinessCardData =
            extracted.recommendedBackRotation !== undefined &&
            extracted.recommendedBackRotation !== (target.backRotation || 0)
              ? {
                  ...target,
                  backRotation: extracted.recommendedBackRotation,
                }
              : target;

          const conflict = detectDualSideConflict(cardWithRot, extracted);
          if (conflict.hasConflict) {
            if (cardWithRot !== target) {
              autoMergedMap.set(cardWithRot.id, cardWithRot);
            }
            collectedConflicts.push({
              card: cardWithRot,
              extraction: extracted,
              conflictReason: conflict.conflictReason,
              isDifferentPerson: conflict.isDifferentPerson,
              isDifferentOrg: conflict.isDifferentOrg,
            });
          } else {
            const { updatedCard } = applyDualSideMerge(cardWithRot, extracted, 'auto');
            autoMergedMap.set(updatedCard.id, updatedCard);
          }
        } catch (err) {
          console.warn(`Dual-side batch reorg failed for card ${target.id}:`, err);
          failedCount++;
        }
      }

      if (autoMergedMap.size > 0) {
        const toSave = Array.from(autoMergedMap.values());
        await saveAllCardsToDB(toSave);
        const updatedList = cards.map((c) => autoMergedMap.get(c.id) || c);
        setCards(updatedList);
        if (formData && autoMergedMap.has(formData.id)) {
          const refreshed = autoMergedMap.get(formData.id);
          if (refreshed) setFormData(refreshed);
        }
      }

      if (collectedConflicts.length > 0) {
        setDualSideConflictQueue((prev) => {
          const incomingIds = new Set(collectedConflicts.map((x) => x.card.id));
          return [...prev.filter((p) => !incomingIds.has(p.card.id)), ...collectedConflicts];
        });
      }

      const autoCount = dualCards.length - collectedConflicts.length - failedCount;
      addToast({
        type: 'success',
        message:
          collectedConflicts.length > 0
            ? `已完成 ${autoCount} 筆雙面重整，另有 ${collectedConflicts.length} 筆機構或身分差異請於彈窗確認`
            : `已完成 ${autoCount} 筆雙面名片重整與分類對應`,
      });
    } finally {
      setDualSideReorgProgress(null);
    }
  }, [cards, formData, dualSideReorgProgress, setCards, setFormData, addToast]);

  const handleBindCompliantQsList = useCallback(() => {
    const freshBound = getBoundQsSubmissionList(cards);
    const ids = freshBound.readyCards.map((c) => c.id);
    setSelectedCardIds(new Set(ids));
    addToast({
      type: 'success',
      message: `已選取 ${ids.length} 筆資料完整聯絡人（企業夥伴 ${freshBound.employerCards.length} · 學研專家 ${freshBound.academicCards.length} · 機關社團 ${freshBound.staffCards.length}）`,
    });
  }, [cards, addToast]);

  const handleExportBoundQsList = useCallback(async () => {
    const freshBound = getBoundQsSubmissionList(cards);
    await handleExport('qs_ready_all', freshBound.readyCards);
  }, [cards, handleExport]);

  // --- Non-Blocking Deletion & Cleanup Handlers ---
  const handleDeleteCard = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();

    const cardToDelete = cards.find((c) => c.id === id) || (await getCardById(id));
    if (!cardToDelete) return;

    const displayName =
      `${cardToDelete.lastName || ''}${cardToDelete.firstName || ''}`.trim() ||
      cardToDelete.company ||
      '此筆名片';

    const ok = await confirm({
      title: '刪除名片紀錄',
      message: `確定要移除「${displayName}」的名片資料嗎？刪除後 5 秒內可點擊通知復原。`,
      confirmLabel: '確認刪除',
      variant: 'danger',
    });
    if (!ok) return;

    const originalCards = [...cards];
    const originalFormData = formData;
    const originalSelectedId = selectedCardId;
    const originalViewMode = viewMode;

    setCards((prev) => prev.filter((c) => c.id !== id));
    setSelectedCardIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

    if (selectedCardId === id) {
      setSelectedCardId(null);
      setFormData(null);
      if (viewMode === 'detail') setViewMode('file');
    }

    try {
      await deleteCardFromDB(id);
    } catch (err) {
      console.error('Error deleting from DB:', err);
    }

    addToast({
      type: 'info',
      message: `已移除「${displayName}」的資料`,
      duration: 5000,
      onUndo: async () => {
        try {
          await saveCardToDB(cardToDelete);
        } catch (err) {
          console.error('Error restoring card to DB:', err);
        }
        setCards(originalCards);
        setFormData(originalFormData);
        setSelectedCardId(originalSelectedId);
        setViewMode(originalViewMode);
      },
    });
  };

  const handleClearAll = async () => {
    if (cards.length === 0) return;

    const ok = await confirm({
      title: '清空目前名片資料',
      message: authUser
        ? `確定要刪除目前帳號下全部 ${cards.length} 筆名片紀錄（包含雲端與本機同步資料）嗎？建議刪除前先匯出 JSON 備份。`
        : `這將會清除本機體驗工作區中的全部 ${cards.length} 筆紀錄。確定要繼續嗎？`,
      confirmLabel: '確認清空',
      variant: 'danger',
    });
    if (!ok) return;

    const success = await clearAllCardsFromDB();
    if (success) {
      addToast({ type: 'success', message: '已清空目前名片資料' });
      setCards([]);
      setSelectedCardIds(new Set());
      setSelectedCardId(null);
      setFormData(null);
      setViewMode('file');
    }
  };

  const handleFindDuplicates = () => {
    if (duplicateAnalysis.groups.length === 0) {
      addToast({ type: 'info', message: '目前名片庫沒有偵測到重複項目' });
      return;
    }
    setShowDuplicateManager(true);
    setShowSettingsMenu(false);
  };

  const handleAutoDeduplicate = async (customKeepMap?: Map<string, string>) => {
    const analysis = analyzeDuplicates(cards);
    if (analysis.groups.length === 0) {
      addToast({ type: 'info', message: '名片庫沒有發現重複項目' });
      return;
    }

    const keepMap = customKeepMap || analysis.recommendedKeep;
    const totalToDelete = analysis.totalDuplicateCount;

    if (!customKeepMap) {
      const ok = await confirm({
        title: '一鍵智慧合併重複名片',
        message: `偵測到 ${analysis.groups.length} 組重複聯絡人（共 ${totalToDelete} 筆冗餘紀錄）。\n\n系統將保留每組最完整的主名片，自動合併電話、備註、自訂標籤與反面影像後移除多餘項目。確定要執行嗎？`,
        confirmLabel: '開始合併清理',
        variant: 'primary',
      });
      if (!ok) return;
    }

    setIsDeduplicating(true);
    try {
      let updatedCardsList = [...cards];
      const allDeletedIds = new Set<string>();
      const mergedToSave: BusinessCardData[] = [];

      for (const group of analysis.groups) {
        const keepCardId = keepMap.get(group.id) || group.primaryCardId;
        const primaryCard = group.cards.find((c) => c.id === keepCardId) || group.cards[0];
        const redundantCards = group.cards.filter((c) => c.id !== primaryCard.id);

        if (redundantCards.length === 0) continue;

        const mergedPrimary = mergeDuplicateCards(primaryCard, redundantCards);
        mergedToSave.push(mergedPrimary);
        updatedCardsList = updatedCardsList.map((c) =>
          c.id === mergedPrimary.id ? mergedPrimary : c
        );

        for (const red of redundantCards) {
          allDeletedIds.add(red.id);
        }
      }

      if (mergedToSave.length > 0) {
        await saveAllCardsToDB(mergedToSave);
      }
      if (allDeletedIds.size > 0) {
        await deleteCardsFromDB(Array.from(allDeletedIds));
      }

      const finalizedCards = updatedCardsList.filter((c) => !allDeletedIds.has(c.id));
      setCards(finalizedCards);

      if (selectedCardId && allDeletedIds.has(selectedCardId)) {
        setSelectedCardId(null);
        setFormData(null);
      } else if (formData) {
        const refreshed = finalizedCards.find((c) => c.id === formData.id);
        if (refreshed) setFormData(refreshed);
      }

      setShowDuplicateManager(false);
      addToast({
        type: 'success',
        message: `已完成合併並清理 ${allDeletedIds.size} 筆重複名片`,
      });
    } catch (err: any) {
      console.error('Error during auto-deduplication:', err);
      addToast({ type: 'error', message: `合併清理失敗：${err.message || '未知錯誤'}` });
    } finally {
      setIsDeduplicating(false);
    }
  };

  const handleDeleteDuplicateSingle = async (cardId: string) => {
    const ok = await confirm({
      title: '刪除此筆重複名片',
      message: '確定要單獨刪除這張重複名片嗎？此動作無法復原。',
      confirmLabel: '確認刪除',
      variant: 'danger',
    });
    if (!ok) return;

    await deleteCardFromDB(cardId);
    setCards((prev) => prev.filter((c) => c.id !== cardId));
    if (selectedCardId === cardId) {
      setSelectedCardId(null);
      setFormData(null);
    }
    addToast({ type: 'success', message: '已刪除該筆重複名片' });
  };

  const handleBatchDeleteDuplicateCards = async (cardIds: string[]) => {
    if (cardIds.length === 0) return;
    const ok = await confirm({
      title: '批次刪除重複名片',
      message: `確定要刪除勾選的 ${cardIds.length} 張重複名片嗎？此動作無法復原。`,
      confirmLabel: '批次刪除',
      variant: 'danger',
    });
    if (!ok) return;

    setIsDeduplicating(true);
    const idSet = new Set(cardIds);
    await deleteCardsFromDB(cardIds);

    setCards((prev) => prev.filter((c) => !idSet.has(c.id)));
    if (selectedCardId && idSet.has(selectedCardId)) {
      setSelectedCardId(null);
      setFormData(null);
    }
    setIsDeduplicating(false);
    addToast({ type: 'success', message: `已成功刪除 ${cardIds.length} 筆重複名片` });
  };

  const handleRemoveNoImageCards = async () => {
    const noImageCards = cards.filter((c) => !c.imageUrl || c.imageUrl.trim() === '');
    if (noImageCards.length === 0) {
      addToast({ type: 'info', message: '所有名片均包含影像，沒有無影像名片' });
      return;
    }

    const ok = await confirm({
      title: '移除無影像名片',
      message: `確定要刪除全部 ${noImageCards.length} 筆沒有正面影像的名片嗎？`,
      confirmLabel: '確認移除',
      variant: 'danger',
    });
    if (!ok) return;

    const idsToRemove = noImageCards.map((c) => c.id);
    setCards((prev) => prev.filter((c) => !idsToRemove.includes(c.id)));
    if (selectedCardId && idsToRemove.includes(selectedCardId)) {
      setSelectedCardId(null);
      setFormData(null);
      setViewMode('file');
    }
    setShowSettingsMenu(false);

    await deleteCardsFromDB(idsToRemove);
    addToast({ type: 'success', message: `已移除 ${noImageCards.length} 筆無影像名片` });
  };

  // --- Selection Helpers ---
  const handleToggleCardSelect = useCallback((id: string) => {
    setSelectedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectBatch = useCallback(
    (ids: string[]) => {
      setSelectedCardIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.add(id));
        return next;
      });
      addToast({ type: 'info', message: `已選取 ${ids.length} 筆聯絡人` });
    },
    [addToast]
  );

  const handleSelectCategory = useCallback(
    (cat: 'employer' | 'academic' | 'staff' | 'all') => {
      const matching = cards.filter((c) =>
        cat === 'all' ? c.category !== 'other' : c.category === cat
      );
      const ids = matching.map((c) => c.id);
      setSelectedCardIds(new Set(ids));
      const label =
        cat === 'all'
          ? '已分類夥伴'
          : cat === 'employer'
            ? '企業夥伴'
            : cat === 'academic'
              ? '學研專家'
              : '機關社團';
      addToast({ type: 'info', message: `已選取全部${label}名單 (${ids.length} 位)` });
    },
    [cards, addToast]
  );

  const handleDeselectAll = useCallback(() => {
    setSelectedCardIds(new Set());
  }, []);

  const handleStandardizeSelectedCountries = useCallback(async () => {
    const toSave: BusinessCardData[] = [];
    const updatedCards = cards.map((c) => {
      if (!selectedCardIds.has(c.id)) return c;
      const norm = normalizeCountry(c.country || c.translations?.country || '');
      if (norm && norm !== c.country) {
        const updated: BusinessCardData = {
          ...c,
          country: norm,
          translations: c.translations ? { ...c.translations, country: norm } : c.translations,
        };
        toSave.push(updated);
        return updated;
      }
      return c;
    });

    if (toSave.length > 0) {
      await saveAllCardsToDB(toSave);
      setCards(updatedCards);
      if (formData && selectedCardIds.has(formData.id)) {
        const currentUpdated = updatedCards.find((c) => c.id === formData.id);
        if (currentUpdated) setFormData(currentUpdated);
      }
      addToast({
        type: 'success',
        message: `已將 ${toSave.length} 筆已選名片的國家名稱標準化`,
      });
    } else {
      addToast({ type: 'info', message: '已選名片的國家名稱均已符合標準' });
    }
  }, [cards, selectedCardIds, formData, setCards, setFormData, addToast]);

  // --- Share Handler (Mobile) ---
  const handleShare = async (withSummary: boolean) => {
    if (!formData) return;
    const cardToShare = { ...formData, summary: withSummary ? formData.summary : '' };

    try {
      const vCardFile = createVCardFile([cardToShare]);
      if (navigator.canShare && navigator.canShare({ files: [vCardFile] })) {
        await navigator.share({
          files: [vCardFile],
          title: `${cardToShare.lastName || ''}${cardToShare.firstName || ''} 的名片`,
          text: '透過 BizMind 分享的聯絡人電子名片',
        });
        return;
      }
    } catch {
      // fallback to text share
    }

    let shareText = '';
    if (withSummary && formData.summary) {
      shareText += `${formData.summary}\n\n`;
    }
    shareText +=
      `姓名: ${formData.lastName || ''}${formData.firstName || ''}\n` +
      `公司: ${formData.company || ''}\n` +
      `職稱: ${formData.title || ''}\n` +
      (formData.phone ? `電話: ${formData.phone}\n` : '') +
      (formData.email ? `信箱: ${formData.email}\n` : '');

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${formData.lastName || ''}${formData.firstName || ''}`,
          text: shareText,
        });
      } catch {
        // user cancelled
      }
    } else {
      await navigator.clipboard.writeText(shareText);
      addToast({ type: 'info', message: '已複製聯絡資訊至剪貼簿' });
    }
  };

  // --- File Upload, PDF & Cropper Pipeline ---
  const autoDetectInCropper = async (b64: string) => {
    setIsAiDetecting(true);
    try {
      const boxes = await detectBusinessCards(b64);
      if (boxes && boxes.length > 0) {
        setCropRegions(
          boxes.map((box) => ({
            id: crypto.randomUUID(),
            x: (box.xmin / 1000) * 100,
            y: (box.ymin / 1000) * 100,
            w: ((box.xmax - box.xmin) / 1000) * 100,
            h: ((box.ymax - box.ymin) / 1000) * 100,
          }))
        );
      } else {
        addToast({
          type: 'info',
          message: '未自動偵測到名片邊框，請在畫面上拖曳滑鼠框選名片區塊。',
        });
      }
    } catch (e: any) {
      addToast({ type: 'error', message: e.message || '名片邊框偵測失敗' });
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
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      const context = canvas.getContext('2d');
      if (context) {
        await page.render({ canvasContext: context, viewport }).promise;
        const b64 = canvas.toDataURL('image/jpeg');
        setCropperImage(b64);
        setCropRegions([]);
        setCurrentPdfPage(pageNum);
        autoDetectInCropper(b64.split(',')[1]);
      }
    } catch {
      addToast({ type: 'error', message: '無法讀取 PDF 頁面' });
    } finally {
      setIsRenderingPdf(false);
    }
  };

  const processFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    if (files.length === 1 && files[0].name.toLowerCase().endsWith('.json')) {
      await handleJsonImport(files[0]);
      setShowMobileUploadHint(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (files.length === 1 && files[0].name.toLowerCase().endsWith('.csv')) {
      await handleCsvImport(files[0]);
      setShowMobileUploadHint(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (files.length === 1 && files[0].name.toLowerCase().endsWith('.xlsx')) {
      addToast({
        type: 'error',
        message: '系統不支援以 Excel 還原備份，請使用 .json 或 .csv 完整備份檔。',
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const firstFile = files[0];

    if (firstFile.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const typedarray = new Uint8Array(ev.target?.result as ArrayBuffer);
        try {
          const pdf = await pdfjs.getDocument(typedarray).promise;
          setPdfDoc(pdf);
          setCurrentPdfPage(1);
          await renderPdfPage(pdf, 1);
          setViewMode('cropper');
          setShowMobileUploadHint(false);
        } catch {
          addToast({ type: 'error', message: 'PDF 解析失敗' });
        }
      };
      reader.readAsArrayBuffer(firstFile);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (files.length === 1 && firstFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const b64 = event.target?.result as string;
        setPdfDoc(null);
        setCropperImage(b64);
        setCropRegions([]);
        setViewMode('cropper');
        autoDetectInCropper(b64.split(',')[1]);
      };
      reader.readAsDataURL(firstFile);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setShowMobileUploadHint(false);
      return;
    }

    processBatchFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setShowMobileUploadHint(false);
    setViewMode('detail');
  };

  const handleConfirmCrops = async () => {
    if (!cropperImage) return;
    if (cropRegions.length === 0) {
      addToast({
        type: 'warning',
        message: '請先在畫面上拖曳框選名片範圍，再點擊確認裁切。',
      });
      return;
    }
    const sourceImg = new Image();
    sourceImg.src = cropperImage;
    await new Promise((r) => (sourceImg.onload = r));
    const newTasks: ProcessingTask[] = [];
    for (let i = 0; i < cropRegions.length; i++) {
      const crop = cropRegions[i];
      const canvas = document.createElement('canvas');
      canvas.width = (crop.w / 100) * sourceImg.naturalWidth;
      canvas.height = (crop.h / 100) * sourceImg.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(
          sourceImg,
          (crop.x / 100) * sourceImg.naturalWidth,
          (crop.y / 100) * sourceImg.naturalHeight,
          canvas.width,
          canvas.height,
          0,
          0,
          canvas.width,
          canvas.height
        );
        const blob = await new Promise<Blob | null>((res) =>
          canvas.toBlob(res, 'image/jpeg', 0.95)
        );
        if (blob) {
          const id = crypto.randomUUID();
          filesMap.current.set(id, blob);
          newTasks.push({
            id,
            fileName: `CROP_${i + 1}.jpg`,
            status: 'pending',
            progress: 0,
            batchIndex: 1,
            previewUrl: URL.createObjectURL(blob),
          });
        }
      }
    }
    setTasks((prev) => [...prev, ...newTasks]);
    setPdfDoc(null);
    setCropperImage(null);
    setViewMode('detail');
  };

  const handleRotateCropImage = async (direction: 'left' | 'right') => {
    if (!cropperImage) return;
    const img = new Image();
    img.src = cropperImage;
    await new Promise((r) => (img.onload = r));

    const canvas = document.createElement('canvas');
    canvas.width = img.height;
    canvas.height = img.width;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(direction === 'right' ? (90 * Math.PI) / 180 : (-90 * Math.PI) / 180);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);

    const newB64 = canvas.toDataURL('image/jpeg', 0.95);
    setCropperImage(newB64);
    setCropRegions([]);
    autoDetectInCropper(newB64.split(',')[1]);
  };

  // --- Camera Capture Handler (Supports Front New Card & Back Side Merge) ---
  const handleCameraCapture = useCallback(
    async (b64: string) => {
      if (cameraTarget === 'back_side' && formData) {
        setViewMode('detail');
        setCameraTarget('new_card');
        addToast({ type: 'info', message: '正在儲存反面影像並解析補充欄位...' });
        try {
          const dataUri = `data:image/jpeg;base64,${b64}`;
          let backImageUrl = dataUri;
          let backImageId: string | undefined = undefined;
          try {
            const uploaded = await uploadImageAsset(dataUri, `${formData.id}_back`);
            backImageUrl = uploaded.downloadUrl;
            backImageId = uploaded.imageId;
          } catch {
            // keep local base64 fallback
          }
          const withBack: BusinessCardData = {
            ...formData,
            backImageUrl,
            backImageId,
            backRotation: 0,
          };
          await persistCardNow(withBack);

          try {
            await handleProcessBackSideExtraction(withBack, b64);
          } catch {
            addToast({ type: 'success', message: '已儲存名片反面影像' });
          }
        } catch (err: any) {
          addToast({ type: 'error', message: `反面儲存失敗：${err.message}` });
        }
        return;
      }

      const id = crypto.randomUUID();
      const res = await fetch(`data:image/jpeg;base64,${b64}`);
      const blob = await res.blob();
      filesMap.current.set(id, blob);
      const previewUrl = URL.createObjectURL(blob);
      setTasks((prev) => [
        ...prev,
        {
          id,
          fileName: `SCAN_${Date.now()}`,
          status: 'pending',
          progress: 0,
          batchIndex: 1,
          previewUrl,
        },
      ]);
      setViewMode('detail');
    },
    [cameraTarget, formData, persistCardNow, handleProcessBackSideExtraction, addToast, setTasks]
  );

  // --- Drag & Drop ---
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
      dragCounter.current = 0;
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

  const handleAddClick = () => {
    if (isMobile) {
      setShowMobileUploadHint(true);
    } else {
      fileInputRef.current?.click();
    }
  };

  // --- Interactive Tutorial & Replay Handlers ---
  const tourSteps: TourStep[] = useMemo(
    () => [
      {
        targetId: 'btn-upload',
        title: '新增、拖曳上傳或拍照掃描名片',
        content:
          '支援單張或批次上傳名片照片 (JPG, PNG)、匯入多頁 PDF 智慧框選裁切，亦可點擊左側「拍照」按鈕直接拍攝實體名片。',
        position: 'bottom-right',
        requiredView: 'search',
      },
      {
        targetId: cards.length > 0 ? 'qs-bound-banner' : 'nav-database',
        title: '聯絡人報表一鍵輸出與自動翻正',
        content:
          '系統會自動檢查聯絡人必填欄位完整度，點擊右側按鈕即可匯出分類報表 (.xlsx)，或一鍵將橫躺名片自動翻正。',
        position: 'bottom',
        requiredView: 'search',
      },
      {
        targetId: 'search-filter-bar',
        title: '多維度檢索、卡片牆檢視與批次編輯',
        content:
          '可依關鍵字、聯絡人角色分類、國家地區、活動來源與標籤交叉篩選，並自由切換「表格清單 / 名片卡片牆」；勾選多筆後可批次修改。',
        position: 'bottom',
        requiredView: 'search',
      },
      {
        targetId: 'nav-workspace',
        title: '審閱工作台與雙面名片補充解析',
        content:
          '在審閱工作台中，所有文字修改皆會自動儲存。左上角可切換「正面 / 反面」上傳名片背面並自動合併欄位，亦支援 QR 電子名片與問候信草稿。',
        position: 'bottom-left',
        requiredView: 'workspace',
      },
      {
        targetId: 'btn-settings',
        title: '個人雲端同步與資料品質維護',
        content:
          '提供 Google 帳號跨裝置雲端同步、重複聯絡人智慧合併、雙面名片批次重整，以及無紙化減碳效益與 AI 揭露資訊。',
        position: 'bottom-right',
        requiredView: 'search',
      },
      {
        targetId: 'btn-replay-tour',
        title: '隨時查閱教學手冊或重看導覽',
        content:
          '導覽結束後，您隨時可點擊「使用教學」查閱完整圖文指南，或點擊「重看教學」重新播放本互動步驟導覽！',
        position: 'bottom-right',
        requiredView: 'search',
      },
    ],
    [cards.length]
  );

  const navigateToTourStep = useCallback(
    async (nextIdx: number) => {
      const step = tourSteps[nextIdx];
      if (!step) return;
      if (step.requiredView === 'search' && viewMode !== 'search') {
        await flushPendingSave();
        setViewMode('search');
      } else if (step.requiredView === 'workspace' && viewMode === 'search') {
        setViewMode(formData ? 'detail' : 'file');
      }
      setTourStepIndex(nextIdx);
    },
    [tourSteps, viewMode, formData, flushPendingSave]
  );

  const handleStartInteractiveTour = useCallback(() => {
    setShowSettingsMenu(false);
    setShowExportMenu(false);
    navigateToTourStep(0);
  }, [navigateToTourStep]);

  const handleTourNext = useCallback(() => {
    if (tourStepIndex < tourSteps.length - 1) {
      navigateToTourStep(tourStepIndex + 1);
    } else {
      setTourStepIndex(-1);
      localStorage.setItem('bizmind_tour_visited_v1', 'true');
      addToast({
        type: 'success',
        message: '已完成互動導覽！隨時可點擊上方「重看教學」或「使用教學」再次查看。',
      });
    }
  }, [tourStepIndex, tourSteps.length, navigateToTourStep, addToast]);

  const handleTourPrev = useCallback(() => {
    if (tourStepIndex > 0) {
      navigateToTourStep(tourStepIndex - 1);
    }
  }, [tourStepIndex, navigateToTourStep]);

  const handleTourSkip = useCallback(() => {
    setTourStepIndex(-1);
    localStorage.setItem('bizmind_tour_visited_v1', 'true');
  }, []);

  const handleSearchSelectCard = useCallback(
    async (id: string) => {
      await selectCard(id);
      setOpenedFromSearch(true);
      setViewMode('detail');
    },
    [selectCard]
  );

  const currentDuplicateGroup = useMemo(() => {
    if (!formData?.id) return undefined;
    return duplicateAnalysis.groups.find((g) => g.cards.some((c) => c.id === formData.id));
  }, [duplicateAnalysis.groups, formData?.id]);

  // --- Auth Loading & Login Gate ---
  if (authUser === undefined) {
    return (
      <div className="min-h-screen w-full bg-slate-50 flex flex-col items-center justify-center gap-3 text-slate-600">
        <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
        <span className="text-sm font-semibold">正在載入 BizMind 工作區...</span>
      </div>
    );
  }

  if (!authUser && !isGuestMode) {
    return <LoginScreen onEnterGuestMode={handleEnterGuestMode} />;
  }

  return (
    <div
      className="flex flex-col h-screen w-full bg-slate-50 text-slate-900 font-sans overflow-hidden"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".jpg,.jpeg,.png,.heic,.pdf,.json,.csv"
        multiple
        onChange={(e) => processFiles(e.target.files)}
      />

      {/* Non-Blocking Top Progress Strip */}
      {(isCloudSyncing || bgTaskCount > 0) && (
        <div className="h-1 w-full bg-slate-200 overflow-hidden shrink-0 z-50">
          <div className="h-full w-1/2 bg-indigo-600 animate-pulse transition-all duration-300" />
        </div>
      )}

      {/* =========================================================
          GLOBAL 3-ZONE TOP BAR CONTRACT
          Zone 1: Brand | Zone 2: Navigation | Zone 3: Actions + 1 CTA
         ========================================================= */}
      <header className="min-h-[60px] bg-white border-b border-slate-200 px-4 lg:px-6 py-2 flex items-center justify-between gap-3 lg:gap-6 shrink-0 z-30">
        {/* Zone 1: Brand Identity */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
            <ScanLine className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="font-display font-bold text-lg tracking-tight text-slate-900 leading-none whitespace-nowrap">
              BizMind
            </span>
            <span className="text-[11px] font-medium text-slate-500 mt-0.5 hidden sm:inline whitespace-nowrap">
              {authUser ? '雲端同步工作區' : '本機體驗模式'}
            </span>
          </div>
        </div>

        {/* Zone 2: Primary Workspace Navigation & Tutorial Access */}
        <nav className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
          <button
            id="nav-database"
            type="button"
            onClick={async () => {
              await flushPendingSave();
              setViewMode('search');
            }}
            className={`px-3.5 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
              viewMode === 'search'
                ? 'bg-slate-900 text-white'
                : 'text-slate-700 hover:text-slate-950 hover:bg-slate-100'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>名片資料庫</span>
            <span className={viewMode === 'search' ? 'text-slate-300' : 'text-slate-500'}>
              ({cards.length})
            </span>
          </button>

          <button
            id="nav-workspace"
            type="button"
            onClick={() => setViewMode(formData ? 'detail' : 'file')}
            className={`px-3.5 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              viewMode !== 'search'
                ? 'bg-slate-900 text-white'
                : 'text-slate-700 hover:text-slate-950 hover:bg-slate-100'
            }`}
          >
            <LayoutPanelLeft className="w-4 h-4" />
            <span>審閱工作台</span>
            {tasks.some((t) => t.status === 'processing' || t.status === 'pending') && (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
            )}
          </button>

          <button
            type="button"
            onClick={handleFindDuplicates}
            className="hidden md:flex px-3 py-2 rounded-lg text-sm font-semibold items-center gap-1.5 text-slate-700 hover:text-slate-950 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums"
          >
            <Layers className="w-4 h-4" />
            <span>重複管理</span>
            {duplicateAnalysis.totalDuplicateCount > 0 && (
              <span className="text-amber-700 font-bold">
                ({duplicateAnalysis.totalDuplicateCount})
              </span>
            )}
          </button>

          <div className="hidden lg:block h-5 w-px bg-slate-200 mx-0.5 shrink-0" />

          <button
            id="btn-tutorial"
            type="button"
            onClick={() => setShowUserGuideModal(true)}
            className="px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 border border-indigo-200/80 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title="開啟完整圖文使用教學指南"
          >
            <BookOpen className="w-4 h-4" />
            <span>使用教學</span>
          </button>

          <button
            id="btn-replay-tour"
            type="button"
            onClick={handleStartInteractiveTour}
            className="hidden sm:flex px-3 py-2 rounded-lg text-sm font-semibold items-center gap-1.5 text-slate-700 hover:text-indigo-700 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title="重看互動式步驟導覽教學"
          >
            <RotateCcw className="w-4 h-4" />
            <span>重看教學</span>
          </button>

          <button
            type="button"
            onClick={() => setShowImpactModal(true)}
            className="hidden xl:flex px-2.5 py-2 rounded-lg text-sm font-medium items-center gap-1.5 text-emerald-800 hover:bg-emerald-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title="無紙化減碳統計與 AI 技術揭露"
          >
            <Leaf className="w-4 h-4 text-emerald-600" />
            <span>減碳與 AI 揭露</span>
          </button>

          <button
            type="button"
            onClick={() => setShowShortcutsModal(true)}
            className="hidden 2xl:flex px-2.5 py-2 rounded-lg text-sm font-medium items-center gap-1.5 text-slate-600 hover:text-slate-950 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title="檢視鍵盤快捷鍵 (?)"
          >
            <Keyboard className="w-4 h-4" />
            <span>快捷鍵</span>
          </button>
        </nav>

        {/* Zone 3: Secondary Controls + Single Primary CTA */}
        <div className="flex items-center gap-2 shrink-0">
          {isCloudSyncing && (
            <span className="hidden 2xl:inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-700 whitespace-nowrap tabular-nums mr-1">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>雲端同步中...</span>
            </span>
          )}

          {/* Font Size Comfort Switcher */}
          <button
            type="button"
            onClick={handleCycleFontScale}
            className="hidden md:flex h-10 px-2.5 rounded-lg text-sm font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors items-center gap-1 whitespace-nowrap cursor-pointer"
            title="切換全站文字大小（標準 / 舒適 / 大字級）"
          >
            <Type className="w-4 h-4 text-slate-600" />
            <span className="text-xs font-bold">
              {fontScale === 'large' ? '大字' : fontScale === 'comfortable' ? '舒適' : '標準'}
            </span>
          </button>

          {/* Export Dropdown */}
          <div className="relative" ref={exportMenuRef}>
            <button
              id="btn-export"
              type="button"
              onClick={() => setShowExportMenu((prev) => !prev)}
              className={`h-10 px-3 rounded-lg text-sm font-semibold border transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                showExportMenu
                  ? 'bg-slate-100 border-slate-400 text-slate-900'
                  : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">匯出報表</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </button>

            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-72 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-fadeIn">
                <div className="px-4 py-1 text-xs font-bold text-indigo-700 tracking-wide tabular-nums">
                  資料完整聯絡人名單 ({boundQsSummary.readyCards.length} 筆)
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowExportMenu(false);
                    handleExportBoundQsList();
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm font-bold text-indigo-800 bg-indigo-50/70 hover:bg-indigo-100/80 transition-colors cursor-pointer tabular-nums"
                >
                  一鍵輸出完整分類報表 ({boundQsSummary.readyCards.length} 筆 .xlsx)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowExportMenu(false);
                    handleBindCompliantQsList();
                    setIsQsModalOpen(true);
                  }}
                  className="w-full text-left px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  檢視完整度審閱與分類健檢
                </button>
                <div className="h-px bg-slate-100 my-1.5" />

                {selectedCardIds.size > 0 && (
                  <>
                    <div className="px-4 py-1 text-xs font-bold text-indigo-700 tracking-wide tabular-nums">
                      已選取聯絡人 ({selectedCardIds.size})
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowExportMenu(false);
                        setIsQsModalOpen(true);
                      }}
                      className="w-full text-left px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 transition-colors cursor-pointer"
                    >
                      審核選取名單並匯出 Excel
                    </button>
                    <div className="h-px bg-slate-100 my-1.5" />
                  </>
                )}

                <div className="px-4 py-1 text-xs font-bold text-slate-500 tracking-wide">
                  依聯絡人角色分類匯出 (.xlsx)
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowExportMenu(false);
                    handleExport('employer');
                  }}
                  className="w-full text-left px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 cursor-pointer tabular-nums"
                >
                  匯出企業夥伴 ({boundQsSummary.employerCards.length} 筆)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowExportMenu(false);
                    handleExport('academic');
                  }}
                  className="w-full text-left px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 cursor-pointer tabular-nums"
                >
                  匯出學研專家 ({boundQsSummary.academicCards.length} 筆)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowExportMenu(false);
                    handleExport('staff');
                  }}
                  className="w-full text-left px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 cursor-pointer tabular-nums"
                >
                  匯出機關社團 ({cards.filter((c) => c.category === 'staff').length} 筆)
                </button>

                <div className="h-px bg-slate-100 my-1.5" />
                <div className="px-4 py-1 text-xs font-bold text-slate-500 tracking-wide">
                  完整資料與備份
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowExportMenu(false);
                    handleExport('all_clean');
                  }}
                  className="w-full text-left px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 cursor-pointer"
                >
                  所有名片原文總表 (.xlsx)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowExportMenu(false);
                    handleExport('all_original');
                  }}
                  className="w-full text-left px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 cursor-pointer"
                >
                  所有名片含翻譯與備註 (.xlsx)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowExportMenu(false);
                    handleExport('vcard');
                  }}
                  className="w-full text-left px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 cursor-pointer"
                >
                  vCard 電子通訊錄 (.vcf)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowExportMenu(false);
                    handleExport('zip');
                  }}
                  className="w-full text-left px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 cursor-pointer"
                >
                  打包下載 ZIP (含名片影像)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowExportMenu(false);
                    handleExport('full_backup');
                  }}
                  className="w-full text-left px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 cursor-pointer"
                >
                  完整系統備份 (.json 含影像)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowExportMenu(false);
                    handleExport('csv');
                  }}
                  className="w-full text-left px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 cursor-pointer"
                >
                  完整系統備份 (.csv)
                </button>
              </div>
            )}
          </div>

          {/* Cloud, Account & System Menu */}
          <div className="relative" ref={settingsMenuRef}>
            <button
              id="btn-settings"
              type="button"
              onClick={() => setShowSettingsMenu((prev) => !prev)}
              className={`h-10 px-3 rounded-lg text-sm font-semibold border transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                showSettingsMenu
                  ? 'bg-slate-100 border-slate-400 text-slate-900'
                  : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
              }`}
              title="個人雲端同步、維護工具與系統設定"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden lg:inline">雲端與維護</span>
            </button>

            {showSettingsMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-76 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-fadeIn max-h-[82vh] overflow-y-auto custom-scrollbar">
                {/* Account & Cloud Status Header */}
                <div className="px-4 py-2 border-b border-slate-100">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    目前工作區身分
                  </div>
                  {authUser ? (
                    <div className="mt-1">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {authUser.displayName || authUser.email}
                      </div>
                      {authUser.email && (
                        <div className="text-[11px] text-slate-500 truncate">{authUser.email}</div>
                      )}
                      <div className="mt-2 flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={isCloudSyncing}
                          onClick={() => {
                            setShowSettingsMenu(false);
                            handleManualCloudSync();
                          }}
                          className="flex-1 py-1.5 px-2.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <CloudUpload className="w-3.5 h-3.5" />
                          <span>立即同步雲端</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleSignOut}
                          className="py-1.5 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                          title="登出目前 Google 帳號"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>登出</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1">
                      <div className="text-xs font-bold text-slate-800">
                        免登入本機體驗模式
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        資料儲存在目前瀏覽器，登入 Google 可開啟跨裝置加密雲端同步。
                      </p>
                      <div className="mt-2 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleSwitchToGoogleLogin}
                          className="flex-1 py-1.5 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <LogIn className="w-3.5 h-3.5" />
                          <span>連結 Google 雲端</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleSignOut}
                          className="py-1.5 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                        >
                          返回首頁
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="px-4 py-1.5 text-xs font-bold text-slate-500 tracking-wide">
                  教學、示範與永續揭露
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowSettingsMenu(false);
                    setShowUserGuideModal(true);
                  }}
                  className="w-full text-left px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <BookOpen className="w-4 h-4 shrink-0" />
                  <span>開啟完整使用教學指南</span>
                </button>
                <button
                  type="button"
                  onClick={handleStartInteractiveTour}
                  className="w-full text-left px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>重看教學（互動步驟導覽）</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSettingsMenu(false);
                    setShowImpactModal(true);
                  }}
                  className="w-full text-left px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50/70 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <Leaf className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>無紙化減碳統計與 AI 揭露</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSettingsMenu(false);
                    handleLoadDemoCards();
                  }}
                  className="w-full text-left px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <Database className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>載入 6 筆跨領域示範名片</span>
                </button>
                <button
                  type="button"
                  onClick={handleCycleFontScale}
                  className="w-full text-left px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    <Type className="w-4 h-4 text-slate-500 shrink-0" />
                    <span>切換全站字級大小</span>
                  </span>
                  <span className="text-xs font-bold text-indigo-700">
                    {fontScale === 'large' ? '大字級' : fontScale === 'comfortable' ? '舒適' : '標準'}
                  </span>
                </button>

                <div className="h-px bg-slate-100 my-1.5" />
                <div className="px-4 py-1 text-xs font-bold text-slate-500 tracking-wide">
                  資料品質維護
                </div>
                <button
                  type="button"
                  disabled={isAutoUprighting}
                  onClick={() => {
                    setShowSettingsMenu(false);
                    handleAutoUprightAllCards();
                  }}
                  className="w-full text-left px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <RotateCw className="w-4 h-4 shrink-0" />
                  <span>自動翻正全部名片影像</span>
                </button>
                <button
                  type="button"
                  disabled={Boolean(dualSideReorgProgress)}
                  onClick={() => {
                    setShowSettingsMenu(false);
                    handleBatchReorganizeDualSideCards();
                  }}
                  className="w-full text-left px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    <FlipHorizontal2 className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>批次重整雙面名片</span>
                  </span>
                  {cards.filter((c) => Boolean(c.backImageUrl)).length > 0 && (
                    <span className="text-xs font-bold text-indigo-700 tabular-nums">
                      {cards.filter((c) => Boolean(c.backImageUrl)).length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSettingsMenu(false);
                    handleAutoFixQsCategories();
                  }}
                  className="w-full text-left px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-slate-500 shrink-0" />
                    <span>執行聯絡人分類與國別健檢</span>
                  </span>
                  {boundQsSummary.auditIssues.length > 0 && (
                    <span className="text-xs font-bold text-amber-700 tabular-nums">
                      {boundQsSummary.auditIssues.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSettingsMenu(false);
                    handleStandardizeAllCountries();
                  }}
                  className="w-full text-left px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>統一國際標準國家名稱</span>
                </button>
                <button
                  type="button"
                  onClick={handleFindDuplicates}
                  className="w-full text-left px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    <Layers className="w-4 h-4 text-slate-500 shrink-0" />
                    <span>尋找並合併重複名片</span>
                  </span>
                  {duplicateAnalysis.totalDuplicateCount > 0 && (
                    <span className="text-xs font-bold text-amber-700 tabular-nums">
                      {duplicateAnalysis.totalDuplicateCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleRemoveNoImageCards}
                  className="w-full text-left px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <ImageOff className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>移除無影像名片</span>
                </button>

                <div className="h-px bg-slate-100 my-1.5" />
                <button
                  type="button"
                  onClick={() => {
                    setShowSettingsMenu(false);
                    handleClearAll();
                  }}
                  className="w-full text-left px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 shrink-0" />
                  <span>清空目前名片資料</span>
                </button>
              </div>
            )}
          </div>

          {/* Secondary Camera Trigger */}
          <button
            type="button"
            onClick={() => {
              setCameraTarget('new_card');
              setViewMode('camera');
            }}
            className="h-10 px-3 rounded-lg text-sm font-semibold bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            title="開啟相機拍攝名片"
          >
            <Camera className="w-4 h-4" />
            <span className="hidden sm:inline">拍照</span>
          </button>

          {/* Single Primary CTA */}
          <button
            id="btn-upload"
            type="button"
            onClick={handleAddClick}
            className="h-10 px-4 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>新增名片</span>
          </button>
        </div>
      </header>

      {/* =========================================================
          MAIN WORKSPACE BODY
         ========================================================= */}
      <div className="flex-1 flex min-h-0 relative overflow-hidden">
        {viewMode === 'search' ? (
          <SearchPage
            cards={cards}
            onSelectCard={handleSearchSelectCard}
            onDeleteCard={handleDeleteCard}
            onStandardizeCountries={handleStandardizeAllCountries}
            selectedCardIds={selectedCardIds}
            onToggleCard={handleToggleCardSelect}
            onSelectBatch={handleSelectBatch}
            onDeselectAll={handleDeselectAll}
            searchState={searchPageState}
            onSearchStateChange={setSearchPageState}
            onUpdateCardCategory={handleQuickCategoryChange}
            onOpenDuplicateModal={() => setShowDuplicateManager(true)}
            onAutoDeduplicate={() => handleAutoDeduplicate()}
            duplicateGroupCount={duplicateAnalysis.groups.length}
            redundantDuplicateCount={duplicateAnalysis.totalDuplicateCount}
            duplicateCardIds={duplicateIds}
            onOpenQrModal={(card) => setQrModalCard(card)}
            onOpenEmailDrawer={(card) => setEmailDrawerCard(card)}
            onExportBoundQsList={handleExportBoundQsList}
            onReviewBoundQsList={() => {
              handleBindCompliantQsList();
              setIsQsModalOpen(true);
            }}
            onAutoUprightAll={handleAutoUprightAllCards}
            onBatchReorganizeDualSide={handleBatchReorganizeDualSideCards}
            onLoadDemoCards={handleLoadDemoCards}
            dualSideReorgProgress={dualSideReorgProgress}
            isExporting={isExporting}
            isAutoUprighting={isAutoUprighting}
          />
        ) : (
          <>
            {/* Left Sidebar (Card List & Scan Queue) */}
            <aside
              className={`${
                isMobile ? (viewMode === 'file' ? 'flex' : 'hidden') : 'flex'
              } w-full md:w-[330px] lg:w-[370px] flex-col bg-white border-r border-slate-200 shrink-0 z-10`}
            >
              {/* Active Scan Queue Strip (Shown only when tasks exist) */}
              {tasks.length > 0 && (
                <div className="px-3.5 py-3 bg-slate-50 border-b border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700 tabular-nums">
                      辨識佇列 ({tasks.filter((t) => t.status === 'completed').length}/
                      {tasks.length})
                    </span>
                    {tasks.every((t) => t.status === 'completed' || t.status === 'error') && (
                      <button
                        type="button"
                        onClick={() => setTasks([])}
                        className="text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                      >
                        清除紀錄
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1">
                    {tasks.map((task) => (
                      <div
                        key={task.id}
                        onClick={() => task.status === 'error' && handleRetryTask(task.id)}
                        className={`relative w-11 h-11 rounded-lg bg-white border border-slate-200 shrink-0 overflow-hidden ${
                          task.status === 'error' ? 'cursor-pointer ring-1 ring-rose-500' : ''
                        }`}
                        title={
                          task.status === 'error'
                            ? `${task.fileName} 失敗：點擊重試`
                            : task.fileName
                        }
                      >
                        {task.previewUrl ? (
                          <img
                            src={task.previewUrl}
                            alt=""
                            className="w-full h-full object-contain bg-slate-100"
                          />
                        ) : (
                          <div className="w-full h-full bg-slate-100" />
                        )}
                        {task.status === 'processing' && (
                          <div className="absolute inset-0 bg-slate-900/45 flex items-center justify-center">
                            <Loader2 className="w-4 h-4 text-white animate-spin" />
                          </div>
                        )}
                        {task.status === 'completed' && (
                          <div className="absolute inset-0 bg-emerald-600/80 flex items-center justify-center">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        )}
                        {task.status === 'error' && (
                          <div className="absolute inset-0 bg-rose-600/85 flex items-center justify-center">
                            <RefreshCw className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sidebar Filters */}
              <div className="p-3.5 border-b border-slate-200 space-y-2.5">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="快速篩選工作台列表..."
                    className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-500 focus:border-indigo-600 focus:outline-none"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 text-sm cursor-pointer"
                    >
                      ×
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={activeCategory}
                    onChange={(e) => setActiveCategory(e.target.value as any)}
                    className="px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-800 outline-none cursor-pointer"
                  >
                    <option value="all">全部分類 ({cards.length})</option>
                    <option value="employer">企業夥伴</option>
                    <option value="academic">學研專家</option>
                    <option value="staff">機關社團</option>
                    <option value="other">一般聯絡人</option>
                  </select>

                  <select
                    value={activeCountry}
                    onChange={(e) => setActiveCountry(e.target.value)}
                    className="px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-800 outline-none cursor-pointer"
                  >
                    <option value="all">全部國家</option>
                    {sidebarCountries.map(([ctry, count]) => (
                      <option key={ctry} value={ctry}>
                        {getCountryBilingualLabel(ctry)} ({count})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between pt-0.5 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleSelectCategory('all')}
                      className="text-indigo-700 hover:underline font-semibold cursor-pointer"
                    >
                      勾選已分類夥伴
                    </button>
                    {selectedCardIds.size > 0 && (
                      <>
                        <span>·</span>
                        <button
                          type="button"
                          onClick={handleDeselectAll}
                          className="text-slate-600 hover:text-rose-600 font-medium cursor-pointer"
                        >
                          取消 ({selectedCardIds.size})
                        </button>
                      </>
                    )}
                  </div>
                  <span className="tabular-nums font-medium">共 {visibleCards.length} 筆</span>
                </div>
              </div>

              {/* Card List */}
              <div
                className="flex-1 overflow-y-auto custom-scrollbar p-2.5 space-y-2 bg-slate-50/50"
                onScroll={(e) => {
                  const target = e.currentTarget;
                  if (target.scrollTop + target.clientHeight >= target.scrollHeight - 200) {
                    if (sidebarDisplayLimit < visibleCards.length) {
                      setSidebarDisplayLimit((prev) => Math.min(visibleCards.length, prev + 50));
                    }
                  }
                }}
              >
                {visibleCards.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-44 text-slate-500 text-center px-4">
                    <p className="text-sm font-medium text-slate-600">
                      {searchQuery || activeCategory !== 'all' || activeCountry !== 'all'
                        ? '沒有符合篩選條件的名片'
                        : '目前尚無名片紀錄'}
                    </p>
                  </div>
                ) : (
                  <>
                    {visibleCards.slice(0, sidebarDisplayLimit).map((c) => (
                      <SidebarCardItem
                        key={c.id}
                        card={c}
                        isSelected={selectedCardId === c.id}
                        isQsChecked={selectedCardIds.has(c.id)}
                        isDuplicate={duplicateIds.has(c.id)}
                        onSelect={(id) => {
                          selectCard(id);
                          setViewMode('detail');
                        }}
                        onToggleQs={handleToggleCardSelect}
                        onDelete={handleDeleteCard}
                      />
                    ))}
                    {sidebarDisplayLimit < visibleCards.length && (
                      <button
                        type="button"
                        onClick={() =>
                          setSidebarDisplayLimit((prev) =>
                            Math.min(visibleCards.length, prev + 100)
                          )
                        }
                        className="w-full py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold border border-slate-300 transition-colors cursor-pointer tabular-nums"
                      >
                        載入更多名片 (剩餘 {visibleCards.length - sidebarDisplayLimit} 筆)
                      </button>
                    )}
                  </>
                )}
              </div>
            </aside>

            {/* Right Review Studio Area */}
            <main
              className={`flex-1 flex flex-col min-w-0 relative bg-slate-50 ${
                isMobile && viewMode === 'file' ? 'hidden' : 'flex'
              }`}
            >
              {/* Contextual Detail Action Bar */}
              {(viewMode === 'detail' || viewMode === 'file') && formData && (
                <div className="min-h-[52px] border-b border-slate-200 bg-white px-4 lg:px-6 py-2 flex items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {(isMobile || openedFromSearch) && (
                      <button
                        type="button"
                        onClick={async () => {
                          await flushPendingSave();
                          if (openedFromSearch) {
                            setViewMode('search');
                          } else {
                            setViewMode('file');
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-semibold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span>{openedFromSearch ? '返回資料庫' : '返回列表'}</span>
                      </button>
                    )}

                    <div className="flex items-center gap-2.5 min-w-0">
                      <h2 className="text-base font-bold font-display text-slate-900 truncate">
                        {formData.firstName || formData.lastName
                          ? `${formData.firstName} ${formData.lastName}`.trim()
                          : formData.company || '未知名片'}
                      </h2>

                      {/* Auto-Save Status Indicator */}
                      <span className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-slate-500 shrink-0">
                        {saveStatus === 'saving' ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                            <span className="text-indigo-700">自動儲存中...</span>
                          </>
                        ) : saveStatus === 'saved' ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700">
                              {authUser ? '已同步儲存' : '已自動儲存'}
                            </span>
                          </>
                        ) : saveStatus === 'error' ? (
                          <span className="text-rose-600">儲存失敗</span>
                        ) : null}
                      </span>
                    </div>
                  </div>

                  {/* Detail Action Controls */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleCardSelect(formData.id)}
                      className={`h-9 px-3 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 border cursor-pointer whitespace-nowrap ${
                        selectedCardIds.has(formData.id)
                          ? 'bg-indigo-50 text-indigo-800 border-indigo-300'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                      title="勾選至批次編輯或報表匯出名單"
                    >
                      {selectedCardIds.has(formData.id) ? (
                        <CheckSquare className="w-4 h-4 text-indigo-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-500" />
                      )}
                      <span className="hidden lg:inline">勾選</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setQrModalCard(formData)}
                      className="h-9 px-3 rounded-lg text-sm font-semibold bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      title="顯示 vCard 電子名片 QR Code (快捷鍵 Q)"
                    >
                      <QrCode className="w-4 h-4 text-indigo-600" />
                      <span className="hidden xl:inline">QR 名片</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEmailDrawerCard(formData)}
                      className="h-9 px-3 rounded-lg text-sm font-semibold bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      title="撰寫會後問候跟進信草稿 (快捷鍵 E)"
                    >
                      <Mail className="w-4 h-4 text-indigo-600" />
                      <span className="hidden xl:inline">問候信草稿</span>
                    </button>

                    {isMobile ? (
                      <div className="relative" ref={shareMenuRef}>
                        <button
                          type="button"
                          onClick={() => setShowShareMenu((p) => !p)}
                          className="h-9 w-9 rounded-lg border border-slate-300 bg-white text-slate-700 flex items-center justify-center cursor-pointer"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                        {showShareMenu && (
                          <div className="absolute right-0 top-full mt-1.5 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50">
                            <button
                              type="button"
                              onClick={() => {
                                handleShare(true);
                                setShowShareMenu(false);
                              }}
                              className="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 cursor-pointer"
                            >
                              分享名片 (含簡介)
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handleShare(false);
                                setShowShareMenu(false);
                              }}
                              className="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 cursor-pointer"
                            >
                              分享名片 (僅聯絡資訊)
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleExport('single')}
                          disabled={isExporting}
                          className="h-9 px-3 rounded-lg text-sm font-semibold bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                          title="匯出此張名片 Excel"
                        >
                          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                          <span className="hidden xl:inline">匯出單筆</span>
                        </button>

                        {authUser ? (
                          <span className="hidden xl:inline-flex h-9 px-3 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 items-center gap-1.5 whitespace-nowrap">
                            <Cloud className="w-3.5 h-3.5 text-emerald-600" />
                            <span>雲端自動同步</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={handleSwitchToGoogleLogin}
                            className="hidden xl:inline-flex h-9 px-3 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                            title="登入 Google 帳號以啟用跨裝置雲端備份"
                          >
                            <CloudUpload className="w-3.5 h-3.5" />
                            <span>連結雲端</span>
                          </button>
                        )}
                      </>
                    )}

                    <button
                      type="button"
                      onClick={(e) => handleDeleteCard(e, formData.id)}
                      className="h-9 w-9 flex items-center justify-center text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="刪除此筆名片"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Active Canvas / Form Body */}
              <div className="flex-1 relative overflow-hidden" id="detail-panel">
                {viewMode === 'camera' && (
                  <div className="absolute inset-0 z-50 bg-slate-950">
                    <CameraScanner
                      onCapture={handleCameraCapture}
                      onClose={() => {
                        setCameraTarget('new_card');
                        setViewMode(formData ? 'detail' : 'file');
                      }}
                      isMobile={isMobile}
                      modeLabel={
                        cameraTarget === 'back_side'
                          ? '請將名片反面置於框內拍攝'
                          : '請將名片正面置於框內拍攝'
                      }
                    />
                  </div>
                )}

                {viewMode === 'cropper' && cropperImage && (
                  <CropperWorkspace
                    cropperImage={cropperImage}
                    cropRegions={cropRegions}
                    setCropRegions={setCropRegions}
                    isAiDetecting={isAiDetecting}
                    isRenderingPdf={isRenderingPdf}
                    pdfPageCount={pdfDoc?.numPages || 0}
                    currentPdfPage={currentPdfPage}
                    onChangePdfPage={(nextPage) => {
                      if (pdfDoc) renderPdfPage(pdfDoc, nextPage);
                    }}
                    onRotateImage={handleRotateCropImage}
                    onCancel={() => {
                      setViewMode(formData ? 'detail' : 'file');
                      setCropperImage(null);
                      setPdfDoc(null);
                    }}
                    onConfirmCrops={handleConfirmCrops}
                  />
                )}

                {formData ? (
                  <CardDetailPanel
                    card={formData}
                    duplicateGroup={currentDuplicateGroup}
                    existingSources={existingSources}
                    existingTags={existingTags}
                    onChangeCard={scheduleAutoSave}
                    onPersistImmediate={persistCardNow}
                    onSelectCard={(id) => {
                      selectCard(id);
                      setViewMode('detail');
                    }}
                    onOpenDuplicateModal={() => setShowDuplicateManager(true)}
                    onRequestBackCamera={() => {
                      setCameraTarget('back_side');
                      setViewMode('camera');
                    }}
                    onProcessBackSideExtraction={handleProcessBackSideExtraction}
                  />
                ) : (
                  /* Professional SaaS Empty Workspace */
                  <div className="h-full flex flex-col items-center justify-center p-6 sm:p-8 text-center bg-slate-50">
                    <div className="max-w-lg w-full bg-white border border-slate-200 rounded-2xl p-7 sm:p-8 shadow-2xs">
                      <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-4">
                        <Upload className="w-5 h-5" />
                      </div>
                      <h2 className="text-xl font-bold font-display text-slate-900 mb-2">
                        名片審閱與數位化工作台
                      </h2>
                      <p className="text-sm text-slate-600 leading-relaxed mb-6">
                        請從左側列表選擇聯絡人進行審閱編輯，或直接將名片圖片 (JPG, PNG)、多頁掃描 PDF 拖曳至此處自動擷取欄位。
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={handleAddClick}
                          className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>選擇檔案或 PDF</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCameraTarget('new_card');
                            setViewMode('camera');
                          }}
                          className="py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                        >
                          <Camera className="w-4 h-4" />
                          <span>開啟相機拍攝</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-3">
                        <button
                          type="button"
                          onClick={() => setShowUserGuideModal(true)}
                          className="py-2 px-3 bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-800 border border-slate-200 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <BookOpen className="w-4 h-4 text-indigo-600" />
                          <span>閱讀使用教學</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleStartInteractiveTour}
                          className="py-2 px-3 bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-800 border border-slate-200 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-4 h-4 text-indigo-600" />
                          <span>重看互動教學</span>
                        </button>
                      </div>

                      {cards.length === 0 && (
                        <button
                          type="button"
                          onClick={handleLoadDemoCards}
                          className="mt-3 w-full py-2.5 px-4 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                        >
                          <Sparkles className="w-4 h-4" />
                          <span>載入 6 筆示範名片快速體驗</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </main>
          </>
        )}
      </div>

      {/* =========================================================
          OVERLAYS, MODALS & DRAWERS
         ========================================================= */}

      {/* Drag & Drop Overlay */}
      {isDragOver && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-md w-full text-center shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center mx-auto mb-4">
              <Upload className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold font-display text-slate-900 mb-2">
              放開滑鼠以匯入檔案
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              支援單張或批次名片圖檔 (JPG, PNG)、多頁 PDF 智慧裁切，以及 JSON / CSV 系統備份檔。
            </p>
          </div>
        </div>
      )}

      {/* Mobile Upload Hint Modal */}
      {showMobileUploadHint && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-sm rounded-2xl border border-slate-200 shadow-xl p-6 text-center">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Upload className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold font-display text-slate-900 mb-1.5">
              上傳名片或備份檔
            </h3>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              支援 JPG、PNG、PDF 圖片辨識，或選擇 JSON / CSV 備份檔進行還原。
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                選擇檔案
              </button>
              <button
                type="button"
                onClick={() => setShowMobileUploadHint(false)}
                className="w-full py-2 text-slate-500 hover:text-slate-700 text-xs font-semibold cursor-pointer"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scan Pipeline Duplicate File Prompt */}
      {duplicateFilePrompt && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200 shadow-xl p-6">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 bg-amber-50 text-amber-600 border border-amber-200 rounded-lg flex items-center justify-center shrink-0">
                <FileWarning className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold font-display text-slate-900">
                  偵測到重複上傳的檔案
                </h3>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  檔案 <strong>{duplicateFilePrompt.fileName}</strong> 與現有紀錄相同，是否仍要重新辨識處理？
                </p>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => duplicateFilePrompt.resolve('skip')}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition-colors cursor-pointer"
              >
                略過此檔案
              </button>
              <button
                type="button"
                onClick={() => duplicateFilePrompt.resolve('process')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer"
              >
                繼續辨識
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scan Pipeline Duplicate Contact Prompt */}
      {duplicatePrompt && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200 shadow-xl p-6">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 bg-amber-50 text-amber-600 border border-amber-200 rounded-lg flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold font-display text-slate-900">
                  發現相似或重複聯絡人
                </h3>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  新掃描的聯絡人{' '}
                  <strong>
                    {(duplicatePrompt.newCard as any).name ||
                      `${duplicatePrompt.newCard.lastName || ''}${
                        duplicatePrompt.newCard.firstName || ''
                      }`}
                  </strong>{' '}
                  ({duplicatePrompt.newCard.company}) 已存在於名片庫中。
                </p>
                {duplicatePrompt.reason && (
                  <p className="mt-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
                    比對原因：{duplicatePrompt.reason}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => duplicatePrompt.resolve('replace')}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer"
              >
                覆蓋舊紀錄（保留最新掃描）
              </button>
              <button
                type="button"
                onClick={() => duplicatePrompt.resolve('keep')}
                className="w-full py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold rounded-lg text-xs transition-colors cursor-pointer"
              >
                兩筆皆保留（另建新紀錄）
              </button>
              <button
                type="button"
                onClick={() => duplicatePrompt.resolve('discard')}
                className="w-full py-2 text-slate-500 hover:text-rose-600 font-semibold rounded-lg text-xs transition-colors cursor-pointer"
              >
                捨棄本次掃描
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unified Floating Multi-Select Batch Edit Bar */}
      {viewMode !== 'cropper' && viewMode !== 'camera' && (
        <BatchEditBar
          selectedCount={selectedCardIds.size}
          existingTags={existingTags}
          existingSources={existingSources}
          onBatchUpdateCategory={handleBatchUpdateCategory}
          onBatchUpdateCountry={handleBatchUpdateCountry}
          onBatchUpdateSource={handleBatchUpdateSource}
          onBatchAddTag={handleBatchAddTag}
          onOpenQsModal={() => setIsQsModalOpen(true)}
          onClearSelection={handleDeselectAll}
        />
      )}

      {/* Onboarding Tour */}
      {tourStepIndex >= 0 && (
        <TourOverlay
          stepIndex={tourStepIndex}
          steps={tourSteps}
          onNext={handleTourNext}
          onPrev={handleTourPrev}
          onSkip={handleTourSkip}
          onOpenFullGuide={() => setShowUserGuideModal(true)}
        />
      )}

      {/* User Guide & Tutorial Manual Modal */}
      <UserGuideModal
        isOpen={showUserGuideModal}
        onClose={() => setShowUserGuideModal(false)}
        onStartInteractiveTour={handleStartInteractiveTour}
      />

      {/* Sustainability Impact & AI Disclosure Modal */}
      <ThreeGoodImpactModal
        isOpen={showImpactModal}
        onClose={() => setShowImpactModal(false)}
        cards={cards}
        onLoadDemoCards={handleLoadDemoCards}
      />

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

      {/* Contact Completeness Review & Export Modal */}
      <QsConfirmationModal
        isOpen={isQsModalOpen}
        onClose={() => setIsQsModalOpen(false)}
        selectedCardIds={selectedCardIds}
        allCards={cards}
        onToggleCard={handleToggleCardSelect}
        onSelectAll={() => handleSelectCategory('all')}
        onBindCompliantList={handleBindCompliantQsList}
        onAutoFixCategories={handleAutoFixQsCategories}
        onDeselectAll={handleDeselectAll}
        onUpdateCardCategory={handleQuickCategoryChange}
        onStandardizeSelectedCountries={handleStandardizeSelectedCountries}
        onExport={async (mode, selectedCards) => {
          await handleExport(mode, selectedCards);
        }}
        isExporting={isExporting}
        onOpenCardDetail={(id) => {
          selectCard(id);
          setViewMode('detail');
          setIsQsModalOpen(false);
        }}
      />

      {/* QR Code Digital vCard Modal */}
      <QrCodeModal card={qrModalCard} onClose={() => setQrModalCard(null)} />

      {/* Outreach Email Draft Slide-Over Drawer */}
      <FollowUpEmailDrawer card={emailDrawerCard} onClose={() => setEmailDrawerCard(null)} />

      {/* Keyboard Shortcuts Reference Modal */}
      <KeyboardShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
        onOpenUserGuide={() => setShowUserGuideModal(true)}
      />

      {/* Dual-Side Discrepancy / Conflict Decision Modal */}
      <DualSideConflictModal
        conflictQueue={dualSideConflictQueue}
        onResolveCurrent={handleResolveDualSideConflict}
        onSkipCurrent={() =>
          setDualSideConflictQueue((prev) => (prev.length > 1 ? prev.slice(1) : []))
        }
        onCloseAll={() => setDualSideConflictQueue([])}
        isSubmitting={isResolvingDualConflict}
      />

      {/* Semantic Card Search Assistant */}
      <ChatBox
        cards={cards}
        onJumpToCard={(cardId) => {
          selectCard(cardId);
          setViewMode('detail');
        }}
        externalSearchQuery={externalChatQuery}
        onExternalSearchConsumed={() => setExternalChatQuery(null)}
      />
    </div>
  );
};

export default App;
