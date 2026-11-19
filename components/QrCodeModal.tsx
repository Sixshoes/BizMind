import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode, Download, UserPlus, X, Copy, Check } from 'lucide-react';
import { BusinessCardData } from '../types';
import { createVCardString, createVCardFile } from '../services/vcardService';
import { useToast } from './ToastProvider';

interface QrCodeModalProps {
  card: BusinessCardData | null;
  onClose: () => void;
}

export const QrCodeModal: React.FC<QrCodeModalProps> = ({ card, onClose }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedVcard, setCopiedVcard] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    if (!card) return;
    let active = true;
    const vcardText = createVCardString([card], false);

    QRCode.toDataURL(vcardText, {
      width: 320,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch((err) => {
        console.error('QR Code generation failed:', err);
      });

    return () => {
      active = false;
    };
  }, [card]);

  useEffect(() => {
    if (!card) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [card, onClose]);

  if (!card) return null;

  const fullName =
    [card.prefix, card.firstName, card.lastName].filter(Boolean).join(' ') ||
    card.company ||
    '聯絡人名片';

  const metaParts = [card.title, card.company, card.country].filter(Boolean);

  const handleDownloadVcf = () => {
    const file = createVCardFile([card]);
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    addToast({ type: 'success', message: '已下載 vCard 電子名片 (.vcf)' });
  };

  const handleDownloadPng = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `BizMind_QR_${card.firstName || 'Contact'}_${card.lastName || ''}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    addToast({ type: 'success', message: '已下載 QR Code 圖片' });
  };

  const handleCopyInfo = async () => {
    const summaryLines = [
      fullName,
      metaParts.join(' · '),
      card.email ? `Email: ${card.email}` : '',
      card.phone ? `Tel: ${card.phone}` : '',
      card.website ? `Web: ${card.website}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await navigator.clipboard.writeText(summaryLines);
      setCopiedVcard(true);
      addToast({ type: 'success', message: '已複製聯絡資訊至剪貼簿' });
      setTimeout(() => setCopiedVcard(false), 2000);
    } catch {
      addToast({ type: 'error', message: '複製失敗' });
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9500] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white w-full max-w-md rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold font-display text-slate-900">
                vCard 電子名片 QR Code
              </h3>
              <p className="text-xs text-slate-600">手機相機掃描即可直接加入通訊錄</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="關閉"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 flex flex-col items-center text-center">
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs mb-4">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`${fullName} QR Code`}
                className="w-56 h-56 object-contain"
              />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center text-sm text-slate-500">
                正在產生 QR Code...
              </div>
            )}
          </div>

          <h4 className="text-lg font-bold font-display text-slate-900">{fullName}</h4>
          {metaParts.length > 0 && (
            <p className="text-sm text-slate-600 mt-1 leading-relaxed">{metaParts.join(' · ')}</p>
          )}
          {(card.email || card.phone) && (
            <p className="text-sm text-slate-700 font-mono mt-2">
              {[card.email?.split('/')[0]?.trim(), card.phone?.split('/')[0]?.trim()]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </div>

        <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleCopyInfo}
            className="px-3.5 py-2 rounded-lg text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            {copiedVcard ? (
              <Check className="w-4 h-4 text-emerald-600" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            <span>複製資訊</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPng}
              disabled={!qrDataUrl}
              className="px-3.5 py-2 rounded-lg text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              <span>下載圖檔</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadVcf}
              className="px-3.5 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <UserPlus className="w-4 h-4" />
              <span>下載 .vcf</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
