
import React, { useState, useEffect } from 'react';

export interface TourStep {
    targetId: string;
    title: string;
    content: string;
    position: 'right' | 'bottom' | 'bottom-left' | 'bottom-right' | 'top' | 'left';
}

interface TourOverlayProps {
    stepIndex: number; 
    steps: TourStep[]; 
    onNext: () => void; 
    onSkip: () => void; 
}

export const TourOverlay: React.FC<TourOverlayProps> = ({ stepIndex, steps, onNext, onSkip }) => {
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const currentStep = steps[stepIndex];

    useEffect(() => {
        const updateRect = () => {
            const el = document.getElementById(currentStep.targetId);
            if (el) {
                setTargetRect(el.getBoundingClientRect());
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        };
        const timer = setTimeout(updateRect, 100);
        window.addEventListener('resize', updateRect);
        return () => {
            window.removeEventListener('resize', updateRect);
            clearTimeout(timer);
        };
    }, [stepIndex, currentStep.targetId]);

    if (!targetRect) return null;

    let tooltipStyle: React.CSSProperties = {};
    const gap = 20;
    
    let top = window.innerHeight / 2;
    let left = window.innerWidth / 2;

    switch (currentStep.position) {
        case 'right':
            top = targetRect.top;
            left = targetRect.right + gap;
            break;
        case 'left':
            top = targetRect.top;
            left = targetRect.left - 320 - gap; 
            break;
        case 'bottom':
            top = targetRect.bottom + gap;
            left = targetRect.left + (targetRect.width / 2) - 160;
            break;
        case 'bottom-left':
            top = targetRect.bottom + gap;
            left = targetRect.left;
            break;
        case 'bottom-right':
            top = targetRect.bottom + gap;
            left = targetRect.right - 320;
            break;
        case 'top':
            top = targetRect.top - 200; 
            left = targetRect.left + (targetRect.width / 2) - 160;
            break;
    }

    if (left < 10) left = 10;
    if (left + 320 > window.innerWidth) left = window.innerWidth - 330;
    if (top < 10) top = 10;
    if (top + 150 > window.innerHeight) top = window.innerHeight - 160;

    tooltipStyle = { top, left };

    let textSide = 'bottom';
    if (currentStep.position === 'top') textSide = 'top';
    if (currentStep.position === 'left') textSide = 'left';
    if (currentStep.position === 'right') textSide = 'right';

    let handSide = 'top';
    if (textSide === 'bottom') handSide = 'top';
    if (textSide === 'top') handSide = 'bottom';
    if (textSide === 'left') handSide = 'right';
    if (textSide === 'right') handSide = 'left';

    const H_OFFSET = 90; 
    const V_OFFSET = 90; 

    const canPlaceTop = targetRect.top > V_OFFSET;
    const canPlaceBottom = (window.innerHeight - targetRect.bottom) > V_OFFSET;
    const canPlaceLeft = targetRect.left > H_OFFSET;
    const canPlaceRight = (window.innerWidth - targetRect.right) > H_OFFSET;

    if (handSide === 'top' && !canPlaceTop) {
        if (canPlaceLeft && textSide !== 'left') handSide = 'left';
        else if (canPlaceRight && textSide !== 'right') handSide = 'right';
        else if (canPlaceBottom && textSide !== 'bottom') handSide = 'bottom';
    } 
    else if (handSide === 'bottom' && !canPlaceBottom) {
        if (canPlaceLeft && textSide !== 'left') handSide = 'left';
        else if (canPlaceRight && textSide !== 'right') handSide = 'right';
        else if (canPlaceTop && textSide !== 'top') handSide = 'top';
    }
    else if (handSide === 'left' && !canPlaceLeft) {
        if (canPlaceBottom && textSide !== 'bottom') handSide = 'bottom';
        else if (canPlaceTop && textSide !== 'top') handSide = 'top';
        else if (canPlaceRight && textSide !== 'right') handSide = 'right';
    }
    else if (handSide === 'right' && !canPlaceRight) {
        if (canPlaceBottom && textSide !== 'bottom') handSide = 'bottom';
        else if (canPlaceTop && textSide !== 'top') handSide = 'top';
        else if (canPlaceLeft && textSide !== 'left') handSide = 'left';
    }

    let handIcon = 'fa-solid fa-hand-point-down';
    let handStyle: React.CSSProperties = {};
    let handClass = "absolute text-5xl z-50 drop-shadow-lg transition-all duration-300";

    switch (handSide) {
        case 'left':
             handIcon = 'fa-solid fa-hand-point-right';
             handStyle = { top: '50%', left: '-4.5rem', marginTop: '-1.5rem' }; 
             handClass += " animate-h-bounce"; 
             break;
        case 'right':
             handIcon = 'fa-solid fa-hand-point-left';
             handStyle = { top: '50%', right: '-4.5rem', marginTop: '-1.5rem' };
             handClass += " animate-h-bounce"; 
             break;
        case 'bottom':
             handIcon = 'fa-solid fa-hand-point-up';
             handStyle = { bottom: '-4.5rem', left: '50%', marginLeft: '-1.5rem' };
             handClass += " animate-bounce";
             break;
        case 'top':
        default:
             handIcon = 'fa-solid fa-hand-point-down';
             handStyle = { top: '-4.5rem', left: '50%', marginLeft: '-1.5rem' };
             handClass += " animate-bounce";
             break;
    }

    return (
        <div className="fixed inset-0 z-[9999] overflow-hidden">
            <svg className="absolute inset-0 w-full h-full pointer-events-none transition-all duration-500">
                <defs>
                    <mask id="tour-mask">
                        <rect x="0" y="0" width="100%" height="100%" fill="white" />
                        <rect 
                            x={targetRect.left - 8} 
                            y={targetRect.top - 8} 
                            width={targetRect.width + 16} 
                            height={targetRect.height + 16} 
                            rx="12" 
                            fill="black" 
                        />
                    </mask>
                </defs>
                <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.6)" mask="url(#tour-mask)" />
            </svg>

            <div 
                className="absolute rounded-xl pointer-events-none transition-all duration-300 border-4 border-indigo-400/80 shadow-[0_0_30px_rgba(99,102,241,0.6)] animate-pulse"
                style={{
                    top: targetRect.top - 8,
                    left: targetRect.left - 8,
                    width: targetRect.width + 16,
                    height: targetRect.height + 16
                }}
            >
                <div className={handClass} style={handStyle}>
                    <i className={`${handIcon} text-indigo-500 drop-shadow-md`}></i>
                </div>
            </div>

            <div 
                className="absolute bg-white p-6 rounded-2xl shadow-2xl w-80 animate-[float_3s_ease-in-out_infinite] border-2 border-indigo-100 flex flex-col gap-4 transition-all duration-300"
                style={tooltipStyle}
            >
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-xl shrink-0 text-indigo-600">
                        {stepIndex === 0 ? <i className="fa-solid fa-hand-sparkles"></i> : stepIndex === steps.length - 1 ? <i className="fa-solid fa-flag-checkered"></i> : <i className="fa-solid fa-lightbulb"></i>}
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-slate-800 mb-1.5">{currentStep.title}</h3>
                        <p className="text-sm text-slate-500 leading-relaxed">{currentStep.content}</p>
                    </div>
                </div>
                
                <div className="flex items-center justify-center gap-1.5 my-1">
                    {steps.map((_, i) => (
                        <div key={i} className={`h-1.5 rounded-full transition-all ${i === stepIndex ? 'w-6 bg-indigo-500' : 'w-1.5 bg-slate-200'}`}></div>
                    ))}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <button onClick={onSkip} className="text-xs font-bold text-slate-400 hover:text-slate-600 px-2 py-1">跳過教學</button>
                    <button 
                        onClick={onNext} 
                        className="bg-indigo-600 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-2 group"
                    >
                        {stepIndex === steps.length - 1 ? '開始使用！' : '下一步'} 
                        <i className="fa-solid fa-arrow-right group-hover:translate-x-1 transition-transform"></i>
                    </button>
                </div>
            </div>
        </div>
    );
};
