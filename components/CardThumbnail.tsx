import React, { useState, useEffect } from 'react';
import { BusinessCardData } from '../types';

interface CardThumbnailProps {
  card: Partial<BusinessCardData>;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'custom';
  rotate?: boolean;
}

export const CardThumbnail: React.FC<CardThumbnailProps> = React.memo(
  ({ card, className = '', size = 'md', rotate = true }) => {
    const [hasError, setHasError] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
      setHasError(false);
      setIsLoaded(false);
    }, [card.imageUrl]);

    // True business-card aspect ratio (~1.6:1)
    const sizeClasses = {
      sm: 'w-11 h-7 text-[11px]',
      md: 'w-14 h-9 text-xs',
      lg: 'w-16 h-10 text-sm',
      custom: '',
    }[size];

    const categoryBg =
      card.category === 'academic'
        ? 'bg-gradient-to-br from-amber-500 to-amber-600'
        : card.category === 'staff'
        ? 'bg-gradient-to-br from-emerald-500 to-emerald-600'
        : card.category === 'other'
        ? 'bg-gradient-to-br from-slate-500 to-slate-600'
        : 'bg-gradient-to-br from-indigo-500 to-indigo-600';

    const initialText = card.lastName
      ? card.lastName.charAt(0)
      : card.firstName
      ? card.firstName.charAt(0)
      : card.company
      ? card.company.charAt(0).toUpperCase()
      : '?';

    const normalizedRot = rotate && card.rotation ? ((card.rotation % 360) + 360) % 360 : 0;
    const isSideways = normalizedRot === 90 || normalizedRot === 270;
    const showImage = Boolean(card.imageUrl && !hasError);
    const hasBack = Boolean(card.backImageUrl);

    return (
      <div className={`relative shrink-0 select-none ${sizeClasses} ${className}`}>
        {/* Subtle stacked back-card hint when dual-side */}
        {hasBack && (
          <div
            aria-hidden="true"
            className="absolute -right-0.5 -bottom-0.5 inset-0 rounded-md bg-indigo-200/80 dark:bg-indigo-500/35 border border-indigo-300/70 dark:border-indigo-400/30 translate-x-[2px] translate-y-[2px]"
          />
        )}
        <div
          className={`relative w-full h-full rounded-md flex items-center justify-center font-bold text-white overflow-hidden border shadow-2xs ${
            showImage && isLoaded
              ? 'bg-slate-100 dark:bg-slate-800 border-slate-200/90 dark:border-slate-700'
              : `${categoryBg} border-black/10`
          }`}
        >
          {showImage && (
            <img
              src={card.imageUrl}
              alt=""
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => setHasError(true)}
              onLoad={() => setIsLoaded(true)}
              style={{
                transform: normalizedRot
                  ? `rotate(${normalizedRot}deg)${isSideways ? ' scale(0.66)' : ''}`
                  : undefined,
              }}
              className={`w-full h-full object-contain transition-opacity duration-200 ${
                isLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            />
          )}

          {(!showImage || !isLoaded) && (
            <span className="absolute inset-0 flex items-center justify-center font-bold tracking-tight leading-none">
              {initialText}
            </span>
          )}
        </div>
      </div>
    );
  }
);

CardThumbnail.displayName = 'CardThumbnail';
