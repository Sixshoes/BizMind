import React, { useState } from 'react';
import { ScanLine, Cloud, Sparkles, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';
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
    <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center p-6 overflow-y-auto">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
        <div className="flex items-center gap-3.5 mb-6">
          <div className="w-11 h-11 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-xs shrink-0">
            <ScanLine className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-display text-slate-900 leading-tight">
              BizMind
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              AI 智慧名片辨識與無紙化人脈管理平台
            </p>
          </div>
        </div>

        <div className="space-y-2.5 mb-6 text-xs text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
          <div className="flex items-start gap-2.5">
            <Cloud className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <span>
              <strong className="text-slate-800">跨裝置個人雲端同步：</strong>
              登入後每個帳號擁有獨立加密儲存空間，支援正反雙面名片與影像自動備份。
            </span>
          </div>
          <div className="flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              <strong className="text-slate-800">AI 智慧整理與溫暖問候：</strong>
              自動完成多卡裁切、方向翻正、雙語合併，並可一鍵草擬得體的會後跟進問候信。
            </span>
          </div>
        </div>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={handleLogin}
            disabled={busy}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-60 transition-colors flex items-center justify-center gap-2.5 cursor-pointer shadow-xs"
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
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 leading-relaxed">
              {error}
            </div>
          )}

          <div className="relative py-2 flex items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="shrink-0 mx-3 text-[11px] font-medium text-slate-400">
              或免綁定帳號快速體驗
            </span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onEnterGuestMode(true)}
              className="py-2.5 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>免登入＋載入示範名片</span>
            </button>
            <button
              type="button"
              onClick={() => onEnterGuestMode(false)}
              className="py-2.5 px-3 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>直接進入本機工作區</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>支援無紙化 QR 電子名片交換 · AI 結果皆由人工確認把關</span>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
