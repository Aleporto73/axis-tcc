'use client';

import { Check, Circle, ArrowRight } from 'lucide-react';

interface ChecklistProps {
  currentStep: number;
  totalSteps: number;
  isVisible: boolean;
  steps: Array<{ id: string; title: string }>;
}

const CHECKLIST_GROUPS = [
  { label: 'Boas-vindas', stepIds: ['welcome'] },
  { label: 'Pacientes', stepIds: ['patients'] },
  { label: 'Sessões', stepIds: ['sessions'] },
  { label: 'Dashboard', stepIds: ['dashboard'] },
  { label: 'Conclusão', stepIds: ['conclusion'] },
];

export function OnboardingChecklist({ currentStep, totalSteps, isVisible, steps }: ChecklistProps) {
  if (!isVisible) return null;
  const currentStepId = steps[currentStep]?.id;
  return (
    <div
      className="onboarding-checklist"
      style={{
        position: 'fixed',
        left: '80px',
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 10001,
        pointerEvents: 'auto',
        animation: 'onboarding-checklist-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.3s forwards',
        opacity: 0,
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '14px',
          padding: '16px',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.04)',
          width: '180px',
        }}
      >
        <div
          style={{
            fontSize: '10px',
            fontWeight: 700,
            color: '#94A3B8',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: '12px',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          Tour do sistema
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {CHECKLIST_GROUPS.map((group) => {
            const isGroupActive = group.stepIds.includes(currentStepId);
            const groupStepIndices = group.stepIds.map(id => steps.findIndex(s => s.id === id));
            const isGroupDone = groupStepIndices.every(idx => idx !== -1 && idx < currentStep);
            return (
              <div
                key={group.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 8px',
                  borderRadius: '8px',
                  background: isGroupActive ? '#EFF6FF' : 'transparent',
                  transition: 'all 0.25s ease',
                }}
              >
                <div
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '5px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    ...(isGroupDone
                      ? { background: '#2563EB', color: 'white' }
                      : isGroupActive
                      ? { background: 'white', border: '2px solid #2563EB', color: '#2563EB' }
                      : { background: '#F1F5F9', color: '#CBD5E1' }),
                    transition: 'all 0.25s ease',
                  }}
                >
                  {isGroupDone ? (
                    <Check size={10} strokeWidth={3} />
                  ) : isGroupActive ? (
                    <ArrowRight size={9} strokeWidth={3} />
                  ) : (
                    <Circle size={7} strokeWidth={2} />
                  )}
                </div>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: isGroupActive ? 600 : 400,
                    color: isGroupDone ? '#2563EB' : isGroupActive ? '#0f172a' : '#94A3B8',
                    fontFamily: 'Inter, sans-serif',
                    transition: 'all 0.25s ease',
                    ...(isGroupDone ? { textDecoration: 'line-through', textDecorationColor: '#93C5FD' } : {}),
                  }}
                >
                  {group.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
