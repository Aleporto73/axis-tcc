/**
 * Testes Crypto Helper — v2.7.0 Sprint 0
 *
 * Cobre: encryptParam SQL generation, decryptColumn SQL generation,
 * getKeyParam, isCryptoAvailable, falha sem chave.
 *
 * Nota: Estes testes validam a geração de SQL e o gate de chave.
 * A criptografia real (pgcrypto) é testada em integração com o banco.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { encryptParam, decryptColumn, getKeyParam, isCryptoAvailable } from '../../lib/crypto'

describe('Crypto Helper — v2.7.0', () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...ORIGINAL_ENV }
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  // ─── encryptParam ───────────────────────────────

  describe('encryptParam', () => {
    it('gera SQL correto para paramIndex=1', () => {
      const result = encryptParam(1)
      expect(result.encryptSQL).toBe('pgp_sym_encrypt($1::text, $2)')
      expect(result.keyParamIndex).toBe(2)
    })

    it('gera SQL correto para paramIndex=7', () => {
      const result = encryptParam(7)
      expect(result.encryptSQL).toBe('pgp_sym_encrypt($7::text, $8)')
      expect(result.keyParamIndex).toBe(8)
    })

    it('keyParamIndex é sempre paramIndex + 1', () => {
      for (const idx of [1, 3, 5, 10, 20]) {
        const result = encryptParam(idx)
        expect(result.keyParamIndex).toBe(idx + 1)
      }
    })
  })

  // ─── decryptColumn ──────────────────────────────

  describe('decryptColumn', () => {
    it('gera SQL correto para coluna e alias', () => {
      const sql = decryptColumn('address_encrypted', 'address', 1)
      expect(sql).toBe('pgp_sym_decrypt(address_encrypted, $1) as address')
    })

    it('funciona com diferentes paramIndex', () => {
      const sql = decryptColumn('ip_address', 'ip', 5)
      expect(sql).toBe('pgp_sym_decrypt(ip_address, $5) as ip')
    })
  })

  // ─── getKeyParam ────────────────────────────────

  describe('getKeyParam', () => {
    it('retorna a chave quando definida (>= 16 chars)', () => {
      process.env.AXIS_ENCRYPTION_KEY = 'my-secret-key-that-is-long-enough'
      const key = getKeyParam()
      expect(key).toBe('my-secret-key-that-is-long-enough')
    })

    it('lança erro quando chave não definida', () => {
      delete process.env.AXIS_ENCRYPTION_KEY
      expect(() => getKeyParam()).toThrow('AXIS_ENCRYPTION_KEY')
    })

    it('lança erro quando chave muito curta (<16 chars)', () => {
      process.env.AXIS_ENCRYPTION_KEY = 'short'
      expect(() => getKeyParam()).toThrow('muito curta')
    })

    it('lança erro quando chave é string vazia', () => {
      process.env.AXIS_ENCRYPTION_KEY = ''
      expect(() => getKeyParam()).toThrow('AXIS_ENCRYPTION_KEY')
    })
  })

  // ─── isCryptoAvailable ──────────────────────────

  describe('isCryptoAvailable', () => {
    it('retorna true quando chave válida', () => {
      process.env.AXIS_ENCRYPTION_KEY = 'a-valid-key-with-16chars'
      expect(isCryptoAvailable()).toBe(true)
    })

    it('retorna false quando chave não definida', () => {
      delete process.env.AXIS_ENCRYPTION_KEY
      expect(isCryptoAvailable()).toBe(false)
    })

    it('retorna false quando chave muito curta', () => {
      process.env.AXIS_ENCRYPTION_KEY = 'abc'
      expect(isCryptoAvailable()).toBe(false)
    })
  })
})
