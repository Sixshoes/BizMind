import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  X,
  RotateCcw,
  Upload,
  Camera,
  FlipHorizontal2,
  RotateCw,
  ClipboardCheck,
  FileSpreadsheet,
  GraduationCap,
  Briefcase,
  UserCheck,
  Ban,
  Filter,
  CheckSquare,
  Layers,
  CloudUpload,
  Keyboard,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  QrCode,
  Mail,
} from 'lucide-react';

interface UserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartInteractiveTour: () => void;
}

type GuideSectionId = 'quickstart' | 'scanning' | 'categories' | 'database' | 'cloud_shortcuts';

const SECTIONS: { id: GuideSectionId; step: string; title: string; subtitle: string }[] = [
  {
    id: 'quickstart',
    step: '01',
    title: '快速上手 4 步驟',
    subtitle: '從拍攝建檔到無紙化管理',
  },
  {
    id: 'scanning',
    step: '02',
    title: '掃描、雙面合併與翻正',
    subtitle: '圖檔、PDF 裁切與影像方向修正',
  },
  {
    id: 'categories',
    step: '03',
    title: '聯絡人分類與報表匯出',
    subtitle: '四大角色歸戶、資料健檢與多格式輸出',
  },
  {
    id: 'database',
    step: '04',
    title: '資料庫檢索與批次編輯',
    subtitle: '多維篩選、標籤來源與重複合併',
  },
  {
    id: 'cloud_shortcuts',
    step: '05',
    title: '雲端同步與快捷鍵',
    subtitle: '個人雲端備份、AI 揭露與高速審閱',
  },
];

