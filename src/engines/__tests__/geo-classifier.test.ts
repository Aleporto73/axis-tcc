/**
 * Testes Geo-Classifier Engine — v2.7.0 Sprint 1
 *
 * Cobre: classificação GPS (valid/warning/exception),
 * haversine distance, edge cases, Bible v2.7.0 regras.
 *
 * DETERMINÍSTICO — mesma entrada, mesma saída, sempre.
 */
import { describe, it, expect } from 'vitest'
import { classifyGeoProof, haversineDistance } from '../../lib/geo-classifier'

// ─── classifyGeoProof ─────────────────────────────

describe('Geo Classifier — Bible v2.7.0', () => {

  describe('telehealth', () => {
    it('telehealth → always valid, no flags', () => {
      const result = classifyGeoProof({
        accuracy_meters: null,
        distance_to_site_meters: null,
        site_radius_meters: null,
        service_mode: 'telehealth',
      })
      expect(result.confidence_status).toBe('valid')
      expect(result.exception_reason).toBeNull()
      expect(result.flags).toEqual([])
    })

    it('telehealth → valid even with GPS denied', () => {
      const result = classifyGeoProof({
        accuracy_meters: null,
        distance_to_site_meters: null,
        site_radius_meters: null,
        service_mode: 'telehealth',
        gps_denied: true,
      })
      expect(result.confidence_status).toBe('valid')
    })
  })

  describe('GPS negado', () => {
    it('GPS denied → exception', () => {
      const result = classifyGeoProof({
        accuracy_meters: null,
        distance_to_site_meters: null,
        site_radius_meters: 200,
        service_mode: 'presencial',
        gps_denied: true,
      })
      expect(result.confidence_status).toBe('exception')
      expect(result.exception_reason).toContain('GPS negado')
      expect(result.flags).toContain('MISSING_GEO')
    })

    it('accuracy null (sem GPS) → exception', () => {
      const result = classifyGeoProof({
        accuracy_meters: null,
        distance_to_site_meters: null,
        site_radius_meters: 200,
        service_mode: 'presencial',
      })
      expect(result.confidence_status).toBe('exception')
      expect(result.flags).toContain('MISSING_GEO')
    })
  })

  describe('acurácia', () => {
    it('accuracy <= 50m + distância <= raio → valid', () => {
      const result = classifyGeoProof({
        accuracy_meters: 30,
        distance_to_site_meters: 150,
        site_radius_meters: 200,
        service_mode: 'presencial',
      })
      expect(result.confidence_status).toBe('valid')
      expect(result.flags).toEqual([])
    })

    it('accuracy 50-100m → valid (nota moderada)', () => {
      const result = classifyGeoProof({
        accuracy_meters: 75,
        distance_to_site_meters: 100,
        site_radius_meters: 200,
        service_mode: 'presencial',
      })
      expect(result.confidence_status).toBe('valid')
    })

    it('accuracy 100-500m → warning', () => {
      const result = classifyGeoProof({
        accuracy_meters: 250,
        distance_to_site_meters: 100,
        site_radius_meters: 200,
        service_mode: 'presencial',
      })
      expect(result.confidence_status).toBe('warning')
    })

    it('accuracy > 500m → exception', () => {
      const result = classifyGeoProof({
        accuracy_meters: 600,
        distance_to_site_meters: 50,
        site_radius_meters: 200,
        service_mode: 'presencial',
      })
      expect(result.confidence_status).toBe('exception')
      expect(result.exception_reason).toContain('600m')
    })

    it('accuracy exactly 500m → warning (boundary)', () => {
      const result = classifyGeoProof({
        accuracy_meters: 500,
        distance_to_site_meters: 100,
        site_radius_meters: 200,
        service_mode: 'presencial',
      })
      expect(result.confidence_status).toBe('warning')
    })

    it('accuracy exactly 100m → valid (boundary)', () => {
      const result = classifyGeoProof({
        accuracy_meters: 100,
        distance_to_site_meters: 100,
        site_radius_meters: 200,
        service_mode: 'presencial',
      })
      expect(result.confidence_status).toBe('valid')
    })
  })

  describe('distância e raio', () => {
    it('distância > raio com acurácia boa → warning (OUTSIDE_RADIUS)', () => {
      const result = classifyGeoProof({
        accuracy_meters: 20,
        distance_to_site_meters: 300,
        site_radius_meters: 200,
        service_mode: 'presencial',
      })
      expect(result.confidence_status).toBe('warning')
      expect(result.flags).toContain('OUTSIDE_RADIUS')
    })

    it('distância > raio x 3 → flag UNEXPECTED_LOCATION', () => {
      const result = classifyGeoProof({
        accuracy_meters: 20,
        distance_to_site_meters: 700,
        site_radius_meters: 200,
        service_mode: 'presencial',
      })
      expect(result.flags).toContain('UNEXPECTED_LOCATION')
      expect(result.flags).toContain('OUTSIDE_RADIUS')
    })

    it('sem local declarado (null) → valid (sem comparação)', () => {
      const result = classifyGeoProof({
        accuracy_meters: 30,
        distance_to_site_meters: null,
        site_radius_meters: null,
        service_mode: 'presencial',
      })
      expect(result.confidence_status).toBe('valid')
    })
  })

  describe('modos de serviço', () => {
    it('domiciliar com boa acurácia → valid', () => {
      const result = classifyGeoProof({
        accuracy_meters: 25,
        distance_to_site_meters: 50,
        site_radius_meters: 200,
        service_mode: 'domiciliar',
      })
      expect(result.confidence_status).toBe('valid')
    })

    it('escolar com boa acurácia → valid', () => {
      const result = classifyGeoProof({
        accuracy_meters: 40,
        distance_to_site_meters: 80,
        site_radius_meters: 300,
        service_mode: 'escolar',
      })
      expect(result.confidence_status).toBe('valid')
    })
  })
})

// ─── haversineDistance ──────────────────────────────

describe('Haversine Distance', () => {
  it('mesma coordenada → distância 0', () => {
    const d = haversineDistance(-23.5505, -46.6333, -23.5505, -46.6333)
    expect(d).toBe(0)
  })

  it('SP centro → SP Paulista ≈ 2-4km', () => {
    // Praça da Sé → Av. Paulista
    const d = haversineDistance(-23.5505, -46.6333, -23.5613, -46.6560)
    expect(d).not.toBeNull()
    expect(d!).toBeGreaterThan(2000)
    expect(d!).toBeLessThan(4000)
  })

  it('null lat1 → null', () => {
    expect(haversineDistance(null, -46.6333, -23.5613, -46.6560)).toBeNull()
  })

  it('null lon2 → null', () => {
    expect(haversineDistance(-23.5505, -46.6333, -23.5613, null)).toBeNull()
  })

  it('todos null → null', () => {
    expect(haversineDistance(null, null, null, null)).toBeNull()
  })

  it('distância grande — SP → RJ ≈ 350-400km', () => {
    const d = haversineDistance(-23.5505, -46.6333, -22.9068, -43.1729)
    expect(d!).toBeGreaterThan(350000)
    expect(d!).toBeLessThan(400000)
  })

  it('retorna valor com precisão de 2 decimais', () => {
    const d = haversineDistance(-23.5505, -46.6333, -23.5510, -46.6340)
    expect(d).not.toBeNull()
    const decimals = d!.toString().split('.')[1]
    expect(!decimals || decimals.length <= 2).toBe(true)
  })
})
