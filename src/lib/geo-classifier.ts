// =====================================================
// AXIS ABA - GPS Classification Engine (v2.7.0)
// Ref: skill_axis_aba_v270.md — Regras de classificação
//
// Classifica a qualidade da prova de presença GPS
// baseado na acurácia e distância ao local declarado.
//
// DETERMINÍSTICO — mesma entrada, mesma saída, sempre.
// Não faz decisão clínica — apenas classifica dados.
// =====================================================

export type ConfidenceStatus = 'valid' | 'warning' | 'exception'

export interface GeoClassificationInput {
  accuracy_meters: number | null
  distance_to_site_meters: number | null
  site_radius_meters: number | null
  service_mode: string
  gps_denied?: boolean
}

export interface GeoClassificationResult {
  confidence_status: ConfidenceStatus
  exception_reason: string | null
  flags: string[]
}

/**
 * Classifica a prova de presença GPS conforme Bible v2.7.0.
 *
 * Regras (em ordem de prioridade):
 * 1. telehealth → valid sem geo
 * 2. GPS negado → exception (obrigatório informar motivo)
 * 3. accuracy > 500m → exception
 * 4. accuracy 100-500m → warning
 * 5. accuracy <= 100m E distância <= raio → valid
 * 6. accuracy <= 50m E distância <= raio → valid
 * 7. Distância > raio x 3 → flag UNEXPECTED_LOCATION
 */
export function classifyGeoProof(input: GeoClassificationInput): GeoClassificationResult {
  const flags: string[] = []

  // Telehealth: sem necessidade de geo
  if (input.service_mode === 'telehealth') {
    return {
      confidence_status: 'valid',
      exception_reason: null,
      flags: [],
    }
  }

  // GPS negado pelo usuário
  if (input.gps_denied || input.accuracy_meters === null) {
    return {
      confidence_status: 'exception',
      exception_reason: input.gps_denied ? 'GPS negado pelo dispositivo' : 'Dados GPS indisponíveis',
      flags: ['MISSING_GEO'],
    }
  }

  const accuracy = input.accuracy_meters
  const distance = input.distance_to_site_meters
  const radius = input.site_radius_meters

  // Verificar localização inesperada
  if (distance !== null && radius !== null && distance > radius * 3) {
    flags.push('UNEXPECTED_LOCATION')
  }

  // Acurácia > 500m → exception
  if (accuracy > 500) {
    return {
      confidence_status: 'exception',
      exception_reason: `Acurácia GPS muito baixa (${Math.round(accuracy)}m). Justificativa obrigatória.`,
      flags,
    }
  }

  // Acurácia 100-500m → warning
  if (accuracy > 100) {
    return {
      confidence_status: 'warning',
      exception_reason: null,
      flags,
    }
  }

  // Acurácia <= 100m — verificar distância
  if (distance !== null && radius !== null && distance > radius) {
    // Dentro da acurácia aceitável mas fora do raio
    flags.push('OUTSIDE_RADIUS')
    return {
      confidence_status: 'warning',
      exception_reason: null,
      flags,
    }
  }

  // Tudo OK
  return {
    confidence_status: 'valid',
    exception_reason: null,
    flags,
  }
}

/**
 * Calcula distância entre dois pontos em metros (fórmula de Haversine).
 * Retorna null se qualquer coordenada for null.
 */
export function haversineDistance(
  lat1: number | null,
  lon1: number | null,
  lat2: number | null,
  lon2: number | null
): number | null {
  if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) {
    return null
  }

  const R = 6371000 // raio da Terra em metros
  const toRad = (deg: number) => (deg * Math.PI) / 180

  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return Math.round(R * c * 100) / 100 // 2 decimais
}
