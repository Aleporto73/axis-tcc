import pool from '../database/db';
import { ClinicalState, Suggestion, SuggestionType } from '../types';

/**
 * Gera sugestoes baseadas no CSO atual
 * REGRA: Apenas 1 sugestao por ciclo (prioridade)
 */
export async function generateSuggestions(cso: ClinicalState): Promise<Suggestion | null> {
  const candidateSuggestions = await evaluateRules(cso);

  if (candidateSuggestions.length === 0) {
    return null;
  }

  candidateSuggestions.sort((a, b) => b.priority - a.priority);
  const topSuggestion = candidateSuggestions[0];

  const insertQuery = `
    INSERT INTO suggestions (
      tenant_id, patient_id, cso_id, type, title, reason,
      confidence, context, engine_version, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    RETURNING *
  `;

  const result = await pool.query(insertQuery, [
    cso.tenant_id,
    cso.patient_id,
    cso.id,
    topSuggestion.type,
    topSuggestion.title,
    topSuggestion.reason,
    topSuggestion.confidence,
    JSON.stringify(topSuggestion.context),
    'SUGGESTION_ENGINE_v2.1'
  ]);

  return result.rows[0];
}

/**
 * Avalia todas as regras de sugestao
 */
async function evaluateRules(cso: any): Promise<SuggestionCandidate[]> {
  const suggestions: SuggestionCandidate[] = [];

  // REGRA 1: CRISIS_PROTOCOL (Prioridade maxima)
  if (cso.risk_flags && cso.risk_flags.includes('CRISIS_ALERT')) {
    suggestions.push({
      type: 'CRISIS_PROTOCOL',
      title: 'Protocolo de Crise Ativado',
      reason: ['Alerta de crise detectado'],
      confidence: 0.95,
      priority: 10,
      context: { risk_flags: cso.risk_flags }
    });
  }

  // REGRA 2: PAUSE_EXPOSURE (Alta prioridade)
  if (cso.emotional_load && cso.emotional_load > 0.8 && cso.activation_level && cso.activation_level > 0.75) {
    suggestions.push({
      type: 'PAUSE_EXPOSURE',
      title: 'Pausar Exposicao Temporariamente',
      reason: [
        'Carga emocional muito alta (>0.8)',
        'Nivel de ativacao elevado (>0.75)',
        'Risco de sobrecarga do paciente'
      ],
      confidence: 0.88,
      priority: 9,
      context: { emotional_load: cso.emotional_load, activation_level: cso.activation_level }
    });
  }

  // REGRA 3: CHECK_ADHERENCE (Alta prioridade)
  if (cso.task_adherence !== null && cso.task_adherence < 0.3) {
    suggestions.push({
      type: 'CHECK_ADHERENCE',
      title: 'Verificar Aderencia as Tarefas',
      reason: [
        'Aderencia muito baixa (<0.3)',
        'Paciente pode estar desmotivado ou sobrecarregado'
      ],
      confidence: 0.85,
      priority: 8,
      context: { task_adherence: cso.task_adherence }
    });
  }

  // REGRA 4: FLEXIBILIDADE EM QUEDA (Alta prioridade - 3a Onda)
  if (cso.flex_trend === 'down' && cso.recovery_time !== null && cso.recovery_time === 0) {
    suggestions.push({
      type: 'PAUSE_EXPOSURE',
      title: 'Flexibilidade em Queda - Avaliar Ritmo',
      reason: [
        'Tendencia de flexibilidade em queda',
        'Paciente apresentou mais evitacao que enfrentamento',
        'Considerar reducao temporaria de demandas'
      ],
      confidence: 0.82,
      priority: 8,
      context: { flex_trend: cso.flex_trend, recovery_time: cso.recovery_time }
    });
  }

  // REGRA 5: SIMPLIFY_TASK (Media prioridade)
  if (cso.task_adherence !== null && cso.task_adherence >= 0.3 && cso.task_adherence < 0.5) {
    suggestions.push({
      type: 'SIMPLIFY_TASK',
      title: 'Simplificar Tarefas',
      reason: [
        'Aderencia moderadamente baixa (0.3-0.5)',
        'Tarefas podem estar muito dificeis'
      ],
      confidence: 0.75,
      priority: 6,
      context: { task_adherence: cso.task_adherence }
    });
  }

  // REGRA 6: COGNITIVE_INTERVENTION (Media prioridade)
  if (cso.cognitive_rigidity && cso.cognitive_rigidity > 0.7) {
    suggestions.push({
      type: 'COGNITIVE_INTERVENTION',
      title: 'Intervencao Cognitiva Indicada',
      reason: [
        'Rigidez cognitiva elevada (>0.7)',
        'Paciente pode estar preso em padroes rigidos de pensamento'
      ],
      confidence: 0.78,
      priority: 7,
      context: { cognitive_rigidity: cso.cognitive_rigidity }
    });
  }

  // REGRA 7: EMOTIONAL_REGULATION (Media prioridade)
  if (cso.emotional_load && cso.emotional_load > 0.6 && cso.emotional_load <= 0.8) {
    suggestions.push({
      type: 'EMOTIONAL_REGULATION',
      title: 'Trabalhar Regulacao Emocional',
      reason: [
        'Carga emocional elevada (0.6-0.8)',
        'Tecnicas de regulacao podem ajudar'
      ],
      confidence: 0.72,
      priority: 6,
      context: { emotional_load: cso.emotional_load }
    });
  }

  // REGRA 8: RECUPERACAO POSITIVA (Media prioridade - 3a Onda)
  if (cso.flex_trend === 'up' && cso.recovery_time !== null && cso.recovery_time >= 3) {
    suggestions.push({
      type: 'CELEBRATE_PROGRESS',
      title: 'Padrao de Recuperacao Positivo',
      reason: [
        'Flexibilidade em alta por ' + cso.recovery_time + ' sessoes',
        'Paciente demonstra capacidade de enfrentamento consistente',
        'Reforco positivo do processo e importante'
      ],
      confidence: 0.85,
      priority: 5,
      context: { flex_trend: cso.flex_trend, recovery_time: cso.recovery_time }
    });
  }

  // REGRA 9: CELEBRATE_PROGRESS (Baixa prioridade)
  if (cso.task_adherence && cso.task_adherence > 0.8) {
    suggestions.push({
      type: 'CELEBRATE_PROGRESS',
      title: 'Celebrar Progresso do Paciente',
      reason: [
        'Aderencia excelente (>0.8)',
        'Reforco positivo e importante'
      ],
      confidence: 0.9,
      priority: 4,
      context: { task_adherence: cso.task_adherence }
    });
  }

  // REGRA 10: ADJUST_PACE (Baixa prioridade)
  if (cso.sessions_in_phase > 8 && cso.treatment_phase === 'exposicao') {
    suggestions.push({
      type: 'ADJUST_PACE',
      title: 'Revisar Ritmo do Tratamento',
      reason: [
        'Paciente ha ' + cso.sessions_in_phase + ' sessoes na mesma fase',
        'Pode estar pronto para avancar ou precisa de ajuste'
      ],
      confidence: 0.68,
      priority: 5,
      context: { sessions_in_phase: cso.sessions_in_phase, treatment_phase: cso.treatment_phase }
    });
  }

  // REGRA 11: BRIDGE_TO_LAST (Baixa prioridade)
  if (cso.engagement_trend === 'declining') {
    suggestions.push({
      type: 'BRIDGE_TO_LAST',
      title: 'Fazer Ponte com Sessao Anterior',
      reason: [
        'Engajamento em declinio',
        'Reconectar com conteudo da ultima sessao pode ajudar'
      ],
      confidence: 0.65,
      priority: 4,
      context: { engagement_trend: cso.engagement_trend }
    });
  }

  // REGRA 12: FLEXIBILIDADE FLAT PROLONGADA (Baixa prioridade - 3a Onda)
  if (cso.flex_trend === 'flat' && cso.recovery_time !== null && cso.recovery_time >= 5) {
    suggestions.push({
      type: 'ADJUST_PACE',
      title: 'Flexibilidade Estagnada - Revisar Estrategia',
      reason: [
        'Flexibilidade sem mudanca por ' + cso.recovery_time + ' sessoes',
        'Paciente pode estar em zona de conforto',
        'Considerar introducao gradual de novos desafios'
      ],
      confidence: 0.7,
      priority: 4,
      context: { flex_trend: cso.flex_trend, recovery_time: cso.recovery_time }
    });
  }

  return suggestions;
}

/**
 * Tipo auxiliar para candidatos a sugestao
 */
interface SuggestionCandidate {
  type: SuggestionType;
  title: string;
  reason: string[];
  confidence: number;
  priority: number;
  context: Record<string, any>;
}
