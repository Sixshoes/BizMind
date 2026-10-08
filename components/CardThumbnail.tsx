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
    card.category === 'academic' ? 'bg-amber-400' :
    card.category === 'staff' ? 'bg-emerald-500' :
    card.category === 'other' ? 'bg-slate-400' :
    'bg-blue-500';

  const initialText = 
    card.lastName ? card.lastName.charAt(0) :
    card.firstName ? card.firstName.charAt(0) :
    card.company ? card.company.charAt(0).toUpperCase() : '?';

  const rotation = rotate && card.rotation ? card.rotation : 0;

  const showImage = Boolean(card.imageUrl && !hasError);

  return (
    <div 
      className={`relative rounded-lg flex items-center justify-center font-bold text-white shadow-xs overflow-hidden border border-slate-200/60 select-none shrink-0 ${categoryBg} ${sizeClasses} ${className}`}
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
          className={`w-full h-full object-contain transition-all duration-200 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          style={rotation ? { transform: `rotate(${rotation}deg)` } : undefined}
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
