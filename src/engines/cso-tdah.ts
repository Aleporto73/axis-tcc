/**
 * Motor CSO-TDAH v1.0.0 — AXIS_TDAH_BIBLE v2.5
 *
 * 3 Blocos:
 *   Bloco 1 — Camada Base AXIS: SAS-TDAH, PIS-TDAH, BSS-TDAH, TCM-TDAH
 *   Bloco 2 — Camada Executiva: EXR, CTX
 *   Bloco 3 — Layer AuDHD: SEN, TRF, RIG (categórico), MSK (validação)
 *
 * final_score = weighted_available_blocks (renormalização automática)
 * Pesos configuráveis via engine_versions (JSON no banco)
 *
 * Regras imutáveis:
 *   - RIG é categórico (4 estados + severity), NUNCA escala linear
 *   - MSK é campo opcional até validação operacional
 *   - Missing data NUNCA tratado como melhora
 *   - Snapshot registra estado da layer no momento
 *   - Engine determinístico, append-only, versionado
 */

// ─── Versão ──────────────────────────────────────────

export const CSO_TDAH_ENGINE_VERSION = "1.0.0";
export const CSO_TDAH_ENGINE_NAME = "CSO-TDAH";

// ─── Pesos default (configuráveis via engine_versions) ─

export interface CsoTdahWeights {
  /** Peso do Bloco 1 (Camada Base) no final_score */
  core: number;
  /** Peso do Bloco 2 (Camada Executiva) no final_score */
  executive: number;
  /** Peso do Bloco 3 (Layer AuDHD) no final_score — só quando ativa */
  audhd: number;
}

export const DEFAULT_WEIGHTS: CsoTdahWeights = {
  core: 0.50,
  executive: 0.30,
  audhd: 0.20,
};

// ─── Tipos Base (herdados do padrão ABA, reinterpretados TDAH) ─

export interface TargetScore {
  score: number;   // 0-100 — percentual de acerto/realização
  trials: number;  // quantidade de tentativas/blocos
}

export type MasteryStatus =
  | "maintained"           // 3/3 sondas >= 70%
  | "mastered_validated"   // Generalização completa
  | "mastered"             // Domínio sem generalização
  | "active";              // Em aquisição

export type PromptLevel =
  | "independente"     // 1.00
  | "gestual"          // 0.80
  | "verbal"           // 0.60
  | "modelacao"        // 0.40
  | "fisica_parcial"   // 0.20
  | "fisica_total";    // 0.00

/** BSS-TDAH: estabilidade comportamental (Bible §7.3) */
export type StabilityLevel = "estavel" | "oscilante" | "instavel";

// ─── Tipos Camada Executiva ──────────────────────────

/** EXR: regulação executiva funcional (Bible §8.2) — escala 4 pontos */
export type ExrLevel =
  | "independente"          // 1.00
  | "apoio_minimo"          // 0.75
  | "apoio_significativo"   // 0.40
  | "nao_realiza";          // 0.00

/** CTX: consistência contextual (Bible §8.3) — 0–100 */
export interface CtxInput {
  /** Score da habilidade no contexto A (0-100) */
  contextScores: number[];
}

// ─── Tipos Layer AuDHD ───────────────────────────────

/** Estados da layer AuDHD (Bible §9.4) */
export type AudhdLayerStatus = "off" | "active_core" | "active_full";

/** SEN: carga sensorial (Bible §9.6.1) — escala 3 pontos */
export type SenLevel = "sem_impacto" | "impacto_moderado" | "impacto_significativo";

/** TRF: atrito em transição (Bible §9.6.2) — escala 3 pontos */
export type TrfLevel = "transicao_fluida" | "com_resistencia" | "com_ruptura";

/** RIG: rigidez-impulsividade (Bible §9.6.3) — CATEGÓRICO, NÃO linear */
export type RigState = "balanced" | "rigidity_leaning" | "impulsivity_leaning" | "dual_risk";
export type RigSeverity = "none" | "mild" | "moderate" | "high";

export interface RigRecord {
  rig_state: RigState;
  rig_severity: RigSeverity;
  rig_observation_count: number;
  rig_last_updated_at: string;
}

/** MSK: custo de masking (Bible §9.6.4) — EM VALIDAÇÃO */
export type MskStatus = "validation_pending" | "valid" | "missing";

