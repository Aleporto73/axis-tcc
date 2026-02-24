import pool from '../database/db';
import { ClinicalState, Event } from '../types';
import crypto from 'crypto';
import { z } from 'zod';

// Schema de validação do evento
const EventSchema = z.object({
  id: z.string().optional(),
  tenant_id: z.string().min(1, 'tenant_id obrigatório'),
  patient_id: z.string().min(1, 'patient_id obrigatório'),
  event_type: z.string().min(1, 'event_type obrigatório'),
  payload: z.record(z.string(), z.any()).optional().default({}),
  source: z.string().nullable().optional(),
  related_entity_id: z.string().nullable().optional(),
  created_at: z.date().optional(),
});

// Valida evento com Zod
function validateEvent(event: any): { success: boolean; data?: Event; error?: string } {
  try {
    const parsed = EventSchema.parse(event);
    return { success: true, data: parsed as Event };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Versão do motor CSO - atualizar a cada mudança significativa
export const CSO_ENGINE_VERSION = '3.0.0';

/**
 * Garante que o valor fique entre 0 e 1
 */
function clamp(value: number | null | undefined, min = 0, max = 1): number | null {
  if (value === null || value === undefined) return null;
  return Math.max(min, Math.min(max, value));
}

/**
 * Gera hash SHA256 do evento para anti-duplicidade
 */
function generateEventHash(event: Event): string {
  const data = `${event.tenant_id}:${event.patient_id}:${event.event_type}:${event.related_entity_id || ''}:${JSON.stringify(event.payload || {})}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Verifica se evento já foi processado (anti-duplicidade)
 */
async function isEventAlreadyProcessed(eventHash: string): Promise<boolean> {
  const result = await pool.query(
    'SELECT id FROM clinical_states WHERE event_hash = $1 LIMIT 1',
    [eventHash]
  );
  return result.rows.length > 0;
}

/**
 * Processa um evento e atualiza (ou cria) o Clinical State Object
 * REGRA: SEMPRE INSERT, NUNCA UPDATE (append-only)
 */
export async function processEvent(event: Event): Promise<ClinicalState | null> {
  console.log('[CSO] Processando evento:', event.event_type);

  // Validação com Zod
  const validation = validateEvent(event);
  if (!validation.success) {
    console.error('[CSO] Evento inválido (Zod):', validation.error);
    return null;
  }

  // Anti-duplicidade via hash
  const eventHash = generateEventHash(event);
  const alreadyProcessed = await isEventAlreadyProcessed(eventHash);
  
  if (alreadyProcessed) {
    console.log('[CSO] Evento já processado (hash duplicado), ignorando:', eventHash.substring(0, 16));
    return null;
  }

  const lastCSOQuery = `
    SELECT * FROM clinical_states 
    WHERE patient_id = $1 
    ORDER BY created_at DESC 
    LIMIT 1
  `;

  const result = await pool.query(lastCSOQuery, [event.patient_id]);
  const lastCSO = result.rows[0] || null;

  const newCSO = calculateNewCSO(lastCSO, event);

  if (newCSO.system_confidence && newCSO.system_confidence < 0.6) {
    console.log('[CSO] GATE DE SILENCIO: Confianca muito baixa, nao gerando CSO');
    return null;
  }

  const insertQuery = `
    INSERT INTO clinical_states (
      tenant_id, patient_id, cso_version, clinical_phase,
      activation_level, activation_confidence,
      emotional_load, emotional_confidence,
      task_adherence, adherence_confidence,
      system_confidence, source_event,
      flex_trend, recovery_time, event_hash
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    RETURNING *
  `;

  const insertResult = await pool.query(insertQuery, [
    newCSO.tenant_id,
    newCSO.patient_id,
    CSO_ENGINE_VERSION,
    newCSO.clinical_phase,
    clamp(newCSO.activation_level),
    clamp(newCSO.activation_confidence),
    clamp(newCSO.emotional_load),
    clamp(newCSO.emotional_confidence),
    clamp(newCSO.task_adherence),
    clamp(newCSO.adherence_confidence),
    clamp(newCSO.system_confidence),
    event.event_type,
    newCSO.flex_trend || 'flat',
    newCSO.recovery_time || null,
    eventHash
  ]);

  console.log('[CSO] Novo CSO criado:', insertResult.rows[0].id, '| Versão:', CSO_ENGINE_VERSION);
  return insertResult.rows[0];
}

/**
 * Calcula o novo CSO baseado no ultimo CSO e no evento
 */
function calculateNewCSO(lastCSO: any, event: Event): any {
  const newCSO: any = {
    tenant_id: event.tenant_id,
    patient_id: event.patient_id,
    clinical_phase: lastCSO?.clinical_phase || 'avaliacao',
    activation_level: lastCSO?.activation_level || null,
    activation_confidence: lastCSO?.activation_confidence || null,
    emotional_load: lastCSO?.emotional_load || null,
    emotional_confidence: lastCSO?.emotional_confidence || null,
    task_adherence: lastCSO?.task_adherence || null,
    adherence_confidence: lastCSO?.adherence_confidence || null,
    system_confidence: 0.5,
    flex_trend: lastCSO?.flex_trend || 'flat',
    recovery_time: lastCSO?.recovery_time || null,
  };

  switch (event.event_type) {
    case 'SESSION_END': {
      const payload = event.payload || {};
      const micro = payload.micro_events || {};
      const confrontations = micro.confrontations || 0;
      const avoidances = micro.avoidances || 0;
      const adjustments = micro.adjustments || 0;
      const recoveries = micro.recoveries || 0;
      const total = confrontations + avoidances + adjustments + recoveries;

      if (total > 0) {
        const positiveRatio = (confrontations + adjustments + recoveries) / total;
        if (positiveRatio >= 0.6) newCSO.flex_trend = 'up';
        else if (positiveRatio <= 0.3) newCSO.flex_trend = 'down';
        else newCSO.flex_trend = 'flat';
      } else {
        newCSO.flex_trend = payload.flex_trend || lastCSO?.flex_trend || 'flat';
      }

      if (avoidances > confrontations) {
        newCSO.recovery_time = 0;
      } else if (lastCSO?.recovery_time !== null && lastCSO?.recovery_time !== undefined) {
        newCSO.recovery_time = (lastCSO.recovery_time || 0) + 1;
      } else {
        newCSO.recovery_time = 1;
      }

      if (payload.has_tcc_analysis && payload.emotions_count > 0) {
        const emotionWeight = Math.min(payload.emotions_count / 5, 1.0);
        newCSO.emotional_load = Math.max(emotionWeight, lastCSO?.emotional_load || 0);
        newCSO.emotional_confidence = 0.8;
      }

      if (payload.duration_minutes) {
        if (payload.duration_minutes >= 40 && payload.duration_minutes <= 60) {
          newCSO.activation_level = (lastCSO?.activation_level || 0.5) + 0.05;
        } else if (payload.duration_minutes < 20) {
          newCSO.activation_level = (lastCSO?.activation_level || 0.5) - 0.1;
        }
        newCSO.activation_confidence = 0.7;
      }

      newCSO.system_confidence = total > 0 ? 0.85 : 0.75;
      break;
    }

    case 'AVOIDANCE_OBSERVED': {
      const intensity = event.payload?.intensity || 0.5;
      newCSO.emotional_load = (lastCSO?.emotional_load || 0.5) + (intensity * 0.15);
      newCSO.emotional_confidence = 0.8;
      newCSO.flex_trend = 'down';
      newCSO.recovery_time = 0;
      newCSO.system_confidence = 0.8;
      break;
    }

    case 'CONFRONTATION_OBSERVED': {
      const intensity = event.payload?.intensity || 0.5;
      newCSO.activation_level = (lastCSO?.activation_level || 0.5) + (intensity * 0.1);
      newCSO.activation_confidence = 0.85;
      newCSO.flex_trend = 'up';
      if (lastCSO?.recovery_time !== null) {
        newCSO.recovery_time = (lastCSO?.recovery_time || 0) + 1;
      }
      newCSO.system_confidence = 0.85;
      break;
    }

    case 'ADJUSTMENT_OBSERVED': {
      newCSO.task_adherence = (lastCSO?.task_adherence || 0.5) + 0.1;
      newCSO.adherence_confidence = 0.8;
      newCSO.flex_trend = 'up';
      newCSO.system_confidence = 0.8;
      break;
    }

    case 'RECOVERY_OBSERVED': {
      const intensity = event.payload?.intensity || 0.5;
      newCSO.emotional_load = (lastCSO?.emotional_load || 0.5) - (intensity * 0.15);
      newCSO.emotional_confidence = 0.85;
      newCSO.flex_trend = 'up';
      if (lastCSO?.recovery_time !== null) {
        newCSO.recovery_time = (lastCSO?.recovery_time || 0) + 1;
      }
      newCSO.system_confidence = 0.85;
      break;
    }

    case 'TASK_COMPLETED':
      newCSO.task_adherence = (lastCSO?.task_adherence || 0.5) + 0.1;
      newCSO.adherence_confidence = 0.9;
      newCSO.system_confidence = 0.85;
      break;

    case 'TASK_INCOMPLETE':
      newCSO.task_adherence = (lastCSO?.task_adherence || 0.5) - 0.15;
      newCSO.adherence_confidence = 0.9;
      newCSO.system_confidence = 0.85;
      break;

    case 'MOOD_CHECK': {
      const moodRating = event.payload?.mood_rating;
      if (moodRating !== undefined) {
        newCSO.emotional_load = 1 - (moodRating / 10);
        newCSO.emotional_confidence = 0.95;
        newCSO.system_confidence = 0.9;
      }
      break;
    }

    default:
      newCSO.system_confidence = 0.4;
  }

  return newCSO;
}
