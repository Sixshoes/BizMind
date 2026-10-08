
import React, { useRef, useState, useEffect } from 'react';

interface CameraScannerProps {
  onCapture: (base64: string) => void;
  onClose: () => void;
  isMobile?: boolean;
}

const CameraScanner: React.FC<CameraScannerProps> = ({ onCapture, onClose, isMobile = false }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const stopTracks = () => {
    if (stream) {
      stream.getTracks().forEach(track => {
        try { track.stop(); } catch (e) {}
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
      
      // Strategy 1: Ideal 1080p Environment (Great for modern phones)
      try {
        mediaStream = await getStream({
            video: { 
                facingMode: "environment", 
                width: { ideal: 1920 }, 
                height: { ideal: 1080 } 
            }, 
            audio: false 
        });
      } catch (e) {
        console.warn("Strategy 1 failed", e);
      }

      // Strategy 2: Any Environment Camera (Most common fallback)
      if (!mediaStream) {
        try {
            mediaStream = await getStream({
                video: { facingMode: "environment" },
                audio: false
            });
        } catch (e) {
            console.warn("Strategy 2 failed", e);
        }
      }

      // Strategy 3: Any Video Source (Last resort for desktop/old devices)
      if (!mediaStream) {
         try {
            mediaStream = await getStream({ video: true, audio: false });
         } catch(e) {
            console.warn("Strategy 3 failed.", e);
            throw e;
         }
      }

      if (!mediaStream) throw new Error("No media stream obtained");

      setStream(mediaStream);

      // Try continuous autofocus
      const track = mediaStream.getVideoTracks()[0];
      try {
        const capabilities = (track.getCapabilities && track.getCapabilities()) || {};
        // @ts-ignore
        if (capabilities.focusMode && Array.isArray(capabilities.focusMode) && capabilities.focusMode.includes('continuous')) {
           await track.applyConstraints({ advanced: [{ focusMode: "continuous" }] as any });
        }
      } catch(e) { console.warn("Autofocus failed", e); }

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        // Robust play handling
        videoRef.current.onloadedmetadata = async () => {
          try {
            await videoRef.current?.play();
            setIsReady(true);
          } catch (e) {
            console.error("Play error:", e);
            setError("無法啟動視訊預覽");
          } finally {
            setIsLoading(false);
          }
        };
      }
    } catch (err: any) {
      setIsLoading(false);
      console.error(err);
      
      let msg = "無法啟動相機。";
      if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          msg = "找不到相機裝置。";
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          msg = "相機權限被拒絕，請至瀏覽器設定允許存取。";
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          msg = "相機可能正被其他程式使用中。";
      } else {
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
      
      // Memory Optimization: Limit capture resolution to max 1920px width/height
      // This prevents "Functionality Abnormal" (Crashes) on mobile devices due to OOM with 48MP cameras.
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
            console.error("Capture failed", e);
            alert("拍照失敗 (記憶體不足)，請嘗試重整頁面。");
        }
      }
    }
  };

  // Determine container classes based on mobile state
  const containerClass = isMobile 
    ? "h-full w-full bg-black relative overflow-hidden" 
    : "flex flex-col items-center justify-center h-full bg-black rounded-[2rem] overflow-hidden relative shadow-2xl border border-slate-800 min-h-[500px]";

  return (
    <div className={containerClass}>
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted 
        className={`h-full w-full object-cover transition-opacity duration-500 ${isReady ? 'opacity-100' : 'opacity-0'}`} 
      />

      {!isReady && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-10 text-center bg-slate-900 z-10">
          <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center mb-6 animate-pulse">
             {isLoading ? <i className="fa-solid fa-spinner fa-spin text-2xl text-indigo-400"></i> : <i className="fa-solid fa-camera text-2xl text-indigo-400"></i>}
          </div>
          <h3 className="text-white font-bold text-xl mb-2">相機啟動中</h3>
          <p className="text-slate-400 text-xs px-4">{error || "正在搜尋可用相機..."}</p>
          {!isLoading && error && <button onClick={startCamera} className="mt-6 bg-white text-slate-900 py-2 px-6 rounded-full font-bold text-sm">重試</button>}
        </div>
      )}

      {isReady && (
        <>
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
             <div className="absolute inset-0 bg-black/30"></div>
             
             <div className="w-[85%] max-w-sm aspect-[1.586/1] border-2 border-white/50 rounded-xl relative overflow-hidden z-10 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-indigo-400"></div>
                <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-indigo-400"></div>
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-indigo-400"></div>
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-indigo-400"></div>
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-400 to-transparent opacity-80 animate-[scan_2s_infinite_linear]"></div>
             </div>
             
             <div className="absolute bottom-32 bg-black/50 backdrop-blur px-3 py-1 rounded-full text-white/90 text-xs font-medium border border-white/10">
                將名片置於框內
             </div>
          </div>

          <div className="absolute bottom-10 flex flex-col items-center w-full z-20">
            <button onClick={capture} className="w-18 h-18 rounded-full border-4 border-white p-1 active:scale-95 transition-transform shadow-lg cursor-pointer">
              <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full border border-slate-200 bg-white"></div>
              </div>
            </button>
          </div>

          {/* Close button positioned to respect safe area on mobile */}
          <button 
            onClick={() => { stopTracks(); onClose(); }} 
            className="absolute w-10 h-10 bg-black/50 text-white rounded-full flex items-center justify-center z-20 backdrop-blur-md transition-colors hover:bg-black/70"
            style={{ 
               top: isMobile ? 'calc(1.5rem + env(safe-area-inset-top))' : '1.5rem',
               right: isMobile ? '1.5rem' : '1.5rem'
            }}
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </>
      )}
      <canvas ref={canvasRef} className="hidden" />
      <style>{`
        @keyframes scan { 
          0% { top: 0%; opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default CameraScanner;