export interface MskRecord {
  value: number | null;
  status: MskStatus;
}

// ─── Tipos de Contexto e Missing Data ─────────────────

/** Contextos de coleta (Bible Anexo G §G6.5) */
export type ContextStatus = "present" | "missing" | "not_applicable";

export interface SourceContexts {
  clinical: ContextStatus;
  home: ContextStatus;
  school: ContextStatus;
}

/** Missing data (Bible Anexo G §G4) */
export type MissingDataFlag =
  | "none"
  | "partial_context"
  | "insufficient_data"
  | "layer_data_missing";

export interface MissingDataInfo {
  primary_flag: MissingDataFlag;
  flags: MissingDataFlag[];
}

/** Confidence flag (Bible Anexo G §G2.7) */
export type ConfidenceFlag = "low" | "medium" | "high";

/** Faixas interpretativas (Bible Anexo G §G2.6) */
export type FinalBand = "sem_dados" | "critico" | "atencao" | "bom" | "excelente";

/** Snapshot type (Bible Anexo G §G6.4) */
export type SnapshotType =
  | "session_close"
  | "clinical_review"
  | "monitoring_cycle"
  | "manual_override";

// ─── Métricas por Bloco ──────────────────────────────

export interface MetricValue {
  value: number;
  status: "valid" | "missing";
}

export interface CoreMetrics {
  sas_tdah: MetricValue;
  pis_tdah: MetricValue;
  bss_tdah: MetricValue;
  tcm_tdah: MetricValue;
}

export interface ExecutiveMetrics {
  exr: MetricValue;
  ctx: MetricValue;
}

export interface AudhdMetrics {
  sen: MetricValue;
  trf: MetricValue;
  rig: { rig_state: RigState; rig_severity: RigSeverity; status: "valid" | "missing" };
  msk: MskRecord;
}

export interface AudhdFlags {
  rig_alert: boolean;
  msk_experimental: boolean;
}

// ─── Output completo do motor (Bible Anexo G §G2.2) ──

export interface CsoTdahOutput {
  engine_name: typeof CSO_TDAH_ENGINE_NAME;
  engine_version: string;
  audhd_layer_status: AudhdLayerStatus;

  core_score: number | null;
  executive_score: number | null;
  audhd_layer_score: number | null;
  final_score: number | null;
  final_band: FinalBand;
  confidence_flag: ConfidenceFlag;

  missing_data_primary_flag: MissingDataFlag;
  missing_data_flags: MissingDataFlag[];
  source_contexts: SourceContexts;

  base_metrics: CoreMetrics;
  executive_metrics: ExecutiveMetrics;
  audhd_metrics: AudhdMetrics | null;
  audhd_flags: AudhdFlags | null;

  generated_at: string;
}

// ─── Constantes de escala ─────────────────────────────

export const MASTERY_SCORES: Record<MasteryStatus, number> = {
  maintained: 100,
  mastered_validated: 85,
  mastered: 75,
  active: 0,
};

export const PROMPT_SCALE: Record<PromptLevel, number> = {
  independente: 1.0,
  gestual: 0.8,
  verbal: 0.6,
  modelacao: 0.4,
  fisica_parcial: 0.2,
  fisica_total: 0.0,
};

export const STABILITY_SCALE: Record<StabilityLevel, number> = {
  estavel: 1.0,
  oscilante: 0.5,
  instavel: 0.0,
};

export const EXR_SCALE: Record<ExrLevel, number> = {
  independente: 1.0,
  apoio_minimo: 0.75,
  apoio_significativo: 0.40,
  nao_realiza: 0.0,
};

export const SEN_SCALE: Record<SenLevel, number> = {
  sem_impacto: 1.0,
  impacto_moderado: 0.5,
  impacto_significativo: 0.0,
};

export const TRF_SCALE: Record<TrfLevel, number> = {
  transicao_fluida: 1.0,
  com_resistencia: 0.5,
  com_ruptura: 0.0,
};

// ─── Helpers ──────────────────────────────────────────

export function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// ─── Bloco 1: Camada Base (Bible §7) ─────────────────

/**
 * SAS-TDAH — Skill Acquisition Score (Bible §7.1)
 * Mesmo padrão ABA: média ponderada por trials + mastery blend
 */
