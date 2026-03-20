// =====================================================
// AXIS ABA - Crypto Helper (pgcrypto)
// Ref: skill_axis_aba_v270.md — Segurança
//
// Criptografia simétrica via pgp_sym_encrypt/decrypt
// Chave: env var AXIS_ENCRYPTION_KEY
// Decrypt SÓ no backend, NUNCA no cliente
//
// Colunas criptografadas:
//   - service_sites.address_encrypted
//   - session_presence_proofs: lat/long, IP
//   - session_attestations: IP, canvas_data
//   - session_attachments: extracted_geo
//
// Colunas em claro (queries/filtros):
//   - confidence_status, distance, accuracy
//   - site_type, radius, geo_level
// =====================================================

/**
 * Retorna a chave de criptografia do ambiente.
 * Lança erro se não configurada (fail-fast).
 */
function getEncryptionKey(): string {
  const key = process.env.AXIS_ENCRYPTION_KEY
  if (!key || key.length < 16) {
    throw new Error(
      'AXIS_ENCRYPTION_KEY não configurada ou muito curta (min 16 chars). ' +
      'Defina no .env antes de usar features da camada operadora.'
    )
  }
  return key
}

/**
 * SQL fragment para criptografar um valor no INSERT/UPDATE.
 * Uso: `pgp_sym_encrypt($1::text, $2)` onde $2 é a chave.
 *
 * @example
 * const { encryptSQL, keyParam } = encryptParam(3) // paramIndex=3
 * // Gera: pgp_sym_encrypt($3::text, $4)
 * // params: [..., valorParaCriptografar, chave]
 */
export function encryptParam(paramIndex: number): {
  encryptSQL: string
  keyParamIndex: number
} {
  return {
    encryptSQL: `pgp_sym_encrypt($${paramIndex}::text, $${paramIndex + 1})`,
    keyParamIndex: paramIndex + 1,
  }
}

/**
 * SQL fragment para descriptografar um campo no SELECT.
 * Uso em query: `pgp_sym_decrypt(column, $1) as alias`
 *
 * @example
 * const sql = decryptColumn('address_encrypted', 'address', 1)
 * // Gera: pgp_sym_decrypt(address_encrypted, $1) as address
 */
export function decryptColumn(
  column: string,
  alias: string,
  keyParamIndex: number
): string {
  return `pgp_sym_decrypt(${column}, $${keyParamIndex}) as ${alias}`
}

/**
 * Retorna a chave como parâmetro para queries.
 * Uso: adicionar ao array de params da query.
 *
 * @example
 * const params = [tenantId, siteId, address, getKeyParam()]
 * // query usa: pgp_sym_encrypt($3::text, $4)
 */
export function getKeyParam(): string {
  return getEncryptionKey()
}

/**
 * Verifica se a chave de criptografia está disponível.
 * Não lança erro — retorna boolean.
 * Útil para gates de feature.
 */
export function isCryptoAvailable(): boolean {
  try {
    getEncryptionKey()
    return true
  } catch {
    return false
  }
}
