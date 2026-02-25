// =====================================================
// AXIS — Google Calendar Shared Helpers
// Conforme AXIS ABA Bible v2.6.1 S19:
//   "AXIS ↔ Google: Criar/atualizar/remover eventos"
//   "Google ↔ AXIS: Sincronizar via webhook"
//
// Reutilizado por TCC (solo) e ABA (multi-terapeuta).
// Em ABA, cada terapeuta conecta seu próprio Gmail.
// Tokens salvos por profile_id na calendar_connections.
// =====================================================

import { PoolClient } from 'pg'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!

/**
 * Renova access_token usando refresh_token.
 * Retorna novo access_token ou null se falhar.
 */
export async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!response.ok) return null
  const data = await response.json()
  return data.access_token
}

/**
 * Garante access_token válido para uma conexão.
 * Se expirado, renova e atualiza no banco.
 * Retorna access_token ou null se falhar.
 */
export async function ensureValidToken(
  client: PoolClient,
  conn: { id: string; access_token: string; refresh_token: string; token_expiry: string }
): Promise<string | null> {
  if (new Date(conn.token_expiry) > new Date()) {
    return conn.access_token
  }

  const newToken = await refreshAccessToken(conn.refresh_token)
  if (!newToken) return null

  await client.query(
    `UPDATE calendar_connections
     SET access_token = $1, token_expiry = $2, updated_at = NOW()
     WHERE id = $3`,
    [newToken, new Date(Date.now() + 3600 * 1000), conn.id]
  )

  return newToken
}

/**
 * Extrai resposta do convidado (paciente/responsável) de um evento Google.
 */
export function getAttendeeResponse(attendees: any[], targetEmail: string): string {
  if (!attendees || !targetEmail) return 'needsAction'
  const attendee = attendees.find((a: any) => a.email === targetEmail && !a.self)
  if (!attendee) return 'needsAction'
  return attendee.responseStatus || 'needsAction'
}

/**
 * Calcula duração em minutos entre duas datas ISO.
 */
export function calcDurationMinutes(startIso: string, endIso: string): number {
  return Math.round(
    (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000
  )
}

/**
 * Scopes necessários para Google Calendar + email.
 */
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ')