export function calculateSasTdah(
  activeTargets: TargetScore[],
  masteredTargets: { status: MasteryStatus; score?: number }[]
): number {
  const totalTargets = activeTargets.length + masteredTargets.length;
  if (totalTargets === 0) return 0;

  let sasAtivos = 0;
  if (activeTargets.length > 0) {
    const sumScoreTrials = activeTargets.reduce((acc, t) => acc + t.score * t.trials, 0);
    const sumTrials = activeTargets.reduce((acc, t) => acc + t.trials, 0);
    sasAtivos = sumTrials > 0 ? sumScoreTrials / sumTrials : 0;
  }

  const masteryRate = masteredTargets.length / totalTargets;
  let masteryScore = 0;
  if (masteredTargets.length > 0) {
    masteryScore = masteredTargets.reduce(
      (acc, t) => acc + (t.score ?? MASTERY_SCORES[t.status]), 0
    ) / masteredTargets.length;
  }

  return clamp(sasAtivos * (1 - masteryRate) + masteryScore * masteryRate);
}

/**
 * PIS-TDAH — Prompt Independence Score (Bible §7.2)
 * Mesmo padrão ABA: média dos níveis de prompt × 100
 */
export function calculatePisTdah(promptLevels: PromptLevel[]): number {
  if (promptLevels.length === 0) return 0;
  const sum = promptLevels.reduce((acc, level) => acc + PROMPT_SCALE[level], 0);
  return clamp((sum / promptLevels.length) * 100);
}

/**
 * BSS-TDAH — Behavioral Stability Score (Bible §7.3)
 * Diferente do ABA: usa escala 3 pontos (estável/oscilante/instável)
 * ao invés de intensity × trendFactor
 */
export function calculateBssTdah(stabilityLevels: StabilityLevel[]): number {
  if (stabilityLevels.length === 0) return 0;
  const values = stabilityLevels.map(s => STABILITY_SCALE[s]);
  return clamp(mean(values) * 100);
}

/**
 * TCM-TDAH — Treatment Consistency Metric (Bible §7.4)
 * Mede consistência de INTERVENÇÃO entre contextos (adultos, aplicação, aderência ao plano)
 * Diferente do ABA: usa checklist de aderência por contexto, não CV de sessões
 */
export function calculateTcmTdah(adherenceScores: number[]): number {
  if (adherenceScores.length === 0) return 0;
  // adherenceScores: 0-100 por ciclo de revisão (% de aderência ao plano)
  return clamp(mean(adherenceScores));
}

/**
 * Core Score — média ponderada das métricas base disponíveis
 */
export function calculateCoreScore(metrics: CoreMetrics): number | null {
  const valid: number[] = [];
  if (metrics.sas_tdah.status === "valid") valid.push(metrics.sas_tdah.value);
  if (metrics.pis_tdah.status === "valid") valid.push(metrics.pis_tdah.value);
  if (metrics.bss_tdah.status === "valid") valid.push(metrics.bss_tdah.value);
  if (metrics.tcm_tdah.status === "valid") valid.push(metrics.tcm_tdah.value);

  if (valid.length === 0) return null;
  return clamp(mean(valid));
}

// ─── Bloco 2: Camada Executiva (Bible §8) ─────────────

/**
 * EXR — Executive Regulation (Bible §8.2)
 * Escala 4 pontos: independente / apoio mínimo / apoio significativo / não realiza
 */
export function calculateExr(exrLevels: ExrLevel[]): number {
  if (exrLevels.length === 0) return 0;
  const values = exrLevels.map(e => EXR_SCALE[e]);
  return clamp(mean(values) * 100);
}

/**
 * CTX — Contextual Consistency (Bible §8.3)
 * Mede consistência funcional da CRIANÇA entre contextos
 * Comparação de desempenho da mesma habilidade entre 2+ contextos
 */
export function calculateCtx(contextScores: number[]): number {
  if (contextScores.length < 2) return 0;

  // Coeficiente de variação invertido: quanto menor a variação, maior o CTX
  const avg = mean(contextScores);
  if (avg === 0) return 0;

  const variance = contextScores.reduce((acc, s) => acc + Math.pow(s - avg, 2), 0) / contextScores.length;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / avg;

  return clamp(100 * (1 - cv));
}

