import React, { useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, RotateCw, Maximize2 } from 'lucide-react';

interface PanZoomImageProps {
  src: string;
  rotation?: number;
  onRotate?: (deg: number) => void;
  topLeftOverlay?: React.ReactNode;
  bottomOverlay?: React.ReactNode;
}

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

  useEffect(() => {
    setTransform((prev) => ({ ...prev, rotation, scale: 1, x: 0, y: 0 }));
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

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const scaleChange = -e.deltaY * 0.001;
    setTransform((prev) => ({
      ...prev,
      scale: Math.min(Math.max(0.5, prev.scale + scaleChange), 5),
    }));
  };

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

  const rotate = (deg: number) => {
    const newRotation = transform.rotation + deg;
    setTransform((prev) => ({ ...prev, rotation: newRotation }));
    onRotate?.(newRotation);
  };

  const isRotated = Math.abs(transform.rotation % 180) === 90;

  return (
    <div
      className="w-full h-full relative overflow-hidden bg-slate-900 cursor-grab active:cursor-grabbing select-none"
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
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
      <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5 bg-slate-900/75 backdrop-blur-md p-1 rounded-lg border border-white/10">
        <button
          type="button"
          onClick={() => setTransform((t) => ({ ...t, scale: Math.min(5, t.scale + 0.25) }))}
          className="w-7 h-7 text-slate-200 hover:text-white hover:bg-white/15 rounded flex items-center justify-center transition-colors cursor-pointer"
          title="放大"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setTransform((t) => ({ ...t, scale: Math.max(0.5, t.scale - 0.25) }))}
          className="w-7 h-7 text-slate-200 hover:text-white hover:bg-white/15 rounded flex items-center justify-center transition-colors cursor-pointer"
          title="縮小"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <div className="h-px bg-white/15 mx-1" />
        <button
          type="button"
          onClick={() => rotate(-90)}
          className="w-7 h-7 text-slate-200 hover:text-white hover:bg-white/15 rounded flex items-center justify-center transition-colors cursor-pointer"
          title="向左旋轉 90°"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => rotate(90)}
          className="w-7 h-7 text-slate-200 hover:text-white hover:bg-white/15 rounded flex items-center justify-center transition-colors cursor-pointer"
          title="向右旋轉 90°"
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
          className="w-7 h-7 text-indigo-300 hover:text-white hover:bg-indigo-600/80 rounded flex items-center justify-center transition-colors cursor-pointer"
          title="重置視角與旋轉"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="w-full h-full flex items-center justify-center relative z-10 p-4">
        <div
          className="flex items-center justify-center transition-transform duration-200 ease-out"
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
