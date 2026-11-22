import React, { useRef, useState, useEffect } from 'react';
import {
  Camera,
  Loader2,
  X,
  RefreshCw,
  Zap,
  ZapOff,
  SwitchCamera,
  Check,
  RotateCcw,
  Layers,
  ImagePlus,
  QrCode,
} from 'lucide-react';
import { BusinessCardData } from '../types';
import { parseContactQrPayload } from '../utils/vcardParser';

interface CameraScannerProps {
  onCapture: (base64: string, options?: { keepOpen?: boolean }) => void;
  onScanVCard?: (parsed: Partial<BusinessCardData>) => void;
  onClose: () => void;
  onPickFromAlbum?: () => void;
  isMobile?: boolean;
  modeLabel?: string;
  allowBurstMode?: boolean;
}

const CameraScanner: React.FC<CameraScannerProps> = ({
  onCapture,
  onScanVCard,
  onClose,
  onPickFromAlbum,
  isMobile = false,
  modeLabel = '將名片置於框內拍攝',
  allowBurstMode = true,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  // Capture UX states
  const [burstMode, setBurstMode] = useState(false);
  const [burstShots, setBurstShots] = useState<string[]>([]);
  const [previewB64, setPreviewB64] = useState<string | null>(null);
  const [flashTrigger, setFlashTrigger] = useState(0);
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const [detectedQrContact, setDetectedQrContact] = useState<Partial<BusinessCardData> | null>(null);

  const stopTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
    setIsReady(false);
    setTorchOn(false);
    setTorchSupported(false);
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const startCamera = async (preferredFacing: 'environment' | 'user' = facingMode) => {
    setIsLoading(true);
    setError(null);
    stopTracks();

    const getStream = async (constraints: MediaStreamConstraints) =>
      navigator.mediaDevices.getUserMedia(constraints);

    try {
      let mediaStream: MediaStream | null = null;
      try {
        mediaStream = await getStream({
          video: {
            facingMode: { ideal: preferredFacing },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
      } catch {
        // fallback 1
      }

      if (!mediaStream) {
        try {
          mediaStream = await getStream({
            video: { facingMode: preferredFacing },
            audio: false,
          });
        } catch {
          // fallback 2
        }
      }

      if (!mediaStream) {
        mediaStream = await getStream({ video: true, audio: false });
      }

      if (!mediaStream) throw new Error('無法取得視訊串流');

      streamRef.current = mediaStream;

      const track = mediaStream.getVideoTracks()[0];
      try {
        const capabilities: any = (track.getCapabilities && track.getCapabilities()) || {};
        if (capabilities.torch) {
          setTorchSupported(true);
        }
        if (
          capabilities.focusMode &&
          Array.isArray(capabilities.focusMode) &&
          capabilities.focusMode.includes('continuous')
        ) {
          await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] as any });
        }
      } catch {
        // capability detection unsupported
      }

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = async () => {
          try {
            await videoRef.current?.play();
            setIsReady(true);
          } catch (e) {
            console.error('Play error:', e);
            setError('無法啟動視訊預覽，請確認瀏覽器權限。');
          } finally {
            setIsLoading(false);
          }
        };
      }
    } catch (err: any) {
      setIsLoading(false);
      console.error(err);

      let msg = '無法啟動相機。';
      if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = '找不到可用的相機裝置。';
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = '相機權限被拒絕，請至瀏覽器設定允許存取。';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        msg = '相機可能正被其他應用程式使用中。';
      } else if (err.message) {
        msg += ` (${err.message})`;
      }
      setError(msg);
    }
  };

  useEffect(() => {
    startCamera('environment');
    return () => stopTracks();
  }, []);

  // Optional zero-AI live QR vCard / MeCard detection when supported by browser BarcodeDetector
  useEffect(() => {
    if (!isReady || previewB64 || !onScanVCard) return;
    const DetectorCtor = (window as any).BarcodeDetector;
    if (typeof DetectorCtor !== 'function') return;

    let cancelled = false;
    let detector: any = null;
    try {
      detector = new DetectorCtor({ formats: ['qr_code'] });
    } catch {
      return;
    }

    const interval = setInterval(async () => {
      if (cancelled || !videoRef.current || videoRef.current.readyState < 2) return;
      try {
        const codes = await detector.detect(videoRef.current);
        for (const code of codes || []) {
          const parsed = parseContactQrPayload(code.rawValue || '');
          if (parsed) {
            setDetectedQrContact(parsed);
            return;
          }
        }
      } catch {
        // ignore transient detection failures
      }
    }, 650);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isReady, previewB64, onScanVCard]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (previewB64) {
          setPreviewB64(null);
        } else {
          stopTracks();
          onClose();
        }
      } else if (e.key === ' ' && isReady && !previewB64) {
        e.preventDefault();
        capture();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isReady, previewB64, burstMode]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !torchSupported) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] as any });
      setTorchOn(next);
    } catch {
      // ignore unsupported torch error
    }
  };

  const handleSwitchCamera = () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    startCamera(next);
  };

  const handleTapFocus = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setFocusPoint({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setTimeout(() => setFocusPoint(null), 700);
  };

  const capture = () => {
    if (!videoRef.current || !canvasRef.current || !isReady) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    const maxDim = 1920;
    let w = video.videoWidth;
    let h = video.videoHeight;

    if (w > maxDim || h > maxDim) {
      const ratio = Math.min(maxDim / w, maxDim / h);
      w = Math.floor(w * ratio);
      h = Math.floor(h * ratio);
    }

    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, w, h);
    try {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      const b64 = dataUrl.split(',')[1];
      setFlashTrigger((n) => n + 1);

      if (burstMode && allowBurstMode) {
        // Continuous burst mode: enqueue in background immediately and keep camera open
        setBurstShots((prev) => [...prev, dataUrl]);
        onCapture(b64, { keepOpen: true });
      } else {
        // Single-shot mode: show crisp preview confirmation to avoid blurry OCR waste
        setPreviewB64(b64);
      }
    } catch (e) {
      console.error('Capture failed', e);
      setIsReady(false);
      setError('擷取影像失敗（裝置記憶體不足），請關閉其他分頁後重試。');
    }
  };

  const handleConfirmPreview = () => {
    if (!previewB64) return;
    const b64 = previewB64;
    setPreviewB64(null);
    stopTracks();
    onCapture(b64, { keepOpen: false });
  };

  const containerClass = isMobile
    ? 'h-full w-full bg-slate-950 relative overflow-hidden'
    : 'flex flex-col items-center justify-center h-full w-full bg-slate-950 overflow-hidden relative';

  return (
    <div className={containerClass} onClick={handleTapFocus}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`h-full w-full object-cover transition-opacity duration-300 ${
          isReady ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Shutter Flash Effect */}
      {flashTrigger > 0 && (
        <div
          key={flashTrigger}
          className="absolute inset-0 bg-white pointer-events-none z-40 animate-shutterFlash"
        />
      )}

      {/* Tap-to-Focus Indicator */}
      {focusPoint && !previewB64 && (
        <div
          className="absolute z-30 w-14 h-14 -ml-7 -mt-7 rounded-xl border-2 border-amber-400 pointer-events-none animate-scaleUp"
          style={{ left: focusPoint.x, top: focusPoint.y }}
        />
      )}

      {/* Loading / Error State */}
      {!isReady && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-slate-900 z-10">
          <div className="w-14 h-14 bg-indigo-500/15 border border-indigo-400/20 rounded-2xl flex items-center justify-center mb-5 text-indigo-400">
            {isLoading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <Camera className="w-6 h-6" />
            )}
          </div>
          <h3 className="text-white font-semibold font-display text-lg mb-2">
            {error ? '相機無法啟動' : '正在啟動高畫質鏡頭'}
          </h3>
          <p className="text-slate-400 text-xs max-w-xs leading-relaxed">
            {error || '正在偵測後置鏡頭並啟用連續自動對焦...'}
          </p>
          <div className="mt-6 flex items-center gap-3 flex-wrap justify-center">
            {!isLoading && error && (
              <button
                type="button"
                onClick={() => startCamera(facingMode)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white py-2 px-4 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>重試連線</span>
              </button>
            )}
            {onPickFromAlbum && (
              <button
                type="button"
                onClick={() => {
                  stopTracks();
                  onClose();
                  onPickFromAlbum();
                }}
                className="bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 py-2 px-4 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ImagePlus className="w-3.5 h-3.5" />
                <span>改從相簿選取</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                stopTracks();
                onClose();
              }}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 px-4 rounded-lg font-semibold text-xs transition-colors cursor-pointer"
            >
              返回工作區
            </button>
          </div>
        </div>
      )}

      {/* Active Camera Viewfinder */}
      {isReady && !previewB64 && (
        <>
          {/* Top Bar Controls */}
          <div className="absolute top-4 inset-x-4 z-20 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {torchSupported && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  className={`h-9 px-3 rounded-xl border backdrop-blur-md flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                    torchOn
                      ? 'bg-amber-500/90 text-slate-950 border-amber-300'
                      : 'bg-slate-900/70 text-white border-white/15 hover:bg-slate-800'
                  }`}
                  title="開關補光燈"
                >
                  {torchOn ? <Zap className="w-3.5 h-3.5" /> : <ZapOff className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{torchOn ? '補光開' : '補光'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleSwitchCamera}
                className="h-9 px-3 bg-slate-900/70 text-white rounded-xl border border-white/15 flex items-center gap-1.5 text-xs font-semibold backdrop-blur-md transition-colors hover:bg-slate-800 cursor-pointer"
                title="切換前後鏡頭"
              >
                <SwitchCamera className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">切換鏡頭</span>
              </button>

              {allowBurstMode && (
                <button
                  type="button"
                  onClick={() => setBurstMode((b) => !b)}
                  className={`h-9 px-3 rounded-xl border backdrop-blur-md flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                    burstMode
                      ? 'bg-indigo-600 text-white border-indigo-400'
                      : 'bg-slate-900/70 text-slate-200 border-white/15 hover:bg-slate-800'
                  }`}
                  title="開啟連拍模式：拍完不關閉相機，自動送入背景辨識"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>{burstMode ? '連拍模式：開' : '單張模式'}</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                stopTracks();
                onClose();
              }}
              className="w-9 h-9 bg-slate-900/70 text-white rounded-xl border border-white/15 flex items-center justify-center backdrop-blur-md transition-colors hover:bg-slate-800 cursor-pointer"
              aria-label="關閉相機"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Framing Guide with Animated Scan Line */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-[86%] max-w-md aspect-[1.586/1] border border-white/50 rounded-2xl relative overflow-hidden z-10 shadow-[0_0_0_9999px_rgba(2,6,23,0.58)]">
              <div className="absolute top-0 left-0 w-6 h-6 border-t-[3px] border-l-[3px] border-indigo-400 rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-[3px] border-r-[3px] border-indigo-400 rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-[3px] border-l-[3px] border-indigo-400 rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-[3px] border-r-[3px] border-indigo-400 rounded-br-lg" />
              {/* Gentle animated scanning beam */}
              <div className="absolute inset-x-3 h-[2px] bg-gradient-to-r from-transparent via-indigo-400/90 to-transparent shadow-[0_0_12px_rgba(129,140,248,0.85)] animate-scanLine" />
            </div>

            <div className="absolute bottom-32 bg-slate-900/80 backdrop-blur-md px-3.5 py-1.5 rounded-full text-white text-xs font-medium border border-white/15">
              {burstMode
                ? `展會連拍模式 · 已送出 ${burstShots.length} 張至背景辨識`
                : modeLabel}
            </div>
          </div>

          {/* Detected vCard / MeCard QR Instant Import Banner */}
          {detectedQrContact && onScanVCard && (
            <div className="absolute top-16 inset-x-4 max-w-md mx-auto z-30 animate-fadeIn">
              <div className="bg-emerald-600/95 backdrop-blur-md text-white rounded-2xl px-4 py-3 shadow-2xl border border-emerald-400/50 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <QrCode className="w-5 h-5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">
                      偵測到電子名片 QR：{`${detectedQrContact.lastName || ''}${detectedQrContact.firstName || ''}`.trim() || detectedQrContact.company}
                    </div>
                    <div className="text-[11px] text-emerald-100 truncate">
                      {detectedQrContact.company || detectedQrContact.email || '免 AI 秒速建檔'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const contact = detectedQrContact;
                    setDetectedQrContact(null);
                    stopTracks();
                    onScanVCard(contact);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white text-emerald-700 font-bold text-xs shrink-0 hover:bg-emerald-50 cursor-pointer"
                >
                  立即匯入
                </button>
              </div>
            </div>
          )}

          {/* Bottom Shutter Bar */}
          <div className="absolute bottom-7 inset-x-6 flex items-center justify-between max-w-md mx-auto z-20">
            {/* Left Slot: Album Picker or Burst Thumbnail Counter */}
            <div className="w-24 flex items-center justify-start">
              {burstShots.length > 0 ? (
                <div className="relative w-12 h-8 rounded-md overflow-hidden border-2 border-indigo-400 shadow-lg bg-slate-900">
                  <img
                    src={burstShots[burstShots.length - 1]}
                    alt="最新連拍"
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute inset-0 bg-slate-950/45 text-white text-xs font-bold flex items-center justify-center tabular-nums">
                    +{burstShots.length}
                  </span>
                </div>
              ) : onPickFromAlbum ? (
                <button
                  type="button"
                  onClick={() => {
                    stopTracks();
                    onClose();
                    onPickFromAlbum();
                  }}
                  className="h-10 px-3 rounded-xl bg-slate-900/75 hover:bg-slate-800 text-slate-200 border border-white/15 text-xs font-semibold flex items-center gap-1.5 backdrop-blur-md cursor-pointer"
                >
                  <ImagePlus className="w-4 h-4" />
                  <span>相簿</span>
                </button>
              ) : null}
            </div>

            {/* Center Shutter Button */}
            <button
              type="button"
              onClick={capture}
              className="w-16 h-16 rounded-full border-4 border-white p-1 active:scale-95 transition-transform shadow-xl cursor-pointer"
              aria-label="拍攝名片"
              title="拍攝名片 (空白鍵)"
            >
              <div className="w-full h-full rounded-full bg-white hover:bg-indigo-50 transition-colors" />
            </button>

            {/* Right Slot: Done button in burst mode */}
            <div className="w-24 flex items-center justify-end">
              {burstShots.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    stopTracks();
                    onClose();
                  }}
                  className="h-10 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1 shadow-lg cursor-pointer whitespace-nowrap"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>完成 ({burstShots.length})</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Single-Shot Confirmation Preview */}
      {previewB64 && (
        <div className="absolute inset-0 z-30 bg-slate-950 flex flex-col">
          <div className="px-5 py-4 flex items-center justify-between border-b border-white/10">
            <span className="text-sm font-bold text-white">確認拍攝清晰度</span>
            <button
              type="button"
              onClick={() => setPreviewB64(null)}
              className="text-xs font-semibold text-slate-300 hover:text-white cursor-pointer"
            >
              返回鏡頭
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center p-6 overflow-hidden">
            <img
              src={`data:image/jpeg;base64,${previewB64}`}
              alt="拍攝預覽"
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl ring-1 ring-white/15"
            />
          </div>
          <div className="px-6 py-5 pb-safe bg-slate-900/90 border-t border-white/10 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setPreviewB64(null)}
              className="flex-1 max-w-[180px] py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>重新拍攝</span>
            </button>
            <button
              type="button"
              onClick={handleConfirmPreview}
              className="flex-1 max-w-[220px] py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-lg"
            >
              <Check className="w-4 h-4" />
              <span>清晰無誤，開始辨識</span>
            </button>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default CameraScanner;