/**
 * Executive Score — média ponderada das métricas executivas disponíveis
 */
export function calculateExecutiveScore(metrics: ExecutiveMetrics): number | null {
  const valid: number[] = [];
  if (metrics.exr.status === "valid") valid.push(metrics.exr.value);
  if (metrics.ctx.status === "valid") valid.push(metrics.ctx.value);

  if (valid.length === 0) return null;
  return clamp(mean(valid));
}

// ─── Bloco 3: Layer AuDHD (Bible §9) ─────────────────

/**
 * SEN — Sensory Load (Bible §9.6.1)
 * Escala 3 pontos: sem impacto / impacto moderado / impacto significativo
 */
export function calculateSen(senLevels: SenLevel[]): number {
  if (senLevels.length === 0) return 0;
  const values = senLevels.map(s => SEN_SCALE[s]);
  return clamp(mean(values) * 100);
}

/**
 * TRF — Transition Friction (Bible §9.6.2)
 * Escala 3 pontos: transição fluida / com resistência / com ruptura
 */
export function calculateTrf(trfLevels: TrfLevel[]): number {
  if (trfLevels.length === 0) return 0;
  const values = trfLevels.map(t => TRF_SCALE[t]);
  return clamp(mean(values) * 100);
}

/**
 * RIG — Rigidity-Impulsivity Balance (Bible §9.6.3 + Anexo G §G3)
 *
 * REGRA CRÍTICA: RIG é CATEGÓRICO. NÃO é escala linear.
 * NÃO compõe média simples. NÃO converte automaticamente em score 0-100.
 * Entra como: flag clínica, modulador interpretativo, gatilho de revisão.
 *
 * RIG NÃO altera final_score até existir nota técnica formal.
 */
export function evaluateRig(records: RigRecord[]): {
  rig_state: RigState;
  rig_severity: RigSeverity;
  status: "valid" | "missing";
} {
  if (records.length === 0) {
    return { rig_state: "balanced", rig_severity: "none", status: "missing" };
  }

  // Usar o registro mais recente
  const latest = records.sort(
    (a, b) => new Date(b.rig_last_updated_at).getTime() - new Date(a.rig_last_updated_at).getTime()
  )[0];

  return {
    rig_state: latest.rig_state,
    rig_severity: latest.rig_severity,
    status: "valid",
  };
}

/**
 * AuDHD Layer Score (Bible Anexo G §G2.4)
 * Média ponderada das métricas QUANTITATIVAS da layer.
 * RIG NÃO entra como score linear — entra como flag.
 * MSK NÃO entra no score final enquanto em validação.
 */
export function calculateAudhdLayerScore(metrics: AudhdMetrics): number | null {
  const valid: number[] = [];
  if (metrics.sen.status === "valid") valid.push(metrics.sen.value);
  if (metrics.trf.status === "valid") valid.push(metrics.trf.value);
  // RIG: categórico — NÃO entra no score numérico
  // MSK: em validação — NÃO entra no score final

  if (valid.length === 0) return null;
  return clamp(mean(valid));
}

/**
 * AuDHD Flags — alertas clínicos da layer
 */
export function evaluateAudhdFlags(metrics: AudhdMetrics): AudhdFlags {
  return {
    rig_alert: metrics.rig.status === "valid" &&
      (metrics.rig.rig_state === "dual_risk" || metrics.rig.rig_severity === "high"),
    msk_experimental: metrics.msk.status === "validation_pending",
  };
}

// ─── Missing Data e Confidence (Bible Anexo G §G4, §G2.7) ─

/**
 * Avalia missing data composto (Bible Anexo G §G4)
 * Regra: ausência de dado NUNCA é tratada como melhora
 */
export function evaluateMissingData(
  coreScore: number | null,
  executiveScore: number | null,
  audhdLayerScore: number | null,
  audhdLayerStatus: AudhdLayerStatus,
  sourceContexts: SourceContexts
): MissingDataInfo {
  const flags: MissingDataFlag[] = [];

  // Verificar contextos missing
  const contextsMissing =
    (sourceContexts.clinical === "missing" ? 1 : 0) +
    (sourceContexts.home === "missing" ? 1 : 0) +
    (sourceContexts.school === "missing" ? 1 : 0);

  if (contextsMissing > 0) {
    flags.push("partial_context");
  }

  // Verificar dados insuficientes
  if (coreScore === null) {
    flags.push("insufficient_data");
  }

  // Verificar layer data missing
  if (audhdLayerStatus !== "off" && audhdLayerScore === null) {
    flags.push("layer_data_missing");
  }

  const primary_flag: MissingDataFlag = flags.length === 0
    ? "none"
    : flags.includes("insufficient_data") ? "insufficient_data"
    : flags.includes("layer_data_missing") ? "layer_data_missing"
    : "partial_context";

  return { primary_flag, flags: flags.length === 0 ? ["none"] : flags };
}

