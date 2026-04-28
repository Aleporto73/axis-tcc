import { timingSafeEqual } from 'crypto'

/**
 * Valida header Authorization contra CRON_SECRET (e opcional CRON_SECRET_OLD)
 * em tempo constante. Suporta dual-secret durante rotacao.
 *
 * Retorna false se: header ausente, nao comeca com "Bearer ",
 * ou token nao casa com nenhum segredo valido.
 */
export function isValidCronAuth(
  authHeader: string | null,
  currentSecret: string,
  oldSecret?: string
): boolean {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false
  const providedToken = authHeader.slice('Bearer '.length)
  const providedBuf = Buffer.from(providedToken)

  // Tenta segredo atual
  const currentBuf = Buffer.from(currentSecret)
  if (providedBuf.length === currentBuf.length && timingSafeEqual(providedBuf, currentBuf)) {
    return true
  }

  // Tenta segredo antigo (se fornecido)
  if (oldSecret) {
    const oldBuf = Buffer.from(oldSecret)
    if (providedBuf.length === oldBuf.length && timingSafeEqual(providedBuf, oldBuf)) {
      return true
    }
  }

  return false
}
