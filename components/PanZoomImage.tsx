import React, { useState, useRef, useEffect } from 'react';

const PanZoomImage = ({
  src,
  rotation = 0,
  onRotate
}: {
  src: string;
  rotation?: number;
  onRotate?: (deg: number) => void;
}) => {
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0, rotation });
  const [isDragging, setIsDragging] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    setTransform(prev => ({ ...prev, rotation }));
  }, [rotation]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const scaleChange = -e.deltaY * 0.001;
    setTransform(prev => ({
      ...prev,
      scale: Math.min(Math.max(0.5, prev.scale + scaleChange), 5)
    }));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    setTransform(prev => ({
      ...prev,
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    }));
  };

  const handleMouseUp = () => setIsDragging(false);

  const rotate = (deg: number) => {
    const newRotation = transform.rotation + deg;
    setTransform(prev => ({ ...prev, rotation: newRotation }));
    if (onRotate) onRotate(newRotation);
  };

  const resetView = () => {
    setTransform({ scale: 1, x: 0, y: 0, rotation: 0 });
    if (onRotate) onRotate(0);
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
      {/* Subtle Ambient Backdrop */}
      <div
        className="absolute inset-0 z-0 opacity-25 blur-3xl scale-125 bg-cover bg-center pointer-events-none"
        style={{ backgroundImage: `url(${src})` }}
      />

      {/* Image Canvas */}
      <div className="w-full h-full flex items-center justify-center relative z-10 p-4">
        <div
          className={`flex items-center justify-center ${isDragging ? '' : 'transition-transform duration-200 ease-out'}`}
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale}) rotate(${transform.rotation}deg)`,
            width: isRotated ? containerSize.height : '100%',
            height: isRotated ? containerSize.width : '100%',
            maxWidth: isRotated ? containerSize.height * 0.92 : '92%',
            maxHeight: isRotated ? containerSize.width * 0.92 : '92%'
          }}
        >
          <img
            src={src}
            alt="名片影像"
            className="max-w-full max-h-full object-contain shadow-2xl rounded-lg ring-1 ring-white/15"
            draggable={false}
          />
        </div>
      </div>

      {/* Floating Bottom Glass Control Pill */}
      <div
        className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 px-2 py-1.5 rounded-xl bg-slate-900/80 border border-white/15 backdrop-blur-md shadow-lg text-white"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setTransform(t => ({ ...t, scale: Math.max(0.5, +(t.scale - 0.2).toFixed(2)) }))}
          className="w-7 h-7 rounded-lg hover:bg-white/15 flex items-center justify-center transition-colors cursor-pointer"
          title="縮小"
        >
          <i className="fa-solid fa-minus text-[11px]"></i>
        </button>
        <span className="text-[11px] font-semibold tabular-nums px-1.5 text-slate-200 min-w-[42px] text-center">
          {Math.round(transform.scale * 100)}%
        </span>
        <button
          type="button"
          onClick={() => setTransform(t => ({ ...t, scale: Math.min(5, +(t.scale + 0.2).toFixed(2)) }))}
          className="w-7 h-7 rounded-lg hover:bg-white/15 flex items-center justify-center transition-colors cursor-pointer"
          title="放大"
        >
          <i className="fa-solid fa-plus text-[11px]"></i>
        </button>
        <div className="w-px h-4 bg-white/15 mx-0.5" />
        <button
          type="button"
          onClick={() => rotate(-90)}
          className="w-7 h-7 rounded-lg hover:bg-white/15 flex items-center justify-center transition-colors cursor-pointer"
          title="向左旋轉 90°"
        >
          <i className="fa-solid fa-rotate-left text-[11px]"></i>
        </button>
        <button
          type="button"
          onClick={() => rotate(90)}
          className="w-7 h-7 rounded-lg hover:bg-white/15 flex items-center justify-center transition-colors cursor-pointer"
          title="向右旋轉 90°"
        >
          <i className="fa-solid fa-rotate-right text-[11px]"></i>
        </button>
        <div className="w-px h-4 bg-white/15 mx-0.5" />
        <button
          type="button"
          onClick={resetView}
          className="px-2 h-7 rounded-lg hover:bg-white/15 flex items-center justify-center text-[11px] font-medium text-slate-200 transition-colors cursor-pointer"
          title="重設縮放與旋轉"
        >
          重設
        </button>
      </div>
    </div>
  );
};

export default PanZoomImage;
