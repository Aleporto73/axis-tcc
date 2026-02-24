'use client';

import { useState, useEffect, useRef } from 'react';
import { ArrowRight, ArrowLeft, X } from 'lucide-react';

interface TooltipProps {
  title: string;
  description: string;
  targetSelector?: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  isVisible: boolean;
  isFirst: boolean;
  isLast: boolean;
}

export function OnboardingTooltip({
  title,
  description,
  targetSelector,
  position = 'bottom',
  currentStep,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
  isVisible,
  isFirst,
  isLast,
}: TooltipProps) {
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [positioned, setPositioned] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPositioned(false);
  }, [currentStep]);

  useEffect(() => {
    if (!isVisible) return;
    const updatePosition = () => {
      if (position === 'center' || !targetSelector) {
        setCoords({ top: window.innerHeight / 2, left: window.innerWidth / 2 });
        setPositioned(true);
        return;
      }
      const el = document.querySelector(targetSelector);
      if (!el || !tooltipRef.current) return;
      const rect = el.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const gap = 16;
      let top = 0;
      let left = 0;
      switch (position) {
        case 'bottom':
          top = rect.bottom + gap;
          left = rect.left + rect.width / 2 - tooltipRect.width / 2;
          break;
        case 'top':
          top = rect.top - tooltipRect.height - gap;
          left = rect.left + rect.width / 2 - tooltipRect.width / 2;
          break;
        case 'left':
          top = rect.top + rect.height / 2 - tooltipRect.height / 2;
          left = rect.left - tooltipRect.width - gap;
          break;
        case 'right':
          top = rect.top + rect.height / 2 - tooltipRect.height / 2;
          left = rect.right + gap;
          break;
      }
      left = Math.max(16, Math.min(left, window.innerWidth - tooltipRect.width - 16));
      top = Math.max(16, Math.min(top, window.innerHeight - tooltipRect.height - 16));
      setCoords({ top, left });
      setPositioned(true);
    };
    const timer = setTimeout(updatePosition, 350);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isVisible, targetSelector, position, currentStep]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isVisible) return;
      if (e.key === 'ArrowRight' || e.key === 'Enter') onNext();
      if (e.key === 'ArrowLeft' && !isFirst) onPrev();
      if (e.key === 'Escape') onSkip();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, isFirst, onNext, onPrev, onSkip]);

  if (!isVisible) return null;

  const isCenter = position === 'center';

  if (isCenter) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'auto',
          opacity: positioned ? 1 : 0,
          transition: 'opacity 0.3s ease',
        }}
      >
        <div
          style={{
            background: 'white',
            borderRadius: '20px',
            padding: '32px',
            maxWidth: '420px',
            width: '90%',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            animation: positioned ? 'onboarding-modal-in 0.4s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '68px',
              height: '68px',
              borderRadius: '16px',
              overflow: 'hidden',
              margin: '0 auto 20px',
              background: '#F8FAFC',
              border: '1.5px solid #CBD5E1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img src="/favicon_axis.png" alt="AXIS" width={48} height={48} style={{ objectFit: 'contain' }} />
          </div>
          <h2
            style={{
              fontSize: '24px',
              fontWeight: 600,
              color: '#0f172a',
              marginBottom: '8px',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            {title}
          </h2>
          <p
            style={{
              fontSize: '15px',
              color: '#64748b',
              lineHeight: 1.6,
              marginBottom: '24px',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            {description}
          </p>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: '4px',
                  borderRadius: '2px',
                  background: i <= currentStep ? '#2563EB' : '#E2E8F0',
                  transition: 'background 0.3s ease',
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            {!isFirst && (
              <button
                onClick={onPrev}
                style={{
                  flex: 1,
                  padding: '12px 20px',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  background: 'white',
                  color: '#475569',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                <ArrowLeft size={16} />
                Voltar
              </button>
            )}
            <button
              onClick={onNext}
              style={{
                flex: 2,
                padding: '12px 20px',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                color: 'white',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {isLast ? 'Começar a usar' : isFirst ? 'Começar' : 'Próximo'}
              {!isLast && <ArrowRight size={16} />}
            </button>
          </div>
          {!isLast && (
            <button
              onClick={onSkip}
              style={{
                marginTop: '16px',
                background: 'none',
                border: 'none',
                color: '#94A3B8',
                fontSize: '13px',
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              Pular tour
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={tooltipRef}
      style={{
        position: 'fixed',
        top: coords.top,
        left: coords.left,
        zIndex: 10000,
        pointerEvents: 'auto',
        opacity: positioned ? 1 : 0,
        transition: 'opacity 0.25s ease',
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '16px',
          padding: '20px',
          width: '320px',
          boxShadow: '0 20px 40px -8px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <h3
            style={{
              fontSize: '16px',
              fontWeight: 600,
              color: '#0f172a',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            {title}
          </h3>
          <button
            onClick={onSkip}
            style={{
              background: 'none',
              border: 'none',
              color: '#94A3B8',
              cursor: 'pointer',
              padding: '4px',
              marginTop: '-4px',
              marginRight: '-4px',
            }}
          >
            <X size={18} />
          </button>
        </div>
        <p
          style={{
            fontSize: '14px',
            color: '#64748b',
            lineHeight: 1.5,
            marginBottom: '16px',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {description}
        </p>
        <div
          style={{
            height: '3px',
            background: '#F1F5F9',
            borderRadius: '2px',
            marginBottom: '16px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${((currentStep + 1) / totalSteps) * 100}%`,
              background: '#2563EB',
              borderRadius: '2px',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {!isFirst && (
            <button
              onClick={onPrev}
              style={{
                padding: '10px 16px',
                borderRadius: '8px',
                border: '1px solid #E2E8F0',
                background: 'white',
                color: '#475569',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              <ArrowLeft size={14} />
              Voltar
            </button>
          )}
          <button
            onClick={onNext}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: '8px',
              border: 'none',
              background: '#2563EB',
              color: 'white',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            {isLast ? 'Finalizar' : 'Próximo'}
            {!isLast && <ArrowRight size={14} />}
          </button>
        </div>
        <div
          style={{
            marginTop: '12px',
            textAlign: 'center',
            fontSize: '12px',
            color: '#94A3B8',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {currentStep + 1} de {totalSteps}
        </div>
      </div>
    </div>
  );
}