export const UserGuideModal: React.FC<UserGuideModalProps> = ({
  isOpen,
  onClose,
  onStartInteractiveTour,
}) => {
  const [activeSection, setActiveSection] = useState<GuideSectionId>('quickstart');

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentIdx = SECTIONS.findIndex((s) => s.id === activeSection);
  const canGoPrev = currentIdx > 0;
  const canGoNext = currentIdx < SECTIONS.length - 1;

  return (
    <div
      className="fixed inset-0 z-[9600] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white w-full max-w-5xl h-[88vh] max-h-[820px] rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0 bg-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold font-display text-slate-900 truncate">
                BizMind 智慧名片系統使用指南
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 truncate">
                了解名片智慧辨識、雙面合併、溫暖跟進信草擬與無紙化交換完整流程
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label="關閉說明"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          <nav className="md:w-64 border-b md:border-b-0 md:border-r border-slate-200 bg-slate-50/80 p-3 flex md:flex-col gap-1.5 overflow-x-auto md:overflow-y-auto shrink-0 custom-scrollbar">
            {SECTIONS.map((sec) => {
              const active = sec.id === activeSection;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setActiveSection(sec.id)}
                  className={`text-left px-3.5 py-2.5 rounded-xl transition-colors shrink-0 md:shrink cursor-pointer border ${
                    active
                      ? 'bg-white border-indigo-300 shadow-2xs text-indigo-900'
                      : 'bg-transparent border-transparent hover:bg-white/70 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        active ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {sec.step}
                    </span>
                    <span className="text-sm font-bold whitespace-nowrap md:whitespace-normal">
                      {sec.title}
                    </span>
                  </div>
                  <p className="hidden md:block text-xs text-slate-500 mt-1 pl-7 leading-snug">
                    {sec.subtitle}
                  </p>
                </button>
              );
            })}
          </nav>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-5 sm:p-7 bg-white">
            {activeSection === 'quickstart' && (
              <div className="max-w-3xl space-y-6">
                <div>
                  <div className="text-xs font-bold text-indigo-600 tracking-wide mb-1">
                    CHAPTER 01 · 快速上手
                  </div>
                  <h3 className="text-xl font-bold font-display text-slate-900">
                    4 個步驟完成名片無紙化建檔與關係維繫
                  </h3>
                  <p className="text-sm text-slate-700 mt-2 leading-relaxed">
                    BizMind 結合多模態視覺 AI 與雙面語意合併技術，讓繁瑣的紙本名片整理化為高效率、有溫度的數位人脈資產。
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    {
                      step: '步驟 1',
                      title: '新增、拖曳或拍照掃描名片',
                      desc: '點擊右上角「新增名片」或直接把 JPG、PNG、多頁掃描 PDF 拖曳進視窗；行動裝置可點擊「拍照」直接拍攝實體名片。',
                      Icon: Upload,
                    },
                    {
                      step: '步驟 2',
                      title: '自動擷取欄位與影像翻正',
                      desc: 'AI 自動辨識姓名、職稱、機構、信箱與多語對照翻譯，並將橫躺或顛倒的名片影像自動翻正。',
                      Icon: RotateCw,
                    },
                    {
                      step: '步驟 3',
                      title: '雙面併排檢視與智慧合併',
                      desc: '上傳或拍攝名片反面後可開啟「併排檢視」；中英文雙面自動對齊合併，不同兼任職稱自動斜線整合。',
                      Icon: FlipHorizontal2,
                    },
                    {
                      step: '步驟 4',
                      title: 'AI 溫暖跟進信與多格式匯出',
                      desc: '一鍵依據對方背景草擬得體的會後致謝跟進信，或透過 QR 電子名片、Excel、vCard 隨時分享與備份。',
                      Icon: Mail,
                    },
                  ].map((item, idx) => {
                    const IconComp = item.Icon;
                    return (
                      <div
                        key={idx}
                        className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col gap-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2.5 py-0.5 rounded-md">
                            {item.step}
                          </span>
                          <IconComp className="w-5 h-5 text-slate-600" />
                        </div>
                        <h4 className="text-base font-bold text-slate-900">{item.title}</h4>
                        <p className="text-sm text-slate-700 leading-relaxed">{item.desc}</p>
                      </div>
                    );
                  })}
                </div>

                <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">想跟著畫面一步步導覽嗎？</h4>
                    <p className="text-sm text-slate-700 mt-0.5">
                      點擊右側按鈕即可高亮標示畫面上每個核心功能的位置。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onStartInteractiveTour();
                    }}
                    className="px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer whitespace-nowrap"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>啟動實境步驟導覽</span>
                  </button>
                </div>
              </div>
            )}

            {activeSection === 'scanning' && (
              <div className="max-w-3xl space-y-6">
                <div>
                  <div className="text-xs font-bold text-indigo-600 tracking-wide mb-1">
                    CHAPTER 02 · 掃描與影像處理
                  </div>
                  <h3 className="text-xl font-bold font-display text-slate-900">
                    批次掃描、PDF 智慧裁切、雙面合併與自動翻正
                  </h3>
                </div>

                <div className="space-y-4">
                  <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center gap-2 text-base font-bold text-slate-900">
                      <Upload className="w-4 h-4 text-indigo-600" />
                      <span>1. 單張、多張批次圖檔與多頁 PDF 裁切</span>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      • <strong>單張圖檔或 PDF</strong>：上傳後進入「智慧裁切工作台」，AI 自動框選同一頁上的多張名片；可手動微調裁切框後一次送入辨識佇列。
                      <br />• <strong>多張照片批次上傳</strong>：一次選取多張圖檔時，背景佇列會自動逐張辨識，不阻塞您瀏覽或編輯其他名片。
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center gap-2 text-base font-bold text-slate-900">
                      <FlipHorizontal2 className="w-4 h-4 text-indigo-600" />
                      <span>2. 雙面名片併排檢視、雙語升降與差異衝突處理</span>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      審閱名片時支援<strong>「正面」</strong>、<strong>「反面」</strong>與<strong>「併排檢視」</strong>三種模式：
                      <br />• <strong>中英雙語名片</strong>：自動對齊中英文資訊，保留雙語對照不遺漏。
                      <br />• <strong>前後職稱或機構不同</strong>：主動彈出正反面對照視窗，讓您選擇「合併為兼任身分」、「拆分為兩筆獨立名片」或「僅保留雙面影像」。
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center gap-2 text-base font-bold text-slate-900">
                      <Camera className="w-4 h-4 text-indigo-600" />
                      <span>3. 無紙化電子名片 QR Code 與溫暖跟進信</span>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      點擊<strong>「QR 名片」</strong>（快捷鍵 <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-xs font-mono">Q</kbd>）即可讓對方用手機掃描匯入通訊錄，免印紙張；點擊<strong>「跟進信草稿」</strong>（快捷鍵 <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-xs font-mono">E</kbd>）可依認識場合生成真誠有禮的中英文問候信。
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'categories' && (
              <div className="max-w-3xl space-y-6">
                <div>
                  <div className="text-xs font-bold text-indigo-600 tracking-wide mb-1">
                    CHAPTER 03 · 聯絡人分類與報表匯出
                  </div>
                  <h3 className="text-xl font-bold font-display text-slate-900">
                    四大實務角色分類、欄位健檢與多格式輸出
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 space-y-1.5">
                    <div className="flex items-center gap-2 text-base font-bold text-blue-900">
                      <Briefcase className="w-5 h-5 text-blue-700" />
                      <span>企業夥伴 (Business)</span>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      各產業企業客戶、合作廠商、綠色供應鏈夥伴與社會企業代表。
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 space-y-1.5">
                    <div className="flex items-center gap-2 text-base font-bold text-amber-900">
                      <GraduationCap className="w-5 h-5 text-amber-700" />
                      <span>學研專家 (Academic)</span>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      大學學者、研究機構專家、顧問與專業領域講師。
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-1.5">
                    <div className="flex items-center gap-2 text-base font-bold text-emerald-900">
                      <UserCheck className="w-5 h-5 text-emerald-700" />
                      <span>機關社團 (Organization)</span>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      公部門機關、非營利公益組織、基金會、公協會及行政協調窗口。
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
                    <div className="flex items-center gap-2 text-base font-bold text-slate-900">
                      <Ban className="w-5 h-5 text-slate-600" />
                      <span>一般聯絡人 (General)</span>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      日常交流人脈、個人名片或通用服務店家聯絡資訊。
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2.5">
                  <div className="flex items-center gap-2 text-base font-bold text-slate-900">
                    <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
                    <span>多元匯出與完整備份格式</span>
                  </div>
                  <ul className="space-y-2 text-sm text-slate-700 leading-relaxed">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-1" />
                      <span>
                        支援匯出<strong>分類多頁簿 Excel (.xlsx)</strong>、<strong>手機通訊錄 vCard (.vcf)</strong>、<strong>含照片壓縮包 (.zip)</strong> 以及 <strong>JSON / CSV 完整備份還原</strong>。
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {activeSection === 'database' && (
              <div className="max-w-3xl space-y-6">
                <div>
                  <div className="text-xs font-bold text-indigo-600 tracking-wide mb-1">
                    CHAPTER 04 · 資料庫檢索與批次管理
                  </div>
                  <h3 className="text-xl font-bold font-display text-slate-900">
                    清單／卡片牆切換、批次編輯與重複聯絡人智慧合併
                  </h3>
                </div>

                <div className="space-y-4">
                  <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center gap-2 text-base font-bold text-slate-900">
                      <Filter className="w-4 h-4 text-indigo-600" />
                      <span>1. 多維度交叉篩選與「表格清單 / 卡片牆」雙模式</span>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      支援關鍵字搜尋、分類頁籤、197 標準國別、活動來源、自訂標籤與「雙面名片」過濾，並可隨時切換高密度<strong>表格清單</strong>或直覺的<strong>名片卡片牆</strong>。
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center gap-2 text-base font-bold text-slate-900">
                      <CheckSquare className="w-4 h-4 text-indigo-600" />
                      <span>2. 多筆勾選與底部浮動「批次編輯列」</span>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      勾選多筆名片後，下方自動浮現深色批次操作列，可一次執行批次更改分類、國家、活動來源、貼上標籤或進入匯出檢查。
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center gap-2 text-base font-bold text-slate-900">
                      <Layers className="w-4 h-4 text-indigo-600" />
                      <span>3. 重複名片偵測與智慧合併</span>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      自動比對相同 Email、電話或同名同機構的重複紀錄，一鍵保留最完整主紀錄並合併電話、備註、標籤與反面圖檔。
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'cloud_shortcuts' && (
              <div className="max-w-3xl space-y-6">
                <div>
                  <div className="text-xs font-bold text-indigo-600 tracking-wide mb-1">
                    CHAPTER 05 · 雲端同步、AI 透明揭露與快捷鍵
                  </div>
                  <h3 className="text-xl font-bold font-display text-slate-900">
                    Google 個人雲端同步、AI 技術揭露與高速審閱快捷鍵
                  </h3>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center gap-2 text-base font-bold text-slate-900">
                    <CloudUpload className="w-4 h-4 text-indigo-600" />
                    <span>個人雲端同步與 AI 工具使用揭露</span>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    • <strong>Google 帳號雲端同步與本機免登入模式</strong>：登入後名片與雙面影像自動同步至個人專屬 Firebase 雲端空間；若選擇免登入模式，所有資料安全儲存於本機 IndexedDB。
                    <br />• <strong>AI 技術透明揭露</strong>：本系統整合 Google Gemini 多模態模型進行名片邊界框選、OCR 結構化擷取、雙面語意比對、自然語言對話檢索與跟進信草擬；所有 AI 生成結果皆保留完整人工編修與確認權限（Human-in-the-Loop）。
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                    <Keyboard className="w-4 h-4 text-slate-700" />
                    <h4 className="text-sm font-bold text-slate-900">常用鍵盤快捷鍵速查表</h4>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {[
                      { keys: ['⌘ / Ctrl', 'K'], desc: '開啟全域 Spotlight 快速搜尋與指令面板' },
                      { keys: ['/'], desc: '在名片資料庫快速聚焦搜尋輸入框' },
                      { keys: ['J / ↓', 'K / ↑'], desc: '在審閱工作台快速切換下一張 / 上一張名片' },
                      { keys: ['1', '2', '3', '4'], desc: '一鍵切換分類：1 企業夥伴 · 2 學研專家 · 3 機關社團 · 4 一般聯絡人' },
                      { keys: ['Q'], desc: '開啟目前名片的 vCard 電子名片 QR Code' },
                      { keys: ['E'], desc: '開啟目前名片的溫暖問候跟進信抽屜' },
                      { keys: ['?'], desc: '開啟或關閉鍵盤快捷鍵清單' },
                    ].map((row, idx) => (
                      <div
                        key={idx}
                        className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm"
                      >
                        <span className="text-slate-700 font-medium">{row.desc}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {row.keys.map((k) => (
                            <kbd
                              key={k}
                              className="px-2.5 py-1 text-xs font-mono font-semibold text-slate-800 bg-slate-100 border border-slate-300 rounded-md"
                            >
                              {k}
                            </kbd>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!canGoPrev}
              onClick={() => canGoPrev && setActiveSection(SECTIONS[currentIdx - 1].id)}
              className="px-3.5 py-2 rounded-lg text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>上一章節</span>
            </button>
            <button
              type="button"
              disabled={!canGoNext}
              onClick={() => canGoNext && setActiveSection(SECTIONS[currentIdx + 1].id)}
              className="px-3.5 py-2 rounded-lg text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>下一章節</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                onClose();
                onStartInteractiveTour();
              }}
              className="hidden sm:inline-flex px-3.5 py-2 rounded-lg text-sm font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4" />
              <span>重看互動導覽</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              開始使用系統
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
