import React, { useState, useRef } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RotateCw,
  Loader2,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  ScanLine,
  MousePointerClick,
} from 'lucide-react';

export interface CropRegion {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface CropperWorkspaceProps {
  cropperImage: string;
  cropRegions: CropRegion[];
  setCropRegions: React.Dispatch<React.SetStateAction<CropRegion[]>>;
  isAiDetecting: boolean;
  isRenderingPdf: boolean;
  pdfPageCount?: number;
  currentPdfPage?: number;
  onChangePdfPage?: (nextPage: number) => void;
  onRotateImage: (direction: 'left' | 'right') => void;
  onCancel: () => void;
  onConfirmCrops: (imgElement: HTMLImageElement | null) => void;
}

export const CropperWorkspace: React.FC<CropperWorkspaceProps> = ({
  cropperImage,
  cropRegions,
  setCropRegions,
  isAiDetecting,
  isRenderingPdf,
  pdfPageCount = 0,
  currentPdfPage = 1,
  onChangePdfPage,
  onRotateImage,
  onCancel,
  onConfirmCrops,
}) => {
  const cropperImgRef = useRef<HTMLImageElement>(null);
  const [cropperTransform, setCropperTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [isCropperPanning, setIsCropperPanning] = useState(false);
  const cropperDragStart = useRef({ x: 0, y: 0 });

  const [isDrawing, setIsDrawing] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [activeCropId, setActiveCropId] = useState<string | null>(null);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [initialRect, setInitialRect] = useState<CropRegion | null>(null);
  const [currentRect, setCurrentRect] = useState<CropRegion | null>(null);

  const getMousePos = (e: React.MouseEvent | React.TouchEvent) => {
    if (!cropperImgRef.current) return { x: 0, y: 0 };
    const rect = cropperImgRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    };
  };

  const handleCropStart = (
    e: React.MouseEvent | React.TouchEvent,
    action: 'draw' | 'move' | 'resize' = 'draw',
    cropId?: string,
    handle?: string
  ) => {
    e.stopPropagation();
    const pos = getMousePos(e);
    setStartPos(pos);
    if (action === 'draw') {
      setCurrentRect({ id: 'temp', x: pos.x, y: pos.y, w: 0, h: 0 });
      setIsDrawing(true);
      setActiveCropId(null);
    } else if (action === 'move' && cropId) {
      const crop = cropRegions.find((r) => r.id === cropId);
      if (crop) {
        setInitialRect({ ...crop });
        setIsMoving(true);
        setActiveCropId(cropId);
      }
    } else if (action === 'resize' && cropId && handle) {
      const crop = cropRegions.find((r) => r.id === cropId);
      if (crop) {
        setInitialRect({ ...crop });
        setIsResizing(handle);
        setActiveCropId(cropId);
      }
    }
  };

  const handleCropMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing && !isMoving && !isResizing) return;
    const pos = getMousePos(e);
    if (isDrawing && currentRect) {
      setCurrentRect({
        ...currentRect,
        x: Math.min(pos.x, startPos.x),
        y: Math.min(pos.y, startPos.y),
        w: Math.abs(pos.x - startPos.x),
        h: Math.abs(pos.y - startPos.y),
      });
    } else if (isMoving && activeCropId && initialRect) {
      setCropRegions((prev) =>
        prev.map((r) =>
          r.id === activeCropId
            ? {
                ...r,
                x: Math.max(0, Math.min(100 - r.w, initialRect.x + (pos.x - startPos.x))),
                y: Math.max(0, Math.min(100 - r.h, initialRect.y + (pos.y - startPos.y))),
              }
            : r
        )
      );
    } else if (isResizing && activeCropId && initialRect) {
      const dx = pos.x - startPos.x;
      const dy = pos.y - startPos.y;
      setCropRegions((prev) =>
        prev.map((r) => {
          if (r.id !== activeCropId) return r;
          let { x, y, w, h } = initialRect;
          if (isResizing.includes('t')) {
            const newY = Math.max(0, y + dy);
            h = h + (y - newY);
            y = newY;
          }
          if (isResizing.includes('b')) {
            h = Math.max(1, Math.min(100 - y, h + dy));
          }
          if (isResizing.includes('l')) {
            const newX = Math.max(0, x + dx);
            w = w + (x - newX);
            x = newX;
          }
          if (isResizing.includes('r')) {
            w = Math.max(1, Math.min(100 - x, w + dx));
          }
          return { ...r, x, y, w, h };
        })
      );
    }
  };

  const handleCropEnd = () => {
    if (isDrawing && currentRect && currentRect.w > 2 && currentRect.h > 2) {
      const newCrop = { ...currentRect, id: crypto.randomUUID() };
      setCropRegions((prev) => [...prev, newCrop]);
      setActiveCropId(newCrop.id);
    }
    setIsDrawing(false);
    setIsMoving(false);
    setIsResizing(null);
    setCurrentRect(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const scaleChange = -e.deltaY * 0.001;
    setCropperTransform((prev) => ({
      ...prev,
      scale: Math.min(Math.max(0.5, prev.scale + scaleChange), 5),
    }));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.crop-box') || isDrawing || isMoving || isResizing) return;
    setIsCropperPanning(true);
    cropperDragStart.current = {
      x: e.clientX - cropperTransform.x,
      y: e.clientY - cropperTransform.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    let clientX: number;
    let clientY: number;

    if ('touches' in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    if (isCropperPanning) {
      if (e.cancelable) e.preventDefault();
      setCropperTransform((prev) => ({
        ...prev,
        x: clientX - cropperDragStart.current.x,
        y: clientY - cropperDragStart.current.y,
      }));
      return;
    }
    handleCropMove(e);
  };

  const handleMouseUp = () => {
    setIsCropperPanning(false);
    handleCropEnd();
  };

  return (
    <div
      className="absolute inset-0 z-40 bg-slate-100 flex flex-col"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchMove={handleMouseMove}
      onTouchEnd={handleMouseUp}
    >
      {/* Toolbar */}
      <div className="h-14 bg-white border-b border-slate-200 px-4 lg:px-6 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 font-semibold font-display text-slate-900 text-sm whitespace-nowrap">
            <ScanLine className="w-4 h-4 text-indigo-600" />
            <span className="tabular-nums">智慧多張名片裁切 ({cropRegions.length})</span>
          </div>

          {isAiDetecting ? (
            <span className="text-xs text-indigo-600 font-medium flex items-center gap-1.5 whitespace-nowrap">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>正在偵測名片邊界...</span>
            </span>
          ) : cropRegions.length === 0 ? (
            <span className="text-xs text-amber-700 hidden sm:inline-flex items-center gap-1.5 truncate">
              <MousePointerClick className="w-3.5 h-3.5 shrink-0" />
              <span>請在影像上拖曳滑鼠框選名片範圍</span>
            </span>
          ) : null}

          {/* Multi-page PDF Navigation */}
          {pdfPageCount > 1 && onChangePdfPage && (
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 border border-slate-200 ml-2">
              <button
                type="button"
                disabled={currentPdfPage <= 1 || isRenderingPdf}
                onClick={() => onChangePdfPage(currentPdfPage - 1)}
                className="w-7 h-7 flex items-center justify-center rounded-md text-slate-600 hover:bg-white disabled:opacity-40 cursor-pointer"
                title="上一頁 PDF"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 text-xs font-semibold text-slate-700 tabular-nums whitespace-nowrap">
                第 {currentPdfPage} / {pdfPageCount} 頁
              </span>
              <button
                type="button"
                disabled={currentPdfPage >= pdfPageCount || isRenderingPdf}
                onClick={() => onChangePdfPage(currentPdfPage + 1)}
                className="w-7 h-7 flex items-center justify-center rounded-md text-slate-600 hover:bg-white disabled:opacity-40 cursor-pointer"
                title="下一頁 PDF"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Zoom Controls */}
          <div className="hidden md:flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
            <button
              type="button"
              onClick={() =>
                setCropperTransform((t) => ({ ...t, scale: Math.max(0.5, t.scale - 0.2) }))
              }
              className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-white rounded-md cursor-pointer"
              title="縮小"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setCropperTransform({ scale: 1, x: 0, y: 0 })}
              className="px-2 h-7 text-slate-700 hover:bg-white rounded-md text-xs font-semibold tabular-nums cursor-pointer"
              title="重置縮放"
            >
              {Math.round(cropperTransform.scale * 100)}%
            </button>
            <button
              type="button"
              onClick={() =>
                setCropperTransform((t) => ({ ...t, scale: Math.min(5, t.scale + 0.2) }))
              }
              className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-white rounded-md cursor-pointer"
              title="放大"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Rotate Controls */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
            <button
              type="button"
              onClick={() => {
                setCropperTransform({ scale: 1, x: 0, y: 0 });
                onRotateImage('left');
              }}
              className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-white rounded-md cursor-pointer"
              title="向左旋轉並重新偵測"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-4 bg-slate-200 mx-0.5" />
            <button
              type="button"
              onClick={() => {
                setCropperTransform({ scale: 1, x: 0, y: 0 });
                onRotateImage('right');
              }}
              className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-white rounded-md cursor-pointer"
              title="向右旋轉並重新偵測"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => onConfirmCrops(cropperImgRef.current)}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Check className="w-3.5 h-3.5" />
            <span>確認裁切匯入</span>
          </button>
        </div>
      </div>

      {/* Canvas Viewport */}
      <div
        className="flex-1 overflow-hidden relative bg-slate-200/70 select-none cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
      >
        <div
          className="w-full h-full flex items-center justify-center transform-gpu"
          style={{
            transform: `translate(${cropperTransform.x}px, ${cropperTransform.y}px) scale(${cropperTransform.scale})`,
            transition: isCropperPanning ? 'none' : 'transform 0.1s ease-out',
          }}
        >
          <div className="relative shadow-2xl bg-white">
            {isRenderingPdf && (
              <div className="absolute inset-0 bg-white/80 z-50 flex items-center justify-center">
                <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
              </div>
            )}

            {isAiDetecting && (
              <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden bg-indigo-500/5">
                <div className="absolute bottom-3 right-3 bg-white/95 border border-slate-200 px-3 py-1.5 rounded-lg shadow-md text-xs font-semibold text-indigo-700 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>正在自動定位名片區塊...</span>
                </div>
              </div>
            )}

            <img
              ref={cropperImgRef}
              src={cropperImage}
              alt="待裁切影像"
              className="block pointer-events-none"
              style={{ maxWidth: '85vw', maxHeight: '78vh', objectFit: 'contain' }}
              draggable={false}
            />

            <div
              className="absolute inset-0 z-10 crop-draw-layer cursor-crosshair"
              onMouseDown={(e) => handleCropStart(e, 'draw')}
            />

            {cropRegions.map((crop, idx) => (
              <div
                key={crop.id}
                className={`crop-box absolute z-20 transition-colors ${
                  activeCropId === crop.id
                    ? 'cursor-move'
                    : 'cursor-pointer border-2 border-emerald-500 bg-emerald-500/10'
                }`}
                style={{
                  left: `${crop.x}%`,
                  top: `${crop.y}%`,
                  width: `${crop.w}%`,
                  height: `${crop.h}%`,
                  boxShadow:
                    activeCropId === crop.id ? '0 0 0 9999px rgba(15, 23, 42, 0.45)' : 'none',
                  zIndex: activeCropId === crop.id ? 30 : 20,
                }}
                onMouseDown={(e) => handleCropStart(e, 'move', crop.id)}
              >
                {activeCropId === crop.id && (
                  <div className="absolute inset-0 border-2 border-indigo-500">
                    <div
                      className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-indigo-600 border border-white cursor-nw-resize rounded-full"
                      onMouseDown={(e) => handleCropStart(e, 'resize', crop.id, 'tl')}
                    />
                    <div
                      className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-indigo-600 border border-white cursor-ne-resize rounded-full"
                      onMouseDown={(e) => handleCropStart(e, 'resize', crop.id, 'tr')}
                    />
                    <div
                      className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-indigo-600 border border-white cursor-sw-resize rounded-full"
                      onMouseDown={(e) => handleCropStart(e, 'resize', crop.id, 'bl')}
                    />
                    <div
                      className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-indigo-600 border border-white cursor-se-resize rounded-full"
                      onMouseDown={(e) => handleCropStart(e, 'resize', crop.id, 'br')}
                    />
                  </div>
                )}

                <div
                  className={`absolute top-0 left-0 text-white text-[10px] px-1.5 py-0.5 font-mono font-semibold tabular-nums ${
                    activeCropId === crop.id ? 'bg-indigo-600' : 'bg-emerald-600'
                  }`}
                >
                  #{idx + 1}
                </div>
                <button
                  type="button"
                  className="absolute -top-2.5 -right-2.5 w-5 h-5 bg-rose-600 text-white rounded-full flex items-center justify-center shadow hover:bg-rose-700 z-50 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCropRegions((p) => p.filter((r) => r.id !== crop.id));
                  }}
                  aria-label="移除裁切框"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}

            {isDrawing && currentRect && (
              <div
                className="absolute border-2 border-dashed border-indigo-500 z-40 pointer-events-none"
                style={{
                  left: `${currentRect.x}%`,
                  top: `${currentRect.y}%`,
                  width: `${currentRect.w}%`,
                  height: `${currentRect.h}%`,
                  boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.45)',
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
