'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  route?: string;
  targetSelector?: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Bem-vindo ao AXIS TCC',
    description: 'Vamos fazer um tour rápido pelo sistema. Vai levar menos de 1 minuto.',
    position: 'center',
  },
  {
    id: 'patients',
    title: 'Seus Pacientes',
    description: 'Aqui você cadastra e gerencia seus pacientes. Clique em "Novo Paciente" quando estiver pronto.',
    route: '/pacientes',
    targetSelector: '[data-onboarding="new-patient"]',
    position: 'bottom',
  },
  {
    id: 'sessions',
    title: 'Suas Sessões',
    description: 'Nesta área você agenda e acompanha todas as sessões. O AXIS cria o link do Meet automaticamente.',
    route: '/sessoes',
    targetSelector: '[data-onboarding="new-session"]',
    position: 'bottom',
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    description: 'Seu painel principal mostra as sessões do dia, status de confirmação e lembretes.',
    route: '/dashboard',
    position: 'center',
  },
  {
    id: 'conclusion',
    title: 'Tudo pronto!',
    description: 'Esse foi o tour inicial. Agora explore o sistema no seu ritmo. Bom trabalho!',
    position: 'center',
  },
];

const STORAGE_KEY = 'axis_onboarding';

interface OnboardingState {
  completed: boolean;
  currentStep: number;
  skipped: boolean;
  completedAt?: string;
}

function getStoredState(): OnboardingState {
  if (typeof window === 'undefined') return { completed: false, currentStep: 0, skipped: false };
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return { completed: false, currentStep: 0, skipped: false };
}

function saveState(state: OnboardingState) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

export function useOnboarding() {
  const router = useRouter();
  const pathname = usePathname();
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [hasCheckedStorage, setHasCheckedStorage] = useState(false);
  const retryRef = useRef(0);
  const [elementReady, setElementReady] = useState(false);

  useEffect(() => {
    const state = getStoredState();
    if (!state.completed && !state.skipped) {
      setCurrentStepIndex(state.currentStep);
      setIsActive(true);
    }
    setHasCheckedStorage(true);
  }, []);

  const currentStep = ONBOARDING_STEPS[currentStepIndex] || null;
  const totalSteps = ONBOARDING_STEPS.length;

  useEffect(() => {
    if (!isActive || !currentStep?.route) return;
    if (pathname !== currentStep.route) {
      setIsTransitioning(true);
      setElementReady(false);
      router.push(currentStep.route);
    }
  }, [currentStepIndex, isActive, currentStep, pathname, router]);

  useEffect(() => {
    if (!isActive || isTransitioning) return;
    if (!currentStep?.targetSelector) {
      setElementReady(true);
      return;
    }
    if (currentStep.route && pathname !== currentStep.route) return;
    retryRef.current = 0;
    setElementReady(false);
    const check = () => {
      const el = document.querySelector(currentStep.targetSelector!);
      if (el) {
        setElementReady(true);
        return;
      }
      retryRef.current++;
      if (retryRef.current < 10) {
        setTimeout(check, 300);
      } else {
        setElementReady(true);
      }
    };
    setTimeout(check, 400);
  }, [isActive, isTransitioning, currentStep, pathname]);

  useEffect(() => {
    if (!isTransitioning) return;
    if (currentStep?.route && pathname === currentStep.route) {
      const timer = setTimeout(() => setIsTransitioning(false), 500);
      return () => clearTimeout(timer);
    }
  }, [pathname, currentStep, isTransitioning]);

  const nextStep = useCallback(() => {
    const next = currentStepIndex + 1;
    if (next >= totalSteps) {
      saveState({ completed: true, currentStep: totalSteps - 1, skipped: false, completedAt: new Date().toISOString() });
      setIsActive(false);
      return;
    }
    setElementReady(false);
    setCurrentStepIndex(next);
    saveState({ completed: false, currentStep: next, skipped: false });
  }, [currentStepIndex, totalSteps]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setElementReady(false);
      const prev = currentStepIndex - 1;
      setCurrentStepIndex(prev);
      saveState({ completed: false, currentStep: prev, skipped: false });
    }
  }, [currentStepIndex]);

  const skipOnboarding = useCallback(() => {
    saveState({ completed: false, currentStep: currentStepIndex, skipped: true });
    setIsActive(false);
  }, [currentStepIndex]);

  const resetOnboarding = useCallback(() => {
    saveState({ completed: false, currentStep: 0, skipped: false });
    setCurrentStepIndex(0);
    setElementReady(false);
    setIsActive(true);
  }, []);

  const completeOnboarding = useCallback(() => {
    saveState({ completed: true, currentStep: totalSteps - 1, skipped: false, completedAt: new Date().toISOString() });
    setIsActive(false);
  }, [totalSteps]);

  const hasTarget = currentStep?.targetSelector && typeof document !== 'undefined' && document.querySelector(currentStep.targetSelector);
  const effectiveStep = currentStep && currentStep.targetSelector && !hasTarget && elementReady
    ? { ...currentStep, position: 'center' as const, targetSelector: undefined }
    : currentStep;

  return {
    isActive: isActive && hasCheckedStorage && elementReady,
    currentStep: effectiveStep,
    currentStepIndex,
    totalSteps,
    progress: (currentStepIndex / (totalSteps - 1)) * 100,
    isTransitioning,
    elementFound: !!hasTarget,
    nextStep,
    prevStep,
    skipOnboarding,
    resetOnboarding,
    completeOnboarding,
    steps: ONBOARDING_STEPS,
  };
}
