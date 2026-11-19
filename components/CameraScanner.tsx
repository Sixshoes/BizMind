import React, { useRef, useState, useEffect } from 'react';
import { Camera, Loader2, X, RefreshCw } from 'lucide-react';

interface CameraScannerProps {
  onCapture: (base64: string) => void;
  onClose: () => void;
  isMobile?: boolean;
  modeLabel?: string;
}

const CameraScanner: React.FC<CameraScannerProps> = ({
  onCapture,
  onClose,
  isMobile = false,
  modeLabel = '將名片置於框內拍攝',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const stopTracks = () => {
    if (stream) {
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore track stop error
        }
      });
      setStream(null);
    }
    setIsReady(false);
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const startCamera = async () => {
    setIsLoading(true);
    setError(null);
    stopTracks();

    const getStream = async (constraints: MediaStreamConstraints) => {
      return await navigator.mediaDevices.getUserMedia(constraints);
    };

    try {
      let mediaStream: MediaStream | null = null;

      try {
        mediaStream = await getStream({
          video: {
            facingMode: 'environment',
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
            video: { facingMode: 'environment' },
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

      setStream(mediaStream);

      const track = mediaStream.getVideoTracks()[0];
      try {
        const capabilities: any = (track.getCapabilities && track.getCapabilities()) || {};
        if (
          capabilities.focusMode &&
          Array.isArray(capabilities.focusMode) &&
          capabilities.focusMode.includes('continuous')
        ) {
          await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] as any });
        }
      } catch {
        // autofocus unsupported
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
    startCamera();
    return () => stopTracks();
  }, []);

  const capture = () => {
    if (videoRef.current && canvasRef.current && isReady) {
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
      if (ctx) {
        ctx.drawImage(video, 0, 0, w, h);
        try {
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          onCapture(dataUrl.split(',')[1]);
          stopTracks();
        } catch (e) {
          console.error('Capture failed', e);
          setIsReady(false);
          setError('擷取影像失敗（裝置記憶體不足），請關閉其他分頁後重試。');
        }
      }
    }
  };

  const containerClass = isMobile
    ? 'h-full w-full bg-slate-950 relative overflow-hidden'
    : 'flex flex-col items-center justify-center h-full w-full bg-slate-950 overflow-hidden relative';

  return (
    <div className={containerClass}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`h-full w-full object-cover transition-opacity duration-300 ${
          isReady ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {!isReady && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-slate-900 z-10">
          <div className="w-14 h-14 bg-indigo-500/15 border border-indigo-400/20 rounded-xl flex items-center justify-center mb-5 text-indigo-400">
            {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Camera className="w-6 h-6" />}
          </div>
          <h3 className="text-white font-semibold font-display text-lg mb-2">
            {error ? '相機無法啟動' : '正在啟動相機'}
          </h3>
          <p className="text-slate-400 text-xs max-w-xs leading-relaxed">
            {error || '正在搜尋高畫質鏡頭並對焦...'}
          </p>
          <div className="mt-6 flex items-center gap-3">
            {!isLoading && error && (
              <button
                type="button"
                onClick={startCamera}
                className="bg-indigo-600 hover:bg-indigo-500 text-white py-2 px-4 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>重試連線</span>
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

      {isReady && (
        <>
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-[85%] max-w-md aspect-[1.586/1] border border-white/60 rounded-xl relative overflow-hidden z-10 shadow-[0_0_0_9999px_rgba(15,23,42,0.55)]">
              <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-indigo-400" />
              <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-indigo-400" />
              <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-indigo-400" />
              <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-indigo-400" />
            </div>

            <div className="absolute bottom-28 bg-slate-900/80 backdrop-blur-md px-3.5 py-1.5 rounded-lg text-white text-xs font-medium border border-white/15">
              {modeLabel}
            </div>
          </div>

          <div className="absolute bottom-8 flex flex-col items-center w-full z-20">
            <button
              type="button"
              onClick={capture}
              className="w-16 h-16 rounded-full border-4 border-white p-1 active:scale-95 transition-transform shadow-lg cursor-pointer"
              aria-label="拍攝名片"
            >
              <div className="w-full h-full rounded-full bg-white hover:bg-slate-100 transition-colors" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              stopTracks();
              onClose();
            }}
            className="absolute top-5 right-5 w-9 h-9 bg-slate-900/70 text-white rounded-lg border border-white/15 flex items-center justify-center z-20 backdrop-blur-md transition-colors hover:bg-slate-800 cursor-pointer"
            aria-label="關閉相機"
          >
            <X className="w-4 h-4" />
          </button>
        </>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default CameraScanner;
