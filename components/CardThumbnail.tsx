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

  useEffect(() => {
    setHasError(false);
    setIsLoaded(false);
  }, [card.imageUrl]);

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-11 h-9 text-xs',
    lg: 'w-14 h-10 text-sm',
    custom: ''
  }[size];

  const avatarGradient =
    card.category === 'academic'
      ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-white'
      : card.category === 'staff'
      ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white'
      : card.category === 'other'
      ? 'bg-gradient-to-br from-slate-400 to-slate-500 text-white'
      : 'bg-gradient-to-br from-indigo-500 to-blue-600 text-white';

  const initialText =
    card.lastName ? card.lastName.charAt(0).toUpperCase() :
    card.firstName ? card.firstName.charAt(0).toUpperCase() :
    card.company ? card.company.charAt(0).toUpperCase() : '?';

  const rotation = rotate && card.rotation ? card.rotation : 0;
  const showImage = Boolean(card.imageUrl && !hasError);

  return (
    <div
      className={`relative rounded-lg flex items-center justify-center font-semibold overflow-hidden border select-none shrink-0 transition-colors ${
        showImage && isLoaded
          ? 'bg-slate-100 border-slate-200/80 shadow-2xs'
          : `${avatarGradient} border-black/5 shadow-2xs`
      } ${sizeClasses} ${className}`}
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
          className={`w-full h-full object-cover transition-opacity duration-200 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          style={rotation ? { transform: `rotate(${rotation}deg)` } : undefined}
        />
      )}

      {(!showImage || !isLoaded) && (
        <span className="absolute inset-0 flex items-center justify-center font-bold tracking-tight leading-none">
          {initialText}
        </span>
      )}
    </div>
  );
});

CardThumbnail.displayName = 'CardThumbnail';