/**
 * Confidence flag (Bible Anexo G §G2.7)
 *
 * high: Core válido, Executive válido, ≥2 contextos presentes, sem missing grave
 * medium: Core válido, Executive parcial, ou 1 contexto, ou Layer com coleta parcial
 * low: Dados insuficientes, Core ausente
 */
export function evaluateConfidence(
  coreScore: number | null,
  executiveScore: number | null,
  sourceContexts: SourceContexts,
  missingData: MissingDataInfo
): ConfidenceFlag {
  if (coreScore === null) return "low";

  const contextsPresent =
    (sourceContexts.clinical === "present" ? 1 : 0) +
    (sourceContexts.home === "present" ? 1 : 0) +
    (sourceContexts.school === "present" ? 1 : 0);

  if (
    executiveScore !== null &&
    contextsPresent >= 2 &&
    missingData.primary_flag === "none"
  ) {
    return "high";
  }

  if (coreScore !== null) {
    return "medium";
  }

  return "low";
}

// ─── Faixa interpretativa (Bible Anexo G §G2.6) ──────

export function getFinalBand(finalScore: number | null): FinalBand {
  if (finalScore === null) return "sem_dados";
  if (finalScore >= 85) return "excelente";
  if (finalScore >= 70) return "bom";
  if (finalScore >= 50) return "atencao";
  return "critico";
}

// ─── Final Score: weighted_available_blocks (Bible Anexo G §G2.5) ─

/**
 * Calcula final_score com renormalização automática dos pesos
 * quando um bloco inteiro está ausente de forma legítima.
 *
 * Prioridade: 1. Core, 2. Executive, 3. AuDHD Layer
 * Se Core faltar: final_score = null, final_band = sem_dados
 */
export function calculateFinalScore(
  coreScore: number | null,
  executiveScore: number | null,
  audhdLayerScore: number | null,
  audhdLayerStatus: AudhdLayerStatus,
  weights: CsoTdahWeights = DEFAULT_WEIGHTS
): number | null {
  // Bible: "final_score só pode ser calculado quando Core estiver disponível"
  if (coreScore === null) return null;

  // Montar blocos disponíveis com pesos
  const blocks: { score: number; weight: number }[] = [];

  blocks.push({ score: coreScore, weight: weights.core });

  if (executiveScore !== null) {
    blocks.push({ score: executiveScore, weight: weights.executive });
  }

  if (audhdLayerStatus !== "off" && audhdLayerScore !== null) {
    blocks.push({ score: audhdLayerScore, weight: weights.audhd });
  }

  // Renormalização: redistribuir pesos proporcionalmente
  const totalWeight = blocks.reduce((acc, b) => acc + b.weight, 0);
  if (totalWeight === 0) return null;

  const finalScore = blocks.reduce(
    (acc, b) => acc + b.score * (b.weight / totalWeight), 0
  );

  return clamp(Math.round(finalScore * 100) / 100);
}

// ─── Entrada do motor (parâmetros de cálculo) ─────────

export interface CsoTdahInput {
  // Camada Base
  activeTargets: TargetScore[];
  masteredTargets: { status: MasteryStatus; score?: number }[];
  promptLevels: PromptLevel[];
  stabilityLevels: StabilityLevel[];
  adherenceScores: number[];

  // Camada Executiva
  exrLevels: ExrLevel[];
  contextScores: number[];

  // Layer AuDHD
  audhdLayerStatus: AudhdLayerStatus;
  senLevels: SenLevel[];
  trfLevels: TrfLevel[];
  rigRecords: RigRecord[];
  mskRecord: MskRecord | null;

  // Contextos
  sourceContexts: SourceContexts;

  // Pesos (opcional — usa default se não fornecido)
  weights?: CsoTdahWeights;
}

