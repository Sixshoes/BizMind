import React, { useState, useEffect } from 'react';
import { BusinessCardData } from '../types';

interface CardThumbnailProps {
  card: Partial<BusinessCardData>;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'custom';
  rotate?: boolean;
}

export const CardThumbnail: React.FC<CardThumbnailProps> = React.memo(({
  card,
  className = '',
  size = 'md',
  rotate = true
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Reset error state if image URL changes
  useEffect(() => {
    setHasError(false);
    setIsLoaded(false);
  }, [card.imageUrl]);

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    custom: ''
  }[size];

  const categoryBg = 
    card.category === 'academic' ? 'bg-amber-600' :
    card.category === 'staff' ? 'bg-emerald-600' :
    card.category === 'other' ? 'bg-slate-500' :
    'bg-indigo-600';

  const initialText = 
    card.lastName ? card.lastName.charAt(0) :
    card.firstName ? card.firstName.charAt(0) :
    card.company ? card.company.charAt(0).toUpperCase() : '?';

  const normalizedRot = rotate && card.rotation ? ((card.rotation % 360) + 360) % 360 : 0;
  const rotationClass =
    normalizedRot === 90 ? 'rotate-90' :
    normalizedRot === 180 ? 'rotate-180' :
    normalizedRot === 270 ? '-rotate-90' :
    '';

  const showImage = Boolean(card.imageUrl && !hasError);

  return (
    <div 
      className={`relative rounded-lg flex items-center justify-center font-semibold text-white overflow-hidden border border-slate-200 select-none shrink-0 ${showImage && isLoaded ? 'bg-slate-100' : categoryBg} ${sizeClasses} ${className}`}
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
          className={`w-full h-full object-contain transition-all duration-200 ${rotationClass} ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}

      {/* Fallback avatar when no image or when image fails to load */}
      {(!showImage || !isLoaded) && (
        <span className="absolute inset-0 flex items-center justify-center font-black tracking-tight leading-none">
          {initialText}
        </span>
      )}
    </div>
  );
});

CardThumbnail.displayName = 'CardThumbnail';
