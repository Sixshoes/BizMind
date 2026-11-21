import React, { useState } from 'react';
import {
  ScanLine,
  Cloud,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  Loader2,
  FlipHorizontal2,
  QrCode,
  Mail,
  Leaf,
  CheckCircle2,
} from 'lucide-react';
import { authErrorMessage, signInWithGoogle } from '../utils/auth';

interface LoginScreenProps {
  onEnterGuestMode: (withDemoCards?: boolean) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onEnterGuestMode }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setBusy(true);
    setError('');
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 sm:p-8 overflow-y-auto">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
        {/* Left Auth Card */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none p-7 sm:p-8">
          <div className="flex items-center gap-3.5 mb-6">
            <div className="w-11 h-11 bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl flex items-center justify-center text-white shadow-md shadow-indigo-500/25 shrink-0">
              <ScanLine className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-white leading-tight">
                BizMind
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                AI 智慧名片辨識與無紙化人脈管理平台
              </p>
            </div>
          </div>

          <div className="space-y-3 mb-6 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
            <div className="flex items-start gap-2.5">
              <Cloud className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-slate-900 dark:text-slate-100">跨裝置個人雲端同步：</strong>
                登入後享有專屬加密空間，正反雙面名片影像與欄位自動同步。
              </span>
            </div>
            <div className="flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-slate-900 dark:text-slate-100">AI 智慧整理與跟進外聯：</strong>
                自動多卡裁切、方向翻正、雙語合併，並一鍵草擬溫暖會後問候信。
              </span>
            </div>
          </div>

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={handleLogin}
              disabled={busy}
              className="w-full py-3 px-4 rounded-xl bg-slate-900 dark:bg-indigo-600 text-white text-sm font-semibold hover:bg-slate-800 dark:hover:bg-indigo-500 disabled:opacity-60 transition-colors flex items-center justify-center gap-2.5 cursor-pointer shadow-sm"
            >
              {busy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>正在開啟 Google 驗證...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#EA4335"
                      d="M12 10.2v3.9h5.5c-.2 1.2-.9 2.3-1.9 3l3.1 2.4c1.8-1.7 2.8-4.1 2.8-7 0-.7-.1-1.5-.2-2.3H12z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 22c2.6 0 4.8-.9 6.4-2.4l-3.1-2.4c-.9.6-2 .9-3.3.9-2.5 0-4.7-1.7-5.5-4H3.3v2.5C4.9 19.8 8.2 22 12 22z"
                    />
                    <path
                      fill="#4A90E2"
                      d="M6.5 14.1c-.2-.6-.3-1.3-.3-2.1s.1-1.5.3-2.1V7.4H3.3C2.5 9 2 10.4 2 12s.5 3 1.3 4.6l3.2-2.5z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M12 5.9c1.4 0 2.7.5 3.7 1.4l2.8-2.8C16.8 2.9 14.6 2 12 2 8.2 2 4.9 4.2 3.3 7.4l3.2 2.5c.8-2.3 3-4 5.5-4z"
                    />
                  </svg>
                  <span>使用 Google 帳號登入（雲端同步）</span>
                </>
              )}
            </button>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
                {error}
              </div>
            )}

            <div className="relative py-2 flex items-center">
              <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
              <span className="shrink-0 mx-3 text-[11px] font-medium text-slate-400">
                或免綁定帳號立即試用
              </span>
              <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onEnterGuestMode(true)}
                className="py-2.5 px-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/70 text-indigo-700 dark:text-indigo-200 border border-indigo-200/80 dark:border-indigo-800 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>免登入＋示範名片</span>
              </button>
              <button
                type="button"
                onClick={() => onEnterGuestMode(false)}
                className="py-2.5 px-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>進入本機工作區</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>支援無紙化 QR 交換 · Human-in-the-Loop 人工把關</span>
          </div>
        </div>

        {/* Right Visual Product Showcase (Desktop Hero) */}
        <div className="hidden lg:flex lg:col-span-7 flex-col gap-5 p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white border border-slate-800 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-16 w-64 h-64 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-semibold text-indigo-200">
              <Sparkles className="w-3 h-3 text-indigo-300" />
              Gemini 多模態視覺引擎驅動
            </span>
            <h2 className="text-2xl font-bold font-display leading-snug tracking-tight">
              把每一張紙本名片，
              <br />
              轉化為有溫度的永續人脈資產
            </h2>
          </div>

          {/* Interactive-looking Live Scan Preview Card */}
          <div className="relative z-10 grid grid-cols-12 gap-4 items-center">
            {/* Simulated Business Card with Scan Laser */}
            <div className="col-span-6 aspect-[1.6/1] rounded-2xl bg-gradient-to-br from-white to-slate-100 text-slate-900 p-4 shadow-2xl relative overflow-hidden border border-white/20 flex flex-col justify-between">
              <div className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent shadow-[0_0_12px_rgba(99,102,241,0.9)] animate-scanLine" />
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-wider uppercase text-indigo-600">
                  GREEN INNOVATION LAB
                </span>
                <span className="text-[10px] font-mono text-slate-400">TW · JP</span>
              </div>
              <div>
                <div className="text-base font-bold font-display leading-tight">林宥辰 Claire Lin</div>
                <div className="text-[11px] text-slate-600 mt-0.5">
                  永續策略總監 · Sustainability Director
                </div>
              </div>
              <div className="text-[10px] font-mono text-slate-500 flex items-center justify-between pt-2 border-t border-slate-200/80">
                <span>claire@greenlab.tw</span>
                <span>+886-2-8789</span>
              </div>
            </div>

            {/* Extracted Structured Chips */}
            <div className="col-span-6 space-y-2">
              <div className="p-3 rounded-xl bg-white/8 border border-white/12 backdrop-blur-md space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-emerald-300 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> 自動擷取與翻正完成
                  </span>
                  <span className="font-mono text-slate-400">100%</span>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  <span className="px-2 py-0.5 rounded-md bg-blue-500/20 border border-blue-400/30 text-[11px] font-semibold text-blue-200">
                    企業夥伴
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 border border-indigo-400/30 text-[11px] font-semibold text-indigo-200">
                    Taiwan SAR
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/30 text-[11px] font-semibold text-emerald-200">
                    雙語對照
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { Icon: FlipHorizontal2, label: '雙面合併' },
                  { Icon: QrCode, label: 'QR 交換' },
                  { Icon: Mail, label: 'AI 問候信' },
                ].map(({ Icon, label }) => (
                  <div
                    key={label}
                    className="p-2.5 rounded-xl bg-white/6 border border-white/10 flex flex-col items-center gap-1"
                  >
                    <Icon className="w-4 h-4 text-indigo-300" />
                    <span className="text-[11px] font-semibold text-slate-200">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="relative z-10 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-300">
            <span className="flex items-center gap-1.5 text-emerald-300 font-medium">
              <Leaf className="w-4 h-4" />
              每張數位名片平均節省 8.5g CO₂e 與 3.5 分鐘人工建檔
            </span>
            <span className="font-mono text-[11px] text-slate-400">⌘K Spotlight</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
