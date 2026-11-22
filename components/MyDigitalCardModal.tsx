import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import QRCode from 'qrcode';
import { QrCode, User, Download, Copy, Check, X, Edit3, Share2, Save, Loader2 } from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import { MyDigitalCardProfile, BusinessCardData } from '../types';
import { createVCardString, createVCardFile } from '../services/vcardService';
import { fetchMyDigitalCardCloud, saveMyDigitalCardCloud } from '../utils/cardCloud';
import { useToast } from './ToastProvider';

const STORAGE_KEY = 'bizmind_my_digital_card_v1';
const SENDER_STORAGE_KEY = 'bizmind_sender_profile_v1';

interface MyDigitalCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  authUser: FirebaseUser | null | undefined;
}

const EMPTY_PROFILE: MyDigitalCardProfile = {
  prefix: '',
  firstName: '',
  lastName: '',
  title: '',
  company: '',
  department: '',
  email: '',
  phone: '',
  website: '',
  address: '',
  notes: '',
};

function profileToPseudoCard(p: MyDigitalCardProfile): BusinessCardData {
  return {
    id: 'my-digital-card',
    prefix: p.prefix,
    firstName: p.firstName,
    lastName: p.lastName,
    title: p.title,
    company: p.company,
    department: p.department,
    industry: '',
    country: '',
    email: p.email,
    phone: p.phone,
    fax: '',
    subject: '',
    source: 'BizMind',
    website: p.website,
    address: p.address,
    notes: p.notes,
    category: 'other',
    reasoning: '',
    summary: '',
    scannedAt: Date.now(),
    syncStatus: 'local',
  };
}

