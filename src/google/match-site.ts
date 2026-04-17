// =====================================================
// AXIS ABA — Google Calendar → service_sites matcher
//
// Usado pelo sync manual (/api/aba/google/sync) e webhook
// automático (/api/aba/google/webhook) para popular
// declared_site_id + service_mode em sessões importadas
// via Google Calendar.
//
// Sem match → campos ficam NULL (scanner de integridade
// flaga MISSING_GEO, comportamento esperado).
//
// Ref: NOTE_ABA.md — "Bug GCal sync ABA" (17/04/2026).
// =====================================================

import { PoolClient } from 'pg'

/**
 * Deriva o `service_mode` canônico a partir do `site_type`.
 * Fonte única de verdade — usar sempre que precisar dessa conversão
 * (nova sessão manual, sync GCal, webhook).
 */
export function deriveServiceMode(siteType: string): string {
  switch (siteType) {
    case 'home': return 'domiciliar'
    case 'school': return 'escolar'
    case 'telehealth': return 'telehealth'
    case 'clinic':
    case 'community':
    case 'other':
    default:
      return 'presencial'
  }
}

export interface MatchedSite {
  site_id: string
  service_mode: string
  site_name: string
}

/**
 * Tenta encontrar um service_site ativo do tenant cujo nome
 * case com a string `location` do evento GCal.
 *
 * Heurística: ILIKE bidirecional para casar tanto
 *   - "Clínica Axis" (cadastrado) ⊆ "Clínica Axis - Sala 2" (GCal), quanto
 *   - "Clínica Axis - Sala 2" (cadastrado) ⊇ "Clínica Axis" (GCal).
 *
 * Empate → pega o mais específico (LENGTH maior).
 *
 * Retorna null se:
 *   - location vazia/null/undefined
 *   - nenhum site ativo casa
 *
 * NÃO tenta match por endereço físico — `address_encrypted` está
 * em pgcrypto e não permite ILIKE em massa.
 */
export async function matchSiteByLocation(
  client: PoolClient,
  tenantId: string,
  eventLocation: string | null | undefined
): Promise<MatchedSite | null> {
  if (!eventLocation || eventLocation.trim().length === 0) return null

  const needle = eventLocation.trim()
  const result = await client.query(
    `SELECT id, site_name, site_type
     FROM service_sites
     WHERE tenant_id = $1
       AND is_active = true
       AND (site_name ILIKE $2 OR $2 ILIKE '%' || site_name || '%')
     ORDER BY LENGTH(site_name) DESC
     LIMIT 1`,
    [tenantId, `%${needle}%`]
  )

  if (result.rows.length === 0) return null

  const site = result.rows[0]
  return {
    site_id: site.id,
    service_mode: deriveServiceMode(site.site_type),
    site_name: site.site_name,
  }
}
