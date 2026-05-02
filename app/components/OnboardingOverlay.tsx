'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface OverlayProps {
  targetSelector?: string;
  isVisible: boolean;
  isCenter?: boolean;
}

export function OnboardingOverlay({ targetSelector, isVisible, isCenter }: OverlayProps) {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const updateRect = useCallback(() => {
    if (!targetSelector || isCenter) {
      setTargetRect(null);
      return;
    }
    const el = document.querySelector(targetSelector);
    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
      
      (el as HTMLElement).style.position = 'relative';
      (el as HTMLElement).style.zIndex = '9999';
      (el as HTMLElement).style.pointerEvents = 'auto';
    }
  }, [targetSelector, isCenter]);

  useEffect(() => {
    return () => {
      if (targetSelector) {
        const el = document.querySelector(targetSelector) as HTMLElement;
        if (el) {
          el.style.position = '';
          el.style.zIndex = '';
          el.style.pointerEvents = '';
        }
      }
    };
  }, [targetSelector]);

  useEffect(() => {
    if (!isVisible) return;
    
    const timer = setTimeout(updateRect, 300);
    
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
    };
  }, [isVisible, updateRect]);

  if (!isVisible) return null;

  const padding = 8;

  return (
    <div
      ref={overlayRef}
      className="onboarding-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        pointerEvents: 'none',
        transition: 'opacity 0.3s ease',
        opacity: isVisible ? 1 : 0,
      }}
    >
      <svg
        width="100%"
        height="100%"
        style={{ position: 'absolute', inset: 0 }}
      >
        <defs>
          <mask id="onboarding-mask">
            <rect width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left - padding}
                y={targetRect.top - padding}
                width={targetRect.width + padding * 2}
                height={targetRect.height + padding * 2}
                rx="12"
                ry="12"
                fill="black"
                style={{ transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(15, 23, 42, 0.65)"
          mask="url(#onboarding-mask)"
        />
      </svg>

      {targetRect && (
        <div
          className="onboarding-glow-ring"
          style={{
            position: 'absolute',
            left: targetRect.left - padding - 2,
            top: targetRect.top - padding - 2,
            width: targetRect.width + (padding + 2) * 2,
            height: targetRect.height + (padding + 2) * 2,
            borderRadius: '14px',
            border: '2px solid rgba(37, 99, 235, 0.5)',
            boxShadow: '0 0 20px rgba(37, 99, 235, 0.2), inset 0 0 20px rgba(37, 99, 235, 0.05)',
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            animation: 'onboarding-pulse 2s ease-in-out infinite',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
}
