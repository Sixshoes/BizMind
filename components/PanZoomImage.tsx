
import React, { useState, useRef, useEffect } from 'react';

const PanZoomImage = ({ src, rotation = 0, onRotate }: { src: string, rotation?: number, onRotate?: (deg: number) => void }) => {
    const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0, rotation: rotation });
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
            for (let entry of entries) {
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

    const isRotated = Math.abs(transform.rotation % 180) === 90;

    return (
        <div className="w-full h-full relative overflow-hidden bg-slate-900 cursor-move"
             ref={containerRef}
             onWheel={handleWheel}
             onMouseDown={handleMouseDown}
             onMouseMove={handleMouseMove}
             onMouseUp={handleMouseUp}
             onMouseLeave={handleMouseUp}
        >
            {/* Blurred Background */}
            <div 
                className="absolute inset-0 z-0 opacity-40 blur-2xl scale-110 bg-cover bg-center"
                style={{ backgroundImage: `url(${src})` }}
            />
            
            <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
                <button onClick={() => setTransform(t => ({...t, scale: t.scale + 0.2}))} className="w-8 h-8 bg-black/50 text-white rounded hover:bg-black/70 flex items-center justify-center backdrop-blur-sm" title="放大"><i className="fa-solid fa-plus"></i></button>
                <button onClick={() => setTransform(t => ({...t, scale: Math.max(0.5, t.scale - 0.2)}))} className="w-8 h-8 bg-black/50 text-white rounded hover:bg-black/70 flex items-center justify-center backdrop-blur-sm" title="縮小"><i className="fa-solid fa-minus"></i></button>
                <div className="h-px bg-white/20 my-1"></div>
                <button onClick={() => rotate(-90)} className="w-8 h-8 bg-black/50 text-white rounded hover:bg-black/70 flex items-center justify-center backdrop-blur-sm" title="向左旋轉"><i className="fa-solid fa-rotate-left"></i></button>
                <button onClick={() => rotate(90)} className="w-8 h-8 bg-black/50 text-white rounded hover:bg-black/70 flex items-center justify-center backdrop-blur-sm" title="向右旋轉"><i className="fa-solid fa-rotate-right"></i></button>
                <div className="h-px bg-white/20 my-1"></div>
                <button onClick={() => { setTransform({scale: 1, x: 0, y: 0, rotation: 0}); if (onRotate) onRotate(0); }} className="w-8 h-8 bg-indigo-600/80 text-white rounded hover:bg-indigo-500 flex items-center justify-center text-xs backdrop-blur-sm" title="重置">R</button>
            </div>
            <div className="w-full h-full flex items-center justify-center relative z-10">
                <div 
                    className="flex items-center justify-center transition-transform duration-300 ease-out"
                    style={{ 
                        transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale}) rotate(${transform.rotation}deg)`,
                        width: isRotated ? containerSize.height : '100%',
                        height: isRotated ? containerSize.width : '100%',
                        maxWidth: isRotated ? containerSize.height * 0.9 : '90%',
                        maxHeight: isRotated ? containerSize.width * 0.9 : '90%'
                    }}
                >
                    <img 
                        src={src} 
                        className="max-w-full max-h-full object-contain shadow-2xl rounded-lg ring-1 ring-white/10 transition-transform duration-300"
                        draggable={false}
                    />
                </div>
            </div>
        </div>
    );
};

export default PanZoomImage;
