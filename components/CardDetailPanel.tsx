import React, { useState, useRef, useEffect } from 'react';
import {
  Briefcase,
  GraduationCap,
  UserCheck,
  Ban,
  Building2,
  Mail,
  Globe,
  Phone,
  Printer,
  MapPin,
  FileText,
  BookOpen,
  User,
  Award,
  Tag,
  Plus,
  X,
  AlertTriangle,
  Layers,
  Upload,
  Camera,
  Sparkles,
  Loader2,
  Image as ImageIcon,
  Trash2,
} from 'lucide-react';
import { BusinessCardData } from '../types';
import PanZoomImage from './PanZoomImage';
import EditableField from './EditableField';
import { CardThumbnail } from './CardThumbnail';
import { DuplicateGroup } from '../utils/duplicateUtils';
import { normalizeCountry, STANDARD_COUNTRY_OPTIONS } from '../utils/countries';
import { compressImage } from '../utils/imageUtils';
import { uploadImageAsset } from '../utils/firebase';
import { extractBackCardInfo } from '../services/geminiService';
import { applyDualSideMerge } from '../utils/dualSideCardUtils';
import { useToast } from './ToastProvider';

interface CardDetailPanelProps {
  card: BusinessCardData;
  duplicateGroup?: DuplicateGroup;
  existingSources: string[];
  existingTags: string[];
  onChangeCard: (updated: BusinessCardData) => void;
  onPersistImmediate: (updated: BusinessCardData) => Promise<BusinessCardData>;
  onSelectCard: (id: string) => void;
  onOpenDuplicateModal: () => void;
  onRequestBackCamera: () => void;
  onProcessBackSideExtraction?: (
    targetCard: BusinessCardData,
    rawBase64: string
  ) => Promise<void>;
}

