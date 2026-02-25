/**
 * Motor CSO-ABA — Bible S2 (4 Dimensões)
 *
 * CSO-ABA = (0.25 × SAS) + (0.25 × PIS) + (0.25 × BSS) + (0.25 × TCM)
 * Pesos FIXOS (0.25 cada). NÃO ajustáveis por tenant. Padrão nacional.
 *
 * Engine version: 1.0.0
 */

export const CSO_ABA_ENGINE_VERSION = "1.0.0";

// ─── Pesos fixos (Bible S2.1) ─────────────────────
export const WEIGHTS = {
  SAS: 0.25,
  PIS: 0.25,
  BSS: 0.25,
  TCM: 0.25,
} as const;

// ─── Tipos ─────────────────────────────────────────

export interface TargetScore {
  score: number;   // 0-100 — percentual de acerto do alvo
  trials: number;  // quantidade de tentativas
}

export type MasteryStatus =
  | "maintained"           // 3/3 sondas >= 70%
  | "mastered_validated"   // Generalização 3x2 completa
  | "mastered"             // Domínio sem generalização
  | "active";              // Em aquisição (não dominado)

export type PromptLevel =
  | "independente"     // 1.00
  | "gestual"          // 0.80
  | "verbal"           // 0.60
  | "modelacao"        // 0.40
  | "fisica_parcial"   // 0.20
  | "fisica_total";    // 0.00

export type BehaviorIntensity = "leve" | "moderada" | "alta" | "severa";

export interface CsoAbaResult {
  sas: number;
  pis: number;
  bss: number;
  tcm: number;
  csoAba: number;
  faixa: "excelente" | "bom" | "atencao" | "critico";
}

// ─── Constantes ────────────────────────────────────

export const MASTERY_SCORES: Record<MasteryStatus, number> = {
  maintained: 100,
  mastered_validated: 85,
  mastered: 75,
  active: 0, // não entra na mastery portion
};

export const PROMPT_SCALE: Record<PromptLevel, number> = {
  independente: 1.0,
  gestual: 0.8,
  verbal: 0.6,
  modelacao: 0.4,
  fisica_parcial: 0.2,
  fisica_total: 0.0,
};

export const INTENSITY_VALUES: Record<BehaviorIntensity, number> = {
  leve: 0.25,
  moderada: 0.5,
  alta: 0.75,
  severa: 1.0,
};

// ─── Helpers ───────────────────────────────────────

/** Garante valor entre min e max */
export function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * S2.3 — SAS (Skill Acquisition Score)
 *
 * SAS_ativos = Σ(score × trials) / Σ(trials)
 * SAS = SAS_ativos × (1 - mastery_rate) + mastery_score × mastery_rate
 *
 * mastery_rate = nº alvos dominados / total alvos
 * mastery_score = média ponderada dos scores de maestria
 */
export function calculateSAS(
  activeTargets: TargetScore[],
  masteredTargets: { status: MasteryStatus; score?: number }[]
): number {
  const totalTargets = activeTargets.length + masteredTargets.length;
  if (totalTargets === 0) return 0;

  // SAS_ativos: média ponderada por trials
  let sasAtivos = 0;
  if (activeTargets.length > 0) {
    const sumScoreTrials = activeTargets.reduce(
      (acc, t) => acc + t.score * t.trials,
      0
    );
    const sumTrials = activeTargets.reduce((acc, t) => acc + t.trials, 0);
    sasAtivos = sumTrials > 0 ? sumScoreTrials / sumTrials : 0;
  }

  // Mastery rate e score
  const masteryRate = masteredTargets.length / totalTargets;

  let masteryScore = 0;
  if (masteredTargets.length > 0) {
    masteryScore =
      masteredTargets.reduce(
        (acc, t) => acc + (t.score ?? MASTERY_SCORES[t.status]),
        0
      ) / masteredTargets.length;
  }

  const sas = sasAtivos * (1 - masteryRate) + masteryScore * masteryRate;
  return clamp(sas);
}

/**
 * S2.4 — PIS (Prompt Independence Score)
 *
 * PIS = mean(prompt_scale por alvo ativo) × 100
 */
export function calculatePIS(promptLevels: PromptLevel[]): number {
  if (promptLevels.length === 0) return 0;

  const sum = promptLevels.reduce(
    (acc, level) => acc + PROMPT_SCALE[level],
    0
  );
  const mean = sum / promptLevels.length;
  return clamp(mean * 100);
}

/**
 * S2.5 — BSS (Behavioral Stability Score)
 *
 * BSS = 100 × (1 - current_intensity) × trend_factor
 * Clamp 0-100.
 */
export function calculateBSS(
  intensity: BehaviorIntensity,
  trendFactor: number
): number {
  const intensityValue = INTENSITY_VALUES[intensity];
  const bss = 100 * (1 - intensityValue) * trendFactor;
  return clamp(bss);
}

/**
 * S2.6 — TCM (Therapeutic Consistency Metric)
 *
 * TCM = 100 × (1 - CV_last_5_sessions)
 * CV = desvio_padrão / média
 * Se < 2 sessões: TCM = 75 (neutro)
 */
export function calculateTCM(sessionScores: number[]): number {
  if (sessionScores.length < 2) return 75;

  // Pegar últimas 5 sessões
  const last5 = sessionScores.slice(-5);

  const mean = last5.reduce((a, b) => a + b, 0) / last5.length;
  if (mean === 0) return 0;

  const variance =
    last5.reduce((acc, s) => acc + Math.pow(s - mean, 2), 0) / last5.length;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / mean;

  return clamp(100 * (1 - cv));
}

/**
 * S2.1 — Fórmula Principal CSO-ABA
 *
 * CSO-ABA = (0.25 × SAS) + (0.25 × PIS) + (0.25 × BSS) + (0.25 × TCM)
 */
export function calculateCsoAba(
  sas: number,
  pis: number,
  bss: number,
  tcm: number
): number {
  const result =
    WEIGHTS.SAS * sas +
    WEIGHTS.PIS * pis +
    WEIGHTS.BSS * bss +
    WEIGHTS.TCM * tcm;
  return clamp(result);
}

/**
 * S2.7 — Faixa Interpretativa
 */
export function getFaixa(
  csoAba: number
): "excelente" | "bom" | "atencao" | "critico" {
  if (csoAba >= 85) return "excelente";
  if (csoAba >= 70) return "bom";
  if (csoAba >= 50) return "atencao";
  return "critico";
}

/**
 * Calcula CSO-ABA completo com todas as dimensões
 */
export function computeFullCsoAba(params: {
  activeTargets: TargetScore[];
  masteredTargets: { status: MasteryStatus; score?: number }[];
  promptLevels: PromptLevel[];
  behaviorIntensity: BehaviorIntensity;
  trendFactor: number;
  sessionScores: number[];
}): CsoAbaResult {
  const sas = calculateSAS(params.activeTargets, params.masteredTargets);
  const pis = calculatePIS(params.promptLevels);
  const bss = calculateBSS(params.behaviorIntensity, params.trendFactor);
  const tcm = calculateTCM(params.sessionScores);
  const csoAba = calculateCsoAba(sas, pis, bss, tcm);
  const faixa = getFaixa(csoAba);

  return { sas, pis, bss, tcm, csoAba, faixa };
}