// ─── Função principal do motor ────────────────────────

/**
 * computeFullCsoTdah — Calcula CSO-TDAH completo
 *
 * Determinístico: mesma entrada → mesma saída. Sempre.
 * Append-only: o resultado é registrado, nunca reprocessado.
 * Versionado: engine_version congelado no output.
 */
export function computeFullCsoTdah(input: CsoTdahInput): CsoTdahOutput {
  const weights = input.weights ?? DEFAULT_WEIGHTS;

  // ── Bloco 1: Camada Base ─────────────────────────
  const sas = calculateSasTdah(input.activeTargets, input.masteredTargets);
  const pis = calculatePisTdah(input.promptLevels);
  const bss = calculateBssTdah(input.stabilityLevels);
  const tcm = calculateTcmTdah(input.adherenceScores);

  const coreMetrics: CoreMetrics = {
    sas_tdah: { value: sas, status: input.activeTargets.length > 0 || input.masteredTargets.length > 0 ? "valid" : "missing" },
    pis_tdah: { value: pis, status: input.promptLevels.length > 0 ? "valid" : "missing" },
    bss_tdah: { value: bss, status: input.stabilityLevels.length > 0 ? "valid" : "missing" },
    tcm_tdah: { value: tcm, status: input.adherenceScores.length > 0 ? "valid" : "missing" },
  };

  const coreScore = calculateCoreScore(coreMetrics);

  // ── Bloco 2: Camada Executiva ────────────────────
  const exr = calculateExr(input.exrLevels);
  const ctx = calculateCtx(input.contextScores);

  const executiveMetrics: ExecutiveMetrics = {
    exr: { value: exr, status: input.exrLevels.length > 0 ? "valid" : "missing" },
    ctx: { value: ctx, status: input.contextScores.length >= 2 ? "valid" : "missing" },
  };

  const executiveScore = calculateExecutiveScore(executiveMetrics);

  // ── Bloco 3: Layer AuDHD ────────────────────────
  let audhdMetrics: AudhdMetrics | null = null;
  let audhdFlags: AudhdFlags | null = null;
  let audhdLayerScore: number | null = null;

  if (input.audhdLayerStatus !== "off") {
    const sen = calculateSen(input.senLevels);
    const trf = calculateTrf(input.trfLevels);
    const rig = evaluateRig(input.rigRecords);
    const msk: MskRecord = input.mskRecord ?? { value: null, status: "validation_pending" };

    audhdMetrics = {
      sen: { value: sen, status: input.senLevels.length > 0 ? "valid" : "missing" },
      trf: { value: trf, status: input.trfLevels.length > 0 ? "valid" : "missing" },
      rig,
      msk,
    };

    audhdLayerScore = calculateAudhdLayerScore(audhdMetrics);
    audhdFlags = evaluateAudhdFlags(audhdMetrics);
  }

  // ── Missing Data e Confidence ───────────────────
  const missingData = evaluateMissingData(
    coreScore, executiveScore, audhdLayerScore,
    input.audhdLayerStatus, input.sourceContexts
  );

  const confidence = evaluateConfidence(
    coreScore, executiveScore,
    input.sourceContexts, missingData
  );

  // ── Final Score ─────────────────────────────────
  const finalScore = calculateFinalScore(
    coreScore, executiveScore, audhdLayerScore,
    input.audhdLayerStatus, weights
  );

  const finalBand = getFinalBand(finalScore);

  // ── Output (Bible Anexo G §G2.2) ────────────────
  return {
    engine_name: CSO_TDAH_ENGINE_NAME,
    engine_version: CSO_TDAH_ENGINE_VERSION,
    audhd_layer_status: input.audhdLayerStatus,

    core_score: coreScore,
    executive_score: executiveScore,
    audhd_layer_score: audhdLayerScore,
    final_score: finalScore,
    final_band: finalBand,
    confidence_flag: confidence,

    missing_data_primary_flag: missingData.primary_flag,
    missing_data_flags: missingData.flags,
    source_contexts: input.sourceContexts,

    base_metrics: coreMetrics,
    executive_metrics: executiveMetrics,
    audhd_metrics: audhdMetrics,
    audhd_flags: audhdFlags,

    generated_at: new Date().toISOString(),
  };
}
