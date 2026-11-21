import React, { useState, useRef, useEffect } from 'react';
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
  Maximize,
  Sparkles,
  Trash2,
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
  onReDetect?: () => void;
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
  onReDetect,
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

  // Keyboard shortcuts: Delete active crop box, Escape to deselect
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && activeCropId) {
        e.preventDefault();
        setCropRegions((prev) => prev.filter((r) => r.id !== activeCropId));
        setActiveCropId(null);
      } else if (e.key === 'Escape') {
        if (activeCropId) {
          e.preventDefault();
          setActiveCropId(null);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeCropId, setCropRegions]);

  const getPointerPos = (e: React.PointerEvent) => {
    if (!cropperImgRef.current) return { x: 0, y: 0 };
    const rect = cropperImgRef.current.getBoundingClientRect();
    const rawX = ((e.clientX - rect.left) / rect.width) * 100;
    const rawY = ((e.clientY - rect.top) / rect.height) * 100;
    return {
      x: Math.max(0, Math.min(100, rawX)),
      y: Math.max(0, Math.min(100, rawY)),
    };
  };

  const handleCropStart = (
    e: React.PointerEvent,
    action: 'draw' | 'move' | 'resize' = 'draw',
    cropId?: string,
    handle?: string
  ) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.stopPropagation();
    e.preventDefault();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore pointer capture issues
    }

    const pos = getPointerPos(e);
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

  const handleCropMove = (e: React.PointerEvent) => {
    if (!isDrawing && !isMoving && !isResizing) return;
    const pos = getPointerPos(e);
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
            const newY = Math.max(0, Math.min(y + h - 2, y + dy));
            h = h + (y - newY);
            y = newY;
          }
          if (isResizing.includes('b')) {
            h = Math.max(2, Math.min(100 - y, h + dy));
          }
          if (isResizing.includes('l')) {
            const newX = Math.max(0, Math.min(x + w - 2, x + dx));
            w = w + (x - newX);
            x = newX;
          }
          if (isResizing.includes('r')) {
            w = Math.max(2, Math.min(100 - x, w + dx));
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
    const scaleChange = -e.deltaY * 0.0012;
    setCropperTransform((prev) => ({
      ...prev,
      scale: Math.min(Math.max(0.5, prev.scale + scaleChange), 5),
    }));
  };

  const handleViewportPointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('.crop-box') ||
      target.closest('.crop-draw-layer') ||
      target.closest('button') ||
      isDrawing ||
      isMoving ||
      isResizing
    ) {
      return;
    }
    setActiveCropId(null);
    setIsCropperPanning(true);
    cropperDragStart.current = {
      x: e.clientX - cropperTransform.x,
      y: e.clientY - cropperTransform.y,
    };
  };

  const handleRootPointerMove = (e: React.PointerEvent) => {
    if (isCropperPanning) {
      e.preventDefault();
      setCropperTransform((prev) => ({
        ...prev,
        x: e.clientX - cropperDragStart.current.x,
        y: e.clientY - cropperDragStart.current.y,
      }));
      return;
    }
    handleCropMove(e);
  };

  const handleRootPointerUp = () => {
    setIsCropperPanning(false);
    handleCropEnd();
  };

  const handleSelectFullImage = () => {
    const id = crypto.randomUUID();
    setCropRegions([{ id, x: 2, y: 2, w: 96, h: 96 }]);
    setActiveCropId(id);
  };

  return (
    <div
      className="absolute inset-0 z-40 bg-slate-100 dark:bg-slate-950 flex flex-col touch-none"
      onPointerMove={handleRootPointerMove}
      onPointerUp={handleRootPointerUp}
      onPointerCancel={handleRootPointerUp}
    >
      {/* Toolbar */}
      <div className="min-h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 sm:px-5 py-2 flex items-center justify-between gap-2 sm:gap-4 shrink-0 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center gap-2 font-bold font-display text-slate-900 dark:text-slate-100 text-sm whitespace-nowrap">
            <ScanLine className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="tabular-nums">智慧名片裁切 ({cropRegions.length})</span>
          </div>

          {isAiDetecting ? (
            <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1.5 whitespace-nowrap">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>AI 偵測邊界中...</span>
            </span>
          ) : cropRegions.length === 0 ? (
            <span className="text-xs text-amber-700 dark:text-amber-400 hidden lg:inline-flex items-center gap-1.5 truncate">
              <MousePointerClick className="w-3.5 h-3.5 shrink-0" />
              <span>直接拖曳框選名片，或點右側「全圖框選」</span>
            </span>
          ) : null}

          {/* Multi-page PDF Navigation */}
          {pdfPageCount > 1 && onChangePdfPage && (
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700 ml-1">
              <button
                type="button"
                disabled={currentPdfPage <= 1 || isRenderingPdf}
                onClick={() => onChangePdfPage(currentPdfPage - 1)}
                className="w-7 h-7 flex items-center justify-center rounded-md text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
                title="上一頁 PDF"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 text-xs font-semibold text-slate-700 dark:text-slate-200 tabular-nums whitespace-nowrap">
                第 {currentPdfPage} / {pdfPageCount} 頁
              </span>
              <button
                type="button"
                disabled={currentPdfPage >= pdfPageCount || isRenderingPdf}
                onClick={() => onChangePdfPage(currentPdfPage + 1)}
                className="w-7 h-7 flex items-center justify-center rounded-md text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
                title="下一頁 PDF"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-wrap">
          {/* Quick Box Helpers */}
          <button
            type="button"
            onClick={handleSelectFullImage}
            className="h-8 px-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            title="框選整張圖片作為單張名片"
          >
            <Maximize className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">全圖框選</span>
          </button>

          {onReDetect && (
            <button
              type="button"
              disabled={isAiDetecting}
              onClick={onReDetect}
              className="h-8 px-2.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
              title="重新執行 AI 名片邊界偵測"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden md:inline">重新偵測</span>
            </button>
          )}

          {cropRegions.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setCropRegions([]);
                setActiveCropId(null);
              }}
              className="h-8 px-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
              title="清除全部裁切框"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">清除全部</span>
            </button>
          )}

          {/* Zoom Controls */}
          <div className="hidden md:flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() =>
                setCropperTransform((t) => ({ ...t, scale: Math.max(0.5, t.scale - 0.2) }))
              }
              className="w-7 h-7 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-md cursor-pointer"
              title="縮小"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setCropperTransform({ scale: 1, x: 0, y: 0 })}
              className="px-2 h-7 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 rounded-md text-xs font-semibold tabular-nums cursor-pointer"
              title="重置縮放"
            >
              {Math.round(cropperTransform.scale * 100)}%
            </button>
            <button
              type="button"
              onClick={() =>
                setCropperTransform((t) => ({ ...t, scale: Math.min(5, t.scale + 0.2) }))
              }
              className="w-7 h-7 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-md cursor-pointer"
              title="放大"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Rotate Controls */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => {
                setCropperTransform({ scale: 1, x: 0, y: 0 });
                onRotateImage('left');
              }}
              className="w-7 h-7 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-md cursor-pointer"
              title="向左旋轉並重新偵測"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-0.5" />
            <button
              type="button"
              onClick={() => {
                setCropperTransform({ scale: 1, x: 0, y: 0 });
                onRotateImage('right');
              }}
              className="w-7 h-7 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-md cursor-pointer"
              title="向右旋轉並重新偵測"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="h-8 px-3 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => onConfirmCrops(cropperImgRef.current)}
            className="h-8 px-3.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shadow-xs"
          >
            <Check className="w-3.5 h-3.5" />
            <span>確認裁切 ({cropRegions.length})</span>
          </button>
        </div>
      </div>

      {/* Canvas Viewport */}
      <div
        className="flex-1 overflow-hidden relative bg-slate-200/75 dark:bg-slate-950 select-none cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onPointerDown={handleViewportPointerDown}
      >
        <div
          className="w-full h-full flex items-center justify-center transform-gpu"
          style={{
            transform: `translate(${cropperTransform.x}px, ${cropperTransform.y}px) scale(${cropperTransform.scale})`,
            transition: isCropperPanning ? 'none' : 'transform 0.1s ease-out',
          }}
        >
          <div className="relative shadow-2xl bg-white dark:bg-slate-900">
            {isRenderingPdf && (
              <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 z-50 flex items-center justify-center">
                <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
              </div>
            )}

            {isAiDetecting && (
              <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden bg-indigo-500/8">
                <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-indigo-500 to-transparent shadow-[0_0_12px_rgba(99,102,241,0.9)] animate-scanLine" />
                <div className="absolute bottom-3 right-3 bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg shadow-md text-xs font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
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
              style={{ maxWidth: '85vw', maxHeight: '76vh', objectFit: 'contain' }}
              draggable={false}
            />

            {/* Pointer-enabled draw layer */}
            <div
              className="absolute inset-0 z-10 crop-draw-layer cursor-crosshair touch-none"
              onPointerDown={(e) => handleCropStart(e, 'draw')}
            />

            {cropRegions.map((crop, idx) => {
              const isActive = activeCropId === crop.id;
              return (
                <div
                  key={crop.id}
                  className={`crop-box absolute touch-none transition-colors ${
                    isActive
                      ? 'cursor-move'
                      : 'cursor-pointer border-2 border-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/15'
                  }`}
                  style={{
                    left: `${crop.x}%`,
                    top: `${crop.y}%`,
                    width: `${crop.w}%`,
                    height: `${crop.h}%`,
                    boxShadow: isActive ? '0 0 0 9999px rgba(15, 23, 42, 0.48)' : 'none',
                    zIndex: isActive ? 30 : 20,
                  }}
                  onPointerDown={(e) => handleCropStart(e, 'move', crop.id)}
                >
                  {/* Floating Label + Delete Chip positioned cleanly above top-left (zero overlap with corner handles) */}
                  <div
                    className={`absolute -top-7 left-0 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-white text-[11px] font-mono font-semibold shadow-md z-40 ${
                      isActive ? 'bg-indigo-600' : 'bg-emerald-600'
                    }`}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <span className="tabular-nums">#{idx + 1}</span>
                    <button
                      type="button"
                      className="w-4 h-4 rounded hover:bg-white/25 flex items-center justify-center cursor-pointer transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCropRegions((p) => p.filter((r) => r.id !== crop.id));
                        if (activeCropId === crop.id) setActiveCropId(null);
                      }}
                      aria-label={`移除裁切框 ${idx + 1}`}
                      title="移除此裁切框 (Delete)"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>

                  {isActive && (
                    <div className="absolute inset-0 border-2 border-indigo-500">
                      {/* Rule-of-thirds subtle alignment guides */}
                      <div className="absolute inset-x-0 top-1/3 border-t border-white/30 pointer-events-none" />
                      <div className="absolute inset-x-0 top-2/3 border-t border-white/30 pointer-events-none" />
                      <div className="absolute inset-y-0 left-1/3 border-l border-white/30 pointer-events-none" />
                      <div className="absolute inset-y-0 left-2/3 border-l border-white/30 pointer-events-none" />

                      {/* Corner resize handles with enlarged 28px invisible touch hit area */}
                      {[
                        { h: 'tl', pos: '-top-3.5 -left-3.5', cursor: 'cursor-nwse-resize' },
                        { h: 'tr', pos: '-top-3.5 -right-3.5', cursor: 'cursor-nesw-resize' },
                        { h: 'bl', pos: '-bottom-3.5 -left-3.5', cursor: 'cursor-nesw-resize' },
                        { h: 'br', pos: '-bottom-3.5 -right-3.5', cursor: 'cursor-nwse-resize' },
                      ].map((corner) => (
                        <div
                          key={corner.h}
                          className={`absolute ${corner.pos} w-7 h-7 flex items-center justify-center ${corner.cursor} z-50 touch-none`}
                          onPointerDown={(e) => handleCropStart(e, 'resize', crop.id, corner.h)}
                        >
                          <span className="w-3.5 h-3.5 bg-indigo-600 border-2 border-white rounded-full shadow-sm pointer-events-none" />
                        </div>
                      ))}

                      {/* Edge resize handles */}
                      <div
                        className="absolute -top-2.5 inset-x-4 h-5 cursor-ns-resize z-40 touch-none"
                        onPointerDown={(e) => handleCropStart(e, 'resize', crop.id, 't')}
                      />
                      <div
                        className="absolute -bottom-2.5 inset-x-4 h-5 cursor-ns-resize z-40 touch-none"
                        onPointerDown={(e) => handleCropStart(e, 'resize', crop.id, 'b')}
                      />
                      <div
                        className="absolute -left-2.5 inset-y-4 w-5 cursor-ew-resize z-40 touch-none"
                        onPointerDown={(e) => handleCropStart(e, 'resize', crop.id, 'l')}
                      />
                      <div
                        className="absolute -right-2.5 inset-y-4 w-5 cursor-ew-resize z-40 touch-none"
                        onPointerDown={(e) => handleCropStart(e, 'resize', crop.id, 'r')}
                      />
                    </div>
                  )}
                </div>
              );
            })}

            {isDrawing && currentRect && (
              <div
                className="absolute border-2 border-dashed border-indigo-400 bg-indigo-500/10 z-40 pointer-events-none"
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
