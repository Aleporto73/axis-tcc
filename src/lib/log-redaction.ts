/**
 * Log Redaction Utility — HUB-01 Onda 8
 *
 * Redige PII (email, CPF, telefone) em logs antes de imprimir.
 * Use em vez de console.log direto quando o objeto/string contém dados sensíveis.
 *
 * Espelho leve de src/lib/sentry-pii.ts, focado em logs de stdout (PM2/journald).
 */

/**
 * Redige email mantendo prefixo curto e domínio.
 * Exemplo: "joao.silva@gmail.com" → "joa***@gmail.com"
 * Email vazio/inválido retorna placeholder seguro.
 */
export function redactEmail(email: string | null | undefined): string {
  if (!email || typeof email !== 'string') return '[no-email]'
  const at = email.indexOf('@')
  if (at < 1) return '[invalid-email]'
  const localPart = email.slice(0, at)
  const domain = email.slice(at + 1)
  const prefix = localPart.slice(0, Math.min(3, localPart.length))
  return `${prefix}***@${domain}`
}

/**
 * Redige CPF mostrando apenas últimos 2 dígitos.
 * Exemplo: "123.456.789-10" → "***.***.***-10"
 */
export function redactCPF(cpf: string | null | undefined): string {
  if (!cpf || typeof cpf !== 'string') return '[no-cpf]'
  const digits = cpf.replace(/\D/g, '')
  if (digits.length < 2) return '[invalid-cpf]'
  return `***.***.***-${digits.slice(-2)}`
}

/**
 * Redige telefone mostrando apenas últimos 4 dígitos.
 * Exemplo: "+55 11 98765-4321" → "***-4321"
 */
export function redactPhone(phone: string | null | undefined): string {
  if (!phone || typeof phone !== 'string') return '[no-phone]'
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 4) return '[invalid-phone]'
  return `***-${digits.slice(-4)}`
}

/**
 * Redige objeto recursivamente, aplicando redactEmail/redactCPF/redactPhone
 * em chaves conhecidas. Outras chaves passam intactas.
 *
 * Use quando precisar logar objeto inteiro (ex: payload de webhook).
 */
const SENSITIVE_KEYS = new Set([
  'email', 'buyer_email', 'buyerEmail', 'user_email', 'userEmail',
  'cpf', 'document', 'documento',
  'phone', 'telefone', 'phone_number', 'phoneNumber',
])

export function redactPII(input: unknown): unknown {
  if (input === null || input === undefined) return input
  if (typeof input === 'string') return input
  if (typeof input !== 'object') return input
  if (Array.isArray(input)) return input.map(redactPII)

  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase()
    if (SENSITIVE_KEYS.has(key) || SENSITIVE_KEYS.has(lowerKey)) {
      if (typeof value === 'string') {
        if (lowerKey.includes('email')) out[key] = redactEmail(value)
        else if (lowerKey.includes('cpf') || lowerKey.includes('document')) out[key] = redactCPF(value)
        else if (lowerKey.includes('phone') || lowerKey.includes('telefone')) out[key] = redactPhone(value)
        else out[key] = '[REDACTED]'
      } else {
        out[key] = '[REDACTED]'
      }
    } else if (typeof value === 'object') {
      out[key] = redactPII(value)
    } else {
      out[key] = value
    }
  }
  return out
}