export const CardDetailPanel: React.FC<CardDetailPanelProps> = ({
  card,
  duplicateGroup,
  existingSources,
  existingTags,
  onChangeCard,
  onPersistImmediate,
  onSelectCard,
  onOpenDuplicateModal,
  onRequestBackCamera,
  onProcessBackSideExtraction,
}) => {
  const { addToast } = useToast();
  const [activeSide, setActiveSide] = useState<'front' | 'back' | 'split'>(() =>
    card.backImageUrl ? 'split' : 'front'
  );
  const [isExtractingBack, setIsExtractingBack] = useState(false);
  const [isUploadingBack, setIsUploadingBack] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const backFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setActiveSide(card.backImageUrl ? 'split' : 'front');
  }, [card.id]);

  const updateField = <K extends keyof BusinessCardData>(field: K, value: BusinessCardData[K]) => {
    onChangeCard({
      ...card,
      [field]: value,
    });
  };

  const runBackComparisonAndMerge = async (targetCard: BusinessCardData, rawBase64: string) => {
    if (onProcessBackSideExtraction) {
      await onProcessBackSideExtraction(targetCard, rawBase64);
      return;
    }
    const extracted = await extractBackCardInfo(rawBase64, targetCard, 'image/jpeg');
    const cardWithRot: BusinessCardData =
      extracted.recommendedBackRotation !== undefined
        ? { ...targetCard, backRotation: extracted.recommendedBackRotation }
        : targetCard;
    const { updatedCard, highlights } = applyDualSideMerge(cardWithRot, extracted, 'auto');
    await onPersistImmediate(updatedCard);
    addToast({
      type: 'success',
      message:
        highlights.length > 0
          ? `雙面合併完成：${highlights.join(' · ')}`
          : '已完成雙面資訊比對與欄位合併',
    });
  };

  const handleBackFileUpload = async (file: File | null) => {
    if (!file) return;
    setIsUploadingBack(true);
    try {
      const rawBase64 = await compressImage(file, 1400, 0.85);
      const dataUri = `data:image/jpeg;base64,${rawBase64}`;
      let backImageUrl = dataUri;
      let backImageId: string | undefined = undefined;

      try {
        const uploaded = await uploadImageAsset(dataUri, `${card.id}_back`);
        backImageUrl = uploaded.downloadUrl;
        backImageId = uploaded.imageId;
      } catch (uploadErr) {
        console.warn('Back image cloud upload fallback to local base64:', uploadErr);
      }

      const withBackImage: BusinessCardData = {
        ...card,
        backImageUrl,
        backImageId,
        backRotation: 0,
      };
      setActiveSide('split');
      await onPersistImmediate(withBackImage);

      setIsExtractingBack(true);
      try {
        await runBackComparisonAndMerge(withBackImage, rawBase64);
      } catch (ocrErr: any) {
        console.warn('Back-side OCR warning:', ocrErr);
        addToast({
          type: 'info',
          message: '已儲存反面影像（您可隨時點擊「智慧雙面比對合併」重試）',
        });
      } finally {
        setIsExtractingBack(false);
      }
    } catch (e: any) {
      addToast({ type: 'error', message: `上傳反面影像失敗：${e.message || '未知錯誤'}` });
    } finally {
      setIsUploadingBack(false);
      if (backFileInputRef.current) backFileInputRef.current.value = '';
    }
  };

  const handleReExtractBack = async () => {
    if (!card.backImageUrl) return;
    setIsExtractingBack(true);
    try {
      let rawBase64 = '';
      if (card.backImageUrl.startsWith('data:image')) {
        rawBase64 = card.backImageUrl.split(',')[1];
      } else {
        try {
          const resp = await fetch(card.backImageUrl);
          if (resp.ok) {
            const blob = await resp.blob();
            rawBase64 = await compressImage(blob, 1400, 0.85);
          }
        } catch {
          // Remote image URL will be fetched server-side without browser CORS restriction
          rawBase64 = '';
        }
      }
      await runBackComparisonAndMerge(card, rawBase64);
    } catch (e: any) {
      addToast({ type: 'error', message: `雙面比對失敗：${e.message || '請稍後再試'}` });
    } finally {
      setIsExtractingBack(false);
    }
  };

  const handleRemoveBackImage = async () => {
    const updated: BusinessCardData = {
      ...card,
      backImageUrl: undefined,
      backImageId: undefined,
      backRotation: 0,
    };
    setActiveSide('front');
    await onPersistImmediate(updated);
    addToast({ type: 'info', message: '已移除反面名片影像' });
  };

  const handleAddTag = (rawTag: string) => {
    const trimmed = rawTag.trim();
    if (!trimmed) return;
    const currentTags = card.tags || [];
    if (currentTags.includes(trimmed)) {
      setNewTagInput('');
      return;
    }
    updateField('tags', [...currentTags, trimmed]);
    setNewTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const currentTags = card.tags || [];
    updateField(
      'tags',
      currentTags.filter((t) => t !== tagToRemove)
    );
  };

  const otherDuplicates = duplicateGroup?.cards.filter((c) => c.id !== card.id) || [];

  const activeImageSrc = activeSide === 'front' ? card.imageUrl : card.backImageUrl;
  const activeRotation = activeSide === 'front' ? card.rotation || 0 : card.backRotation || 0;

  const sideSwitcherOverlay = (
    <div className="flex items-center gap-1 bg-slate-900/85 backdrop-blur-md p-1 rounded-lg border border-white/15">
      <button
        type="button"
        onClick={() => setActiveSide('front')}
        className={`px-2.5 py-1.5 rounded-md text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
          activeSide === 'front'
            ? 'bg-indigo-600 text-white'
            : 'text-slate-200 hover:text-white hover:bg-white/10'
        }`}
      >
        正面
      </button>
      <button
        type="button"
        onClick={() => setActiveSide('back')}
        className={`px-2.5 py-1.5 rounded-md text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
          activeSide === 'back'
            ? 'bg-indigo-600 text-white'
            : 'text-slate-200 hover:text-white hover:bg-white/10'
        }`}
      >
        {card.backImageUrl ? '反面 (已上傳)' : '反面'}
      </button>
      <button
        type="button"
        onClick={() => setActiveSide('split')}
        className={`px-2.5 py-1.5 rounded-md text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
          activeSide === 'split'
            ? 'bg-indigo-600 text-white'
            : 'text-slate-200 hover:text-white hover:bg-white/10'
        }`}
        title="同時併排檢視正面與反面名片影像"
      >
        併排檢視
      </button>
    </div>
  );

  const backSideBottomActions = card.backImageUrl ? (
    <div className="flex items-center gap-2 bg-slate-900/85 backdrop-blur-md p-1.5 rounded-lg border border-white/15">
      <button
        type="button"
        disabled={isExtractingBack || isUploadingBack}
        onClick={handleReExtractBack}
        className="px-3 py-1.5 rounded-md text-xs sm:text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
        title="重新比對正反面：英文升主欄、中文存對照、斜線合併職稱、偵測機構差異"
      >
        {isExtractingBack ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Sparkles className="w-3.5 h-3.5" />
        )}
        <span>{isExtractingBack ? '雙面比對合併中...' : '智慧雙面比對合併'}</span>
      </button>

      <button
        type="button"
        onClick={() => backFileInputRef.current?.click()}
        className="px-2.5 py-1.5 rounded-md text-xs sm:text-sm font-medium text-slate-200 hover:bg-white/10 transition-colors cursor-pointer whitespace-nowrap"
        title="更換反面影像"
      >
        更換
      </button>

      <button
        type="button"
        onClick={handleRemoveBackImage}
        className="p-1.5 rounded-md text-slate-300 hover:text-rose-400 hover:bg-white/10 transition-colors cursor-pointer"
        title="移除反面影像"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  ) : null;

  const renderEmptyBackUploadBox = (compact = false) => (
    <div className="max-w-xs flex flex-col items-center text-center p-4">
      <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-2.5 text-slate-300">
        {isUploadingBack || isExtractingBack ? (
          <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
        ) : (
          <ImageIcon className="w-5 h-5" />
        )}
      </div>
      <h4 className="text-sm sm:text-base font-bold text-white mb-1">尚未新增名片反面影像</h4>
      {!compact && (
        <p className="text-xs sm:text-sm text-slate-300 mb-4 leading-relaxed">
          上傳或拍攝名片背面，系統將自動把英文升為主欄、中文存入對照欄，並斜線整合雙職稱或提示機構差異。
        </p>
      )}
      <div className="flex items-center gap-2 mt-2">
        <button
          type="button"
          disabled={isUploadingBack || isExtractingBack}
          onClick={() => backFileInputRef.current?.click()}
          className="px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>上傳反面</span>
        </button>
        <button
          type="button"
          disabled={isUploadingBack || isExtractingBack}
          onClick={onRequestBackCamera}
          className="px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
        >
          <Camera className="w-3.5 h-3.5" />
          <span>拍攝反面</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col md:flex-row bg-slate-50 overflow-hidden">
      <input
        ref={backFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleBackFileUpload(e.target.files?.[0] || null)}
      />

      {/* Left Pane: Dual-Side Image Viewer (Front / Back / Split Side-by-Side) */}
      <div className="md:w-[38%] lg:w-[36%] h-[42vh] md:h-full bg-slate-900 relative flex flex-col overflow-hidden shrink-0 border-b md:border-b-0 md:border-r border-slate-200">
        {activeSide === 'split' ? (
          <div className="w-full h-full flex flex-col overflow-hidden">
            {/* Top Toolbar in Split Mode */}
            <div className="px-3 py-2 bg-slate-950/80 border-b border-white/10 flex items-center justify-between gap-2 shrink-0 z-20">
              {sideSwitcherOverlay}
            </div>

            {/* Split Panes: Side-by-side on mobile landscape / Stacked top-bottom on desktop narrow column */}
            <div className="flex-1 grid grid-cols-2 md:grid-cols-1 md:grid-rows-2 divide-x md:divide-x-0 md:divide-y divide-white/15 overflow-hidden">
              {/* Front Slot */}
              <div className="relative w-full h-full overflow-hidden">
                {card.imageUrl ? (
                  <PanZoomImage
                    src={card.imageUrl}
                    rotation={card.rotation || 0}
                    topLeftOverlay={
                      <span className="px-2 py-0.5 rounded bg-slate-950/75 text-[11px] font-semibold text-slate-200 border border-white/10">
                        正面 (Front)
                      </span>
                    }
                    onRotate={(deg) => onPersistImmediate({ ...card, rotation: deg })}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center text-slate-400">
                    <ImageIcon className="w-7 h-7 mb-1.5 opacity-60" />
                    <span className="text-xs font-semibold text-slate-300">無正面影像</span>
                  </div>
                )}
              </div>

              {/* Back Slot */}
              <div className="relative w-full h-full overflow-hidden">
                {card.backImageUrl ? (
                  <PanZoomImage
                    src={card.backImageUrl}
                    rotation={card.backRotation || 0}
                    topLeftOverlay={
                      <span className="px-2 py-0.5 rounded bg-slate-950/75 text-[11px] font-semibold text-indigo-200 border border-indigo-400/30">
                        反面 (Back)
                      </span>
                    }
                    bottomOverlay={backSideBottomActions}
                    onRotate={(deg) => onPersistImmediate({ ...card, backRotation: deg })}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900">
                    {renderEmptyBackUploadBox(true)}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : activeImageSrc ? (
          <PanZoomImage
            src={activeImageSrc}
            rotation={activeRotation}
            topLeftOverlay={sideSwitcherOverlay}
            bottomOverlay={activeSide === 'back' ? backSideBottomActions : null}
            onRotate={(deg) => {
              const updated: BusinessCardData =
                activeSide === 'front'
                  ? { ...card, rotation: deg }
                  : { ...card, backRotation: deg };
              onPersistImmediate(updated);
            }}
          />
        ) : (
          <div className="w-full h-full relative flex flex-col items-center justify-center p-6 text-center text-slate-300">
            <div className="absolute top-3 left-3 z-20">{sideSwitcherOverlay}</div>

            {activeSide === 'back' ? (
              renderEmptyBackUploadBox(false)
            ) : (
              <div className="flex flex-col items-center">
                <ImageIcon className="w-9 h-9 mb-2.5 opacity-60" />
                <span className="text-sm font-semibold text-slate-200">此筆紀錄無正面影像</span>
                <span className="text-xs text-slate-400 mt-1">（可能來自批次匯入紀錄）</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Pane: Structured Contact Form */}
      <div className="flex-1 h-full overflow-y-auto custom-scrollbar bg-slate-50/70 p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto space-y-6 pb-8">
          {/* Duplicate Warning Banner */}
          {otherDuplicates.length > 0 && duplicateGroup && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 sm:p-5">
              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h4 className="text-sm font-bold text-amber-950">
                      偵測到 {otherDuplicates.length} 筆重複或高度相似的聯絡人紀錄
                    </h4>
                    <button
                      type="button"
                      onClick={onOpenDuplicateModal}
                      className="text-sm font-semibold text-amber-950 bg-white hover:bg-amber-100 border border-amber-300 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <Layers className="w-4 h-4" />
                      <span>開啟重複合併管理</span>
                    </button>
                  </div>
                  <p className="text-sm text-amber-900 mt-1 mb-3 leading-relaxed">
                    比對依據：{duplicateGroup.reason}
                  </p>
                  <div className="space-y-2">
                    {otherDuplicates.map((dup) => (
                      <div
                        key={dup.id}
                        className="flex items-center justify-between bg-white px-3.5 py-2.5 rounded-lg border border-amber-200"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <CardThumbnail card={dup} size="sm" />
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-slate-900 truncate">
                              {`${dup.lastName || ''}${dup.firstName || ''}` || dup.company}
                              {dup.title ? ` · ${dup.title}` : ''}
                            </div>
                            <div className="text-xs text-slate-600 truncate">
                              {[dup.company, dup.email || dup.phone].filter(Boolean).join(' · ')}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onSelectCard(dup.id)}
                          className="text-sm font-semibold text-indigo-700 hover:text-indigo-800 px-3 py-1.5 rounded-md hover:bg-indigo-50 transition-colors shrink-0 cursor-pointer whitespace-nowrap"
                        >
                          切換檢視
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Section 1: Contact Classification Segmented Control */}
          <section className="bg-white p-5 rounded-xl border border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3.5">
              <h3 className="text-sm font-bold text-slate-900">
                聯絡人角色分類（可按數字鍵 1 – 4 快速切換）
              </h3>
              <span className="text-sm text-slate-600">
                目前設定：
                <strong className="text-slate-900 ml-1">
                  {card.category === 'employer'
                    ? '企業夥伴 (Business)'
                    : card.category === 'academic'
                    ? '學研專家 (Academic)'
                    : card.category === 'staff'
                    ? '機關社團 (Organization)'
                    : '一般聯絡人 (General)'}
                </strong>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                {
                  id: 'employer',
                  keyHint: '1',
                  label: '企業夥伴',
                  sub: 'Business',
                  Icon: Briefcase,
                  activeCls: 'bg-blue-600 text-white border-blue-600',
                },
                {
                  id: 'academic',
                  keyHint: '2',
                  label: '學研專家',
                  sub: 'Academic',
                  Icon: GraduationCap,
                  activeCls: 'bg-amber-600 text-white border-amber-600',
                },
                {
                  id: 'staff',
                  keyHint: '3',
                  label: '機關社團',
                  sub: 'Organization',
                  Icon: UserCheck,
                  activeCls: 'bg-emerald-600 text-white border-emerald-600',
                },
                {
                  id: 'other',
                  keyHint: '4',
                  label: '一般聯絡人',
                  sub: 'General',
                  Icon: Ban,
                  activeCls: 'bg-slate-800 text-white border-slate-800',
                },
              ].map((cat) => {
                const isSelected = card.category === cat.id;
                const IconComp = cat.Icon;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() =>
                      onPersistImmediate({
                        ...card,
                        category: cat.id as BusinessCardData['category'],
                      })
                    }
                    className={`py-3 px-3.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-between border cursor-pointer ${
                      isSelected
                        ? cat.activeCls
                        : 'bg-slate-50 text-slate-800 hover:bg-slate-100 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <IconComp className="w-4 h-4 shrink-0" />
                      <div className="text-left leading-snug truncate">
                        <div>{cat.label}</div>
                        <div
                          className={`text-xs font-normal ${
                            isSelected ? 'text-white/85' : 'text-slate-500'
                          }`}
                        >
                          {cat.sub}
                        </div>
                      </div>
                    </div>
                    <kbd
                      className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-white border border-slate-200 text-slate-600'
                      }`}
                    >
                      {cat.keyHint}
                    </kbd>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Section 2: Event Source & Custom Tags */}
          <section className="grid grid-cols-1 md:grid-cols-12 gap-5 p-5 rounded-xl border border-slate-200 bg-white">
            <div className="md:col-span-5">
              <EditableField
                label="活動 / 展會來源 (Source)"
                value={card.source}
                onChange={(v) => updateField('source', v)}
                options={existingSources}
                placeholder="例如：2026 亞太永續創新論壇"
                icon={<Award className="w-4 h-4" />}
              />
            </div>

            <div className="md:col-span-7 flex flex-col">
              <label className="text-sm font-semibold text-slate-800 flex items-center gap-1.5 mb-1.5">
                <Tag className="w-4 h-4 text-slate-500" />
                <span>自訂標籤管理 (Tags)</span>
              </label>

              <div className="flex flex-wrap items-center gap-2 min-h-[44px] px-3 py-2 bg-white border border-slate-300 hover:border-slate-400 rounded-lg focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-colors">
                {(card.tags || []).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleRemoveTag(t)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-800 hover:bg-rose-50 hover:text-rose-700 border border-indigo-200 hover:border-rose-200 transition-colors cursor-pointer"
                    title="點擊移除此標籤"
                  >
                    <span>#{t}</span>
                    <X className="w-3.5 h-3.5" />
                  </button>
                ))}

                <div className="flex items-center gap-1 flex-1 min-w-[160px]">
                  <input
                    type="text"
                    list="detail-tag-suggestions"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newTagInput.trim()) {
                        e.preventDefault();
                        handleAddTag(newTagInput);
                      }
                    }}
                    placeholder="輸入標籤名稱後按 Enter 新增..."
                    className="flex-1 bg-transparent text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none py-0.5"
                  />
                  {newTagInput.trim() && (
                    <button
                      type="button"
                      onClick={() => handleAddTag(newTagInput)}
                      className="p-1.5 rounded text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                      title="新增標籤"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
                  <datalist id="detail-tag-suggestions">
                    {existingTags
                      .filter((t) => !(card.tags || []).includes(t))
                      .map((t) => (
                        <option key={t} value={t} />
                      ))}
                  </datalist>
                </div>
              </div>
            </div>
          </section>

          {/* Section 3: Identity & Institution */}
          <section className="p-5 rounded-xl border border-slate-200 bg-white space-y-5">
            <h3 className="text-base font-bold font-display text-slate-900 pb-2.5 border-b border-slate-100">
              基本身分與任職機構資訊
            </h3>

            <div className="grid grid-cols-12 gap-x-5 gap-y-5 items-start">
              <div className="col-span-12">
                <EditableField
                  label="聯絡人公開簡介 (Intro Summary)"
                  value={card.summary}
                  onChange={(v) => updateField('summary', v)}
                  icon={<FileText className="w-4 h-4" />}
                  isTextArea
                  placeholder="簡述機構背景與聯絡人職務..."
                />
              </div>

              <div className="col-span-12 sm:col-span-3">
                <EditableField
                  label="稱謂 (Prefix)"
                  value={card.prefix}
                  onChange={(v) => updateField('prefix', v)}
                  options={['Mr.', 'Ms.', 'Dr.', 'Prof.']}
                  icon={<User className="w-4 h-4" />}
                />
              </div>
              <div className="col-span-12 sm:col-span-4">
                <EditableField
                  label="姓氏 (Last Name)"
                  value={card.lastName}
                  onChange={(v) => updateField('lastName', v)}
                />
              </div>
              <div className="col-span-12 sm:col-span-5">
                <EditableField
                  label="名字 (First Name)"
                  value={card.firstName}
                  onChange={(v) => updateField('firstName', v)}
                />
              </div>

              <div className="col-span-12 md:col-span-6">
                <EditableField
                  label="職稱 (Job Title / Position)"
                  value={card.title}
                  translation={card.translations?.title}
                  onChange={(v) => updateField('title', v)}
                  icon={<Briefcase className="w-4 h-4" />}
                />
              </div>
              <div className="col-span-12 md:col-span-6">
                <EditableField
                  label="公司 / 學術機構 (Company / Institution)"
                  value={card.company}
                  translation={card.translations?.company}
                  onChange={(v) => updateField('company', v)}
                  icon={<Building2 className="w-4 h-4" />}
                />
              </div>

              <div className="col-span-12 md:col-span-4">
                <EditableField
                  label="部門 / 系所 (Department)"
                  value={card.department}
                  translation={card.translations?.department}
                  onChange={(v) => updateField('department', v)}
                />
              </div>
              <div className="col-span-12 md:col-span-4">
                <EditableField
                  label="產業類別 (Industry)"
                  value={card.industry}
                  translation={card.translations?.industry}
                  onChange={(v) => updateField('industry', v)}
                />
              </div>
              <div className="col-span-12 md:col-span-4">
                {card.category === 'academic' ? (
                  <EditableField
                    label="專業與學科領域 (Subject)"
                    value={card.subject}
                    translation={card.translations?.subject}
                    onChange={(v) => updateField('subject', v)}
                    icon={<BookOpen className="w-4 h-4" />}
                  />
                ) : (
                  <EditableField
                    label="國家 / 地區 (標準 197 國)"
                    value={card.country}
                    translation={card.translations?.country}
                    onChange={(v) => updateField('country', v)}
                    onBlur={() => {
                      if (card.country) {
                        updateField('country', normalizeCountry(card.country));
                      }
                    }}
                    options={STANDARD_COUNTRY_OPTIONS}
                    placeholder="例如：Taiwan SAR"
                    icon={<Globe className="w-4 h-4" />}
                  />
                )}
              </div>
            </div>
          </section>

          {/* Section 4: Contact Channels & Location */}
          <section className="p-5 rounded-xl border border-slate-200 bg-white space-y-5">
            <h3 className="text-base font-bold font-display text-slate-900 pb-2.5 border-b border-slate-100">
              聯絡方式與通訊地址
            </h3>

            <div className="grid grid-cols-12 gap-x-5 gap-y-5 items-start">
              <div className="col-span-12 md:col-span-6">
                <EditableField
                  label="電子信箱 (Email)"
                  value={card.email}
                  onChange={(v) => updateField('email', v)}
                  icon={<Mail className="w-4 h-4" />}
                />
              </div>
              <div className="col-span-12 md:col-span-6">
                <EditableField
                  label="官方網站 (Website)"
                  value={card.website}
                  onChange={(v) => updateField('website', v)}
                  icon={<Globe className="w-4 h-4" />}
                />
              </div>

              <div className="col-span-12 md:col-span-6">
                <EditableField
                  label="聯絡電話 (Phone)"
                  value={card.phone}
                  onChange={(v) => updateField('phone', v)}
                  icon={<Phone className="w-4 h-4" />}
                />
              </div>
              <div className="col-span-12 md:col-span-6">
                <EditableField
                  label="傳真 (Fax)"
                  value={card.fax}
                  onChange={(v) => updateField('fax', v)}
                  icon={<Printer className="w-4 h-4" />}
                />
              </div>

              {card.category === 'academic' && (
                <div className="col-span-12 md:col-span-6">
                  <EditableField
                    label="國家 / 地區 (標準 197 國)"
                    value={card.country}
                    translation={card.translations?.country}
                    onChange={(v) => updateField('country', v)}
                    onBlur={() => {
                      if (card.country) {
                        updateField('country', normalizeCountry(card.country));
                      }
                    }}
                    options={STANDARD_COUNTRY_OPTIONS}
                    placeholder="例如：Taiwan SAR"
                    icon={<Globe className="w-4 h-4" />}
                  />
                </div>
              )}

              <div className="col-span-12">
                <EditableField
                  label="通訊地址 (Address)"
                  value={card.address}
                  onChange={(v) => updateField('address', v)}
                  icon={<MapPin className="w-4 h-4" />}
                />
              </div>
            </div>
          </section>

          {/* Section 5: Classification Basis & Internal Notes */}
          <section className="p-5 rounded-xl border border-slate-200 bg-white space-y-5">
            <h3 className="text-base font-bold font-display text-slate-900 pb-2.5 border-b border-slate-100">
              分類判定依據與會談備註
            </h3>

            <div className="grid grid-cols-12 gap-x-5 gap-y-5 items-start">
              <div className="col-span-12 md:col-span-6">
                <div className="text-sm font-semibold text-slate-800 mb-1.5">
                  系統分類依據說明 (Classification Basis)
                </div>
                <div className="bg-slate-50 px-3.5 py-2.5 rounded-lg border border-slate-200 h-24 overflow-y-auto custom-scrollbar">
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                    {card.reasoning || '尚無自動分類判斷記錄'}
                  </p>
                </div>
              </div>

              <div className="col-span-12 md:col-span-6">
                <EditableField
                  label="內部備註與會談紀錄 (Notes)"
                  value={card.notes}
                  onChange={(v) => updateField('notes', v)}
                  isTextArea
                  placeholder="記錄會談重點、合作意向或反面補充說明..."
                />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
