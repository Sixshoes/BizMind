import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, RotateCw, Maximize2 } from 'lucide-react';

interface PanZoomImageProps {
  src: string;
  rotation?: number;
  onRotate?: (deg: number) => void;
  topLeftOverlay?: React.ReactNode;
  bottomOverlay?: React.ReactNode;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 5;

const PanZoomImage: React.FC<PanZoomImageProps> = ({
  src,
  rotation = 0,
  onRotate,
  topLeftOverlay,
  bottomOverlay,
}) => {
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0, rotation });
  const [isDragging, setIsDragging] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef({ x: 0, y: 0 });
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);
  const lastTapTime = useRef<number>(0);

  useEffect(() => {
    setTransform({ rotation, scale: 1, x: 0, y: 0 });
  }, [src]);

  useEffect(() => {
    setTransform((prev) => ({ ...prev, rotation }));
  }, [rotation]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

  // Zoom around pointer position for natural desktop inspection
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    const factor = -e.deltaY * 0.0014;
    setTransform((prev) => {
      const nextScale = clampScale(prev.scale * (1 + factor));
      if (!rect || nextScale === prev.scale) {
        return { ...prev, scale: nextScale };
      }
      const cx = e.clientX - rect.left - rect.width / 2;
      const cy = e.clientY - rect.top - rect.height / 2;
      const ratio = nextScale / prev.scale;
      return {
        ...prev,
        scale: nextScale,
        x: cx - (cx - prev.x) * ratio,
        y: cy - (cy - prev.y) * ratio,
      };
    });
  };

  const toggleQuickZoom = useCallback((clientX?: number, clientY?: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    setTransform((prev) => {
      if (prev.scale > 1.15) {
        return { ...prev, scale: 1, x: 0, y: 0 };
      }
      const targetScale = 2.2;
      if (rect && clientX !== undefined && clientY !== undefined) {
        const cx = clientX - rect.left - rect.width / 2;
        const cy = clientY - rect.top - rect.height / 2;
        return {
          ...prev,
          scale: targetScale,
          x: -cx * (targetScale - 1) * 0.5,
          y: -cy * (targetScale - 1) * 0.5,
        };
      }
      return { ...prev, scale: targetScale, x: 0, y: 0 };
    });
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('label')) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    setTransform((prev) => ({
      ...prev,
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    }));
  };

  const handleMouseUp = () => setIsDragging(false);

  // Touch support: single-finger pan, two-finger pinch-to-zoom, double-tap zoom
  const getTouchDist = (t1: React.Touch, t2: React.Touch) =>
    Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('label')) return;

    if (e.touches.length === 2) {
      pinchStart.current = {
        dist: getTouchDist(e.touches[0], e.touches[1]),
        scale: transform.scale,
      };
      setIsDragging(true);
    } else if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTapTime.current < 280) {
        toggleQuickZoom(e.touches[0].clientX, e.touches[0].clientY);
        lastTapTime.current = 0;
        return;
      }
      lastTapTime.current = now;
      pinchStart.current = null;
      setIsDragging(true);
      dragStart.current = {
        x: e.touches[0].clientX - transform.x,
        y: e.touches[0].clientY - transform.y,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStart.current) {
      if (e.cancelable) e.preventDefault();
      const dist = getTouchDist(e.touches[0], e.touches[1]);
      const nextScale = clampScale(pinchStart.current.scale * (dist / pinchStart.current.dist));
      setTransform((prev) => ({ ...prev, scale: nextScale }));
    } else if (e.touches.length === 1 && isDragging && !pinchStart.current) {
      if (e.cancelable) e.preventDefault();
      setTransform((prev) => ({
        ...prev,
        x: e.touches[0].clientX - dragStart.current.x,
        y: e.touches[0].clientY - dragStart.current.y,
      }));
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      pinchStart.current = null;
    }
    if (e.touches.length === 0) {
      setIsDragging(false);
    } else if (e.touches.length === 1) {
      dragStart.current = {
        x: e.touches[0].clientX - transform.x,
        y: e.touches[0].clientY - transform.y,
      };
    }
  };

  const rotate = (deg: number) => {
    const newRotation = transform.rotation + deg;
    setTransform((prev) => ({ ...prev, rotation: newRotation }));
    onRotate?.(newRotation);
  };

  const isRotated = Math.abs(transform.rotation % 180) === 90;

  return (
    <div
      className="w-full h-full relative overflow-hidden bg-slate-900 cursor-grab active:cursor-grabbing select-none touch-none"
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest('button')) return;
        toggleQuickZoom(e.clientX, e.clientY);
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Subtle Ambient Background */}
      <div
        className="absolute inset-0 z-0 opacity-25 blur-2xl scale-110 bg-cover bg-center pointer-events-none"
        style={{ backgroundImage: `url(${src})` }}
      />

      {topLeftOverlay && (
        <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5">{topLeftOverlay}</div>
      )}

      {/* Right Control Rail */}
      <div className="absolute top-3 right-3 z-20 flex flex-col gap-1 bg-slate-950/75 backdrop-blur-md p-1 rounded-xl border border-white/10 shadow-lg">
        <button
          type="button"
          onClick={() => setTransform((t) => ({ ...t, scale: clampScale(t.scale + 0.35) }))}
          className="w-7 h-7 text-slate-200 hover:text-white hover:bg-white/15 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
          title="放大"
          aria-label="放大"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setTransform((t) => ({ ...t, scale: clampScale(t.scale - 0.35) }))}
          className="w-7 h-7 text-slate-200 hover:text-white hover:bg-white/15 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
          title="縮小"
          aria-label="縮小"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <div className="h-px bg-white/15 mx-1" />
        <button
          type="button"
          onClick={() => rotate(-90)}
          className="w-7 h-7 text-slate-200 hover:text-white hover:bg-white/15 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
          title="向左旋轉 90°"
          aria-label="向左旋轉 90 度"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => rotate(90)}
          className="w-7 h-7 text-slate-200 hover:text-white hover:bg-white/15 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
          title="向右旋轉 90°"
          aria-label="向右旋轉 90 度"
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>
        <div className="h-px bg-white/15 mx-1" />
        <button
          type="button"
          onClick={() => {
            setTransform({ scale: 1, x: 0, y: 0, rotation: 0 });
            onRotate?.(0);
          }}
          className="w-7 h-7 text-indigo-300 hover:text-white hover:bg-indigo-600/80 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
          title="重置視角與旋轉"
          aria-label="重置視角與旋轉"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Live Zoom Indicator Pill (shown when zoomed) */}
      {Math.abs(transform.scale - 1) > 0.04 && (
        <button
          type="button"
          onClick={() => setTransform((t) => ({ ...t, scale: 1, x: 0, y: 0 }))}
          className="absolute bottom-3 right-3 z-20 px-2 py-0.5 rounded-md bg-slate-950/75 hover:bg-slate-900 backdrop-blur-md text-[11px] font-mono font-semibold text-slate-200 border border-white/15 tabular-nums cursor-pointer transition-colors"
          title="點擊重置為 100%"
        >
          {Math.round(transform.scale * 100)}%
        </button>
      )}

      <div className="w-full h-full flex items-center justify-center relative z-10 p-4">
        <div
          className={`flex items-center justify-center ${
            isDragging ? '' : 'transition-transform duration-150 ease-out'
          }`}
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale}) rotate(${transform.rotation}deg)`,
            width: isRotated ? containerSize.height : '100%',
            height: isRotated ? containerSize.width : '100%',
            maxWidth: isRotated ? containerSize.height * 0.88 : '92%',
            maxHeight: isRotated ? containerSize.width * 0.88 : '92%',
          }}
        >
          <img
            src={src}
            alt="名片影像"
            referrerPolicy="no-referrer"
            className="max-w-full max-h-full object-contain shadow-2xl rounded-lg ring-1 ring-white/15"
            draggable={false}
          />
        </div>
      </div>

      {bottomOverlay && (
        <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto">{bottomOverlay}</div>
        </div>
      )}
    </div>
  );
};

export default PanZoomImage;
