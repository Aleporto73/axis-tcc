'use client';

import { useState, useEffect } from 'react';
import { useOnboarding } from '../hooks/useOnboarding';
import { OnboardingOverlay } from './OnboardingOverlay';
import { OnboardingTooltip } from './OnboardingTooltip';
import { OnboardingChecklist } from './OnboardingChecklist';

export function Onboarding() {
  const [termsAccepted, setTermsAccepted] = useState<boolean | null>(null);
  
  const {
    isActive,
    currentStep,
    currentStepIndex,
    totalSteps,
    isTransitioning,
    nextStep,
    prevStep,
    skipOnboarding,
    completeOnboarding,
    steps,
  } = useOnboarding();

  // Check if terms are accepted before showing onboarding
  useEffect(() => {
    const checkTerms = async () => {
      try {
        const res = await fetch('/api/user/tenant');
        const data = await res.json();
        setTermsAccepted(data.termsAccepted === true);
      } catch {
        setTermsAccepted(false);
      }
    };
    checkTerms();
  }, []);

  // Don't render if terms not accepted yet or still checking
  if (termsAccepted !== true) return null;
  if (!isActive || !currentStep || isTransitioning) return null;

  const isCenter = currentStep.position === 'center';
  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === totalSteps - 1;

  const handleNext = () => {
    if (isLast) {
      completeOnboarding();
    } else {
      nextStep();
    }
  };

  return (
    <>
      <OnboardingOverlay
        targetSelector={currentStep.targetSelector}
        isVisible={true}
        isCenter={isCenter}
      />

      <OnboardingTooltip
        title={currentStep.title}
        description={currentStep.description}
        targetSelector={currentStep.targetSelector}
        position={currentStep.position}
        currentStep={currentStepIndex}
        totalSteps={totalSteps}
        onNext={handleNext}
        onPrev={prevStep}
        onSkip={skipOnboarding}
        isVisible={true}
        isFirst={isFirst}
        isLast={isLast}
      />

      {!isCenter && (
        <OnboardingChecklist
          currentStep={currentStepIndex}
          totalSteps={totalSteps}
          isVisible={true}
          steps={steps}
        />
      )}
    </>
  );
}

export { useOnboarding } from '../hooks/useOnboarding';