export const MyDigitalCardModal: React.FC<MyDigitalCardModalProps> = ({
  isOpen,
  onClose,
  authUser,
}) => {
  const { addToast } = useToast();
  const [profile, setProfile] = useState<MyDigitalCardProfile>(EMPTY_PROFILE);
  const [tab, setTab] = useState<'qr' | 'edit'>('qr');
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const hasBasicData = Boolean(
    profile.firstName.trim() || profile.lastName.trim() || profile.company.trim() || profile.email.trim()
  );

  // Load saved profile from localStorage and cloud
  useEffect(() => {
    if (!isOpen) return;
    let localProfile: MyDigitalCardProfile | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) localProfile = { ...EMPTY_PROFILE, ...JSON.parse(raw) };
    } catch {
      // ignore
    }

    if (localProfile) {
      setProfile(localProfile);
      const hasData = Boolean(
        localProfile.firstName || localProfile.lastName || localProfile.company || localProfile.email
      );
      setTab(hasData ? 'qr' : 'edit');
    } else if (authUser) {
      const displayName = (authUser.displayName || '').trim();
      const parts = displayName.split(/\s+/);
      const prefill: MyDigitalCardProfile = {
        ...EMPTY_PROFILE,
        firstName: parts[0] || '',
        lastName: parts.slice(1).join(' '),
        email: authUser.email || '',
      };
      setProfile(prefill);
      setTab('edit');
    } else {
      setTab('edit');
    }

    if (authUser) {
      fetchMyDigitalCardCloud()
        .then((remote) => {
          if (remote && (remote.updatedAt || 0) >= (localProfile?.updatedAt || 0)) {
            const merged = { ...EMPTY_PROFILE, ...remote };
            setProfile(merged);
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
            } catch {
              // ignore
            }
            if (merged.firstName || merged.lastName || merged.company) {
              setTab('qr');
            }
          }
        })
        .catch(() => {});
    }
  }, [isOpen, authUser]);

  // Render QR canvas whenever in QR tab and profile changes
  useEffect(() => {
    if (!isOpen || tab !== 'qr' || !hasBasicData || !canvasRef.current) return;
    const vcardStr = createVCardString([profileToPseudoCard(profile)], false);
    QRCode.toCanvas(canvasRef.current, vcardStr, {
      width: 224,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f172a', light: '#ffffff' },
    }).catch((err) => console.error('My QR generation error:', err));
  }, [isOpen, tab, profile, hasBasicData]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updated: MyDigitalCardProfile = { ...profile, updatedAt: Date.now() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      // Also sync sender signature for FollowUpEmailDrawer
      const fullName = `${updated.lastName}${updated.firstName}`.trim();
      if (fullName || updated.company) {
        localStorage.setItem(
          SENDER_STORAGE_KEY,
          JSON.stringify({
            senderName: fullName,
            senderOrg: [updated.company, updated.title].filter(Boolean).join(' · '),
          })
        );
      }
      if (authUser) {
        await saveMyDigitalCardCloud(updated);
      }
      setProfile(updated);
      setTab('qr');
      addToast({
        type: 'success',
        message: authUser ? '已儲存並同步您的數位電子名片' : '已儲存您的本機數位電子名片',
      });
    } catch (err: any) {
      addToast({ type: 'error', message: `儲存失敗：${err.message || '未知錯誤'}` });
    } finally {
      setIsSaving(false);
    }
  };

  const fullName =
    [profile.prefix, profile.lastName, profile.firstName].filter(Boolean).join(' ') ||
    profile.company ||
    '我的數位名片';

  const handleDownloadVcf = () => {
    const file = createVCardFile([profileToPseudoCard(profile)]);
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = `My_BizMind_Card.vcf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    addToast({ type: 'success', message: '已下載個人 .vcf 電子名片檔' });
  };

  const handleCopyText = async () => {
    const text = [
      fullName,
      [profile.company, profile.department, profile.title].filter(Boolean).join(' · '),
      profile.email ? `Email: ${profile.email}` : '',
      profile.phone ? `Tel: ${profile.phone}` : '',
      profile.website ? `Web: ${profile.website}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      addToast({ type: 'success', message: '已複製個人聯絡資訊' });
      setTimeout(() => setCopied(false), 1800);
    } catch {
      addToast({ type: 'error', message: '複製失敗' });
    }
  };

  const handleNativeShare = async () => {
    const file = createVCardFile([profileToPseudoCard(profile)]);
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${fullName} 的電子名片`,
          text: '掃描或匯入我的 BizMind 無紙化電子名片',
        });
        return;
      }
      if (navigator.share) {
        await navigator.share({
          title: fullName,
          text: `${fullName}\n${profile.company} ${profile.title}\n${profile.email}\n${profile.phone}`,
        });
        return;
      }
    } catch {
      // cancelled
    }
    handleCopyText();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-[9600] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="我的無紙化數位電子名片"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold font-display text-slate-900 dark:text-white">
                    我的無紙化數位名片
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    對方用手機相機掃描即可直接加入通訊錄
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer"
                aria-label="關閉"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode Switcher */}
            <div className="px-5 pt-3">
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setTab('qr')}
                  className={`py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    tab === 'qr'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>展示 QR 名片</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTab('edit')}
                  className={`py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    tab === 'edit'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>編輯個人資料</span>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              {tab === 'qr' ? (
                hasBasicData ? (
                  <div className="flex flex-col items-center text-center space-y-4">
                    {/* Stylized Digital Card Header */}
                    <div className="w-full rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-5 text-left shadow-lg border border-indigo-500/20">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-lg font-bold font-display tracking-tight">
                            {fullName}
                          </div>
                          {profile.title && (
                            <div className="text-xs text-indigo-200 font-medium mt-0.5">
                              {profile.title}
                            </div>
                          )}
                        </div>
                        <span className="px-2 py-0.5 rounded-md bg-white/10 text-[10px] font-bold tracking-wider uppercase text-indigo-200">
                          BizMind ID
                        </span>
                      </div>
                      {(profile.company || profile.department) && (
                        <div className="text-xs text-slate-300 mt-3 pt-3 border-t border-white/10">
                          {[profile.company, profile.department].filter(Boolean).join(' · ')}
                        </div>
                      )}
                      <div className="mt-2 space-y-0.5 text-[11px] text-slate-300 font-mono">
                        {profile.email && <div className="truncate">{profile.email}</div>}
                        {profile.phone && <div className="truncate">{profile.phone}</div>}
                        {profile.website && <div className="truncate text-indigo-300">{profile.website}</div>}
                      </div>
                    </div>

                    {/* High-Contrast QR Container */}
                    <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                      <canvas ref={canvasRef} className="block rounded-lg" />
                    </div>

                    <div className="grid grid-cols-3 gap-2 w-full">
                      <button
                        type="button"
                        onClick={handleCopyText}
                        className="py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>複製</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadVcf}
                        className="py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>.vcf</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleNativeShare}
                        className="py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>分享</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="py-10 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                      <User className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      尚未設定您的個人電子名片
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      填寫姓名、單位與聯絡方式後，即可一鍵出示無紙化 QR 名片並自動帶入開發信署名。
                    </p>
                    <button
                      type="button"
                      onClick={() => setTab('edit')}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer"
                    >
                      立即建立我的名片
                    </button>
                  </div>
                )
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                        姓氏 (Last Name)
                      </label>
                      <input
                        type="text"
                        value={profile.lastName}
                        onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                        placeholder="陳"
                        className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                        名字 (First Name)
                      </label>
                      <input
                        type="text"
                        value={profile.firstName}
                        onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                        placeholder="小明 Ming"
                        className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  {[
                    { key: 'company', label: '公司 / 任職機構', placeholder: '佛光大學 / BizMind Lab' },
                    { key: 'title', label: '職稱 (Title)', placeholder: '專案經理 / 研究助理' },
                    { key: 'department', label: '部門 / 系所', placeholder: '國際事務處' },
                    { key: 'email', label: '電子信箱 (Email)', placeholder: 'name@example.com' },
                    { key: 'phone', label: '聯絡電話 / 手機', placeholder: '+886-912-345-678' },
                    { key: 'website', label: '個人網站 / LinkedIn', placeholder: 'https://...' },
                    { key: 'address', label: '通訊地址', placeholder: '選填' },
                  ].map(({ key, label, placeholder }) => (
                    <div key={key}>
                      <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                        {label}
                      </label>
                      <input
                        type="text"
                        value={(profile as any)[key] || ''}
                        onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}
                        placeholder={placeholder}
                        className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  ))}

                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleSave}
                    className="w-full mt-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-bold flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    <span>儲存並產生數位 QR 名片</span>
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
