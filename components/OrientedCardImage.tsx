import React, { useState, useRef, useEffect } from 'react';

interface OrientedCardImageProps {
  src: string;
  alt: string;
  rotation?: number;
  className?: string;
  imgClassName?: string;
  padding?: number;
  fallback?: React.ReactNode;
}

/**
 * Renders a business card image inside a container while properly adjusting
 * bounding box dimensions for 90°/270° CSS rotations so the card never clips
 * or overflows its frame.
 */
export const OrientedCardImage: React.FC<OrientedCardImageProps> = React.memo(
  ({ src, alt, rotation = 0, className = '', imgClassName = '', padding = 8, fallback }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ width: 0, height: 0 });
    const [loaded, setLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
      setLoaded(false);
      setHasError(false);
    }, [src]);

    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const update = () => {
        const rect = el.getBoundingClientRect();
        setSize({ width: rect.width, height: rect.height });
      };
      update();
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setSize({
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          });
        }
      });
      observer.observe(el);
      return () => observer.disconnect();
    }, []);

    const normalizedRot = ((rotation % 360) + 360) % 360;
    const isSideways = normalizedRot === 90 || normalizedRot === 270;
    const innerW = Math.max(0, size.width - padding * 2);
    const innerH = Math.max(0, size.height - padding * 2);

    if (hasError && fallback) {
      return <>{fallback}</>;
    }

    return (
      <div
        ref={containerRef}
        className={`relative w-full h-full flex items-center justify-center overflow-hidden ${className}`}
      >
        {!loaded && !hasError && (
          <div className="absolute inset-0 animate-shimmer bg-slate-200/40 dark:bg-slate-800/60" />
        )}
        <div
          className="flex items-center justify-center shrink-0 transition-transform duration-200"
          style={{
            transform: normalizedRot ? `rotate(${normalizedRot}deg)` : undefined,
            width: isSideways && innerH > 0 ? innerH : innerW > 0 ? innerW : '100%',
            height: isSideways && innerW > 0 ? innerW : innerH > 0 ? innerH : '100%',
          }}
        >
          <img
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onLoad={() => setLoaded(true)}
            onError={() => setHasError(true)}
            className={`max-w-full max-h-full object-contain transition-opacity duration-200 ${
              loaded ? 'opacity-100' : 'opacity-0'
            } ${imgClassName}`}
            draggable={false}
          />
        </div>
      </div>
    );
  }
);

OrientedCardImage.displayName = 'OrientedCardImage';
