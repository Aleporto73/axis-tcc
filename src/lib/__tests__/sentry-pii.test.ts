// src/lib/__tests__/sentry-pii.test.ts
//
// Testes unitários para src/lib/sentry-pii.ts
// Cobre: SENSITIVE_KEYS coverage + redactKeys recursivo + piiBeforeSend transformations.
//
// Item 29 carry-forward — Item 10-tris (Sentry PII redaction unificada).
// 22 testes em 3 describe blocks: SENSITIVE_KEYS / redactKeys / piiBeforeSend.

import { describe, it, expect } from 'vitest'
import type { ErrorEvent, EventHint } from '@sentry/nextjs'
import { SENSITIVE_KEYS, redactKeys, piiBeforeSend } from '../sentry-pii'

// ─── Helper: cria ErrorEvent mock pra testes ─────
// Cast via `unknown` pra evitar incompatibilidade de Partial<ErrorEvent> com tipos
// estritos do Sentry (event.type union, etc) — mock parcial é suficiente pra testes.
function makeEvent(partial: Partial<ErrorEvent>): ErrorEvent {
  return partial as unknown as ErrorEvent
}

const noHint: EventHint = {}

describe('sentry-pii — Item 29 testes unitários', () => {
  // ════════════════════════════════════════════
  // Bloco 1: SENSITIVE_KEYS
  // ════════════════════════════════════════════
  describe('SENSITIVE_KEYS', () => {
    it('contém chaves PII clínicas críticas', () => {
      expect(SENSITIVE_KEYS.has('password')).toBe(true)
      expect(SENSITIVE_KEYS.has('cpf')).toBe(true)
      expect(SENSITIVE_KEYS.has('email')).toBe(true)
      expect(SENSITIVE_KEYS.has('transcript')).toBe(true)
      expect(SENSITIVE_KEYS.has('notes')).toBe(true)
    })

    it('tem pelo menos 25 entries (guard contra remoção acidental)', () => {
      expect(SENSITIVE_KEYS.size).toBeGreaterThanOrEqual(25)
    })

    it('é case-sensitive — lookup direto não casa case diferente', () => {
      expect(SENSITIVE_KEYS.has('email')).toBe(true)
      expect(SENSITIVE_KEYS.has('EMAIL')).toBe(false)
      expect(SENSITIVE_KEYS.has('Email')).toBe(false)
    })
  })

  // ════════════════════════════════════════════
  // Bloco 2: redactKeys
  // ════════════════════════════════════════════
  describe('redactKeys', () => {
    // ─── Casos básicos ──────────────────────────
    it('redacta valor de chave sensível em objeto plano', () => {
      const result = redactKeys({ password: 'secret123' })
      expect(result).toEqual({ password: '[REDACTED]' })
    })

    it('preserva valor de chave não-sensível', () => {
      const result = redactKeys({ status: 'active' })
      expect(result).toEqual({ status: 'active' })
    })

    it('mistura sensível + não-sensível: redacta só sensível', () => {
      const result = redactKeys({ status: 'ok', password: 'x', age: 30 })
      expect(result).toEqual({ status: 'ok', password: '[REDACTED]', age: 30 })
    })

    // ─── Case insensitivity ─────────────────────
    it('redacta independente do case (EMAIL, Email, eMaIl)', () => {
      expect(redactKeys({ EMAIL: 'a@b.c' })).toEqual({ EMAIL: '[REDACTED]' })
      expect(redactKeys({ Email: 'a@b.c' })).toEqual({ Email: '[REDACTED]' })
      expect(redactKeys({ eMaIl: 'a@b.c' })).toEqual({ eMaIl: '[REDACTED]' })
    })

    // ─── Aninhamento ────────────────────────────
    it('redacta em objeto aninhado 3 níveis profundos', () => {
      const input = {
        user: {
          profile: {
            email: 'leak@test.com',
            id: 'safe',
          },
        },
      }
      const expected = {
        user: {
          profile: {
            email: '[REDACTED]',
            id: 'safe',
          },
        },
      }
      expect(redactKeys(input)).toEqual(expected)
    })

    it('itera arrays e redacta objetos dentro', () => {
      const input = [
        { name: 'João', age: 10 },
        { name: 'Maria', age: 20 },
      ]
      const expected = [
        { name: '[REDACTED]', age: 10 },
        { name: '[REDACTED]', age: 20 },
      ]
      expect(redactKeys(input)).toEqual(expected)
    })

    // ─── Depth limit ────────────────────────────
    it('não recursiona além de depth 6 (retorna obj sem mudança)', () => {
      // Árvore de 7 níveis: redactKeys recursiona até depth=6, em depth=7 retorna sem processar.
      // password em l7 NÃO deve ser redactado porque é alcançado em depth=7.
      const deep = {
        l1: { l2: { l3: { l4: { l5: { l6: { l7: { password: 'leak' } } } } } } },
      }
      const result = redactKeys(deep) as unknown as typeof deep
      expect(result.l1.l2.l3.l4.l5.l6.l7).toEqual({ password: 'leak' })
    })

    // ─── Edge cases primitivos ──────────────────
    it('retorna null sem erro', () => {
      expect(redactKeys(null)).toBe(null)
    })

    it('retorna undefined sem erro', () => {
      expect(redactKeys(undefined)).toBe(undefined)
    })

    it('retorna string primitiva sem mudança', () => {
      expect(redactKeys('hello')).toBe('hello')
    })

    it('retorna number primitivo sem mudança', () => {
      expect(redactKeys(42)).toBe(42)
    })

    it('retorna boolean primitivo sem mudança', () => {
      expect(redactKeys(true)).toBe(true)
      expect(redactKeys(false)).toBe(false)
    })
  })

  // ════════════════════════════════════════════
  // Bloco 3: piiBeforeSend
  // ════════════════════════════════════════════
  describe('piiBeforeSend', () => {
    it('deleta event.request.data, cookies, query_string + redacta headers sensíveis', () => {
      const event = makeEvent({
        request: {
          data: { secret: 'leak' },
          cookies: { session: 'abc' },
          query_string: 'token=abc',
          headers: {
            authorization: 'Bearer xxx',
            'content-type': 'application/json',
          },
        },
      })
      const result = piiBeforeSend(event, noHint)
      expect(result.request).toBeDefined()
      expect(result.request!.data).toBeUndefined()
      expect(result.request!.cookies).toBeUndefined()
      expect(result.request!.query_string).toBeUndefined()
      expect(result.request!.headers).toEqual({
        authorization: '[REDACTED]',
        'content-type': 'application/json',
      })
    })

    it('event.user com id: trunca pra { id }', () => {
      const event = makeEvent({
        user: { id: 'user-123', email: 'leak@test.com', ip_address: '1.2.3.4' },
      })
      const result = piiBeforeSend(event, noHint)
      expect(result.user).toEqual({ id: 'user-123' })
    })

    it('event.user sem id: vira objeto vazio', () => {
      const event = makeEvent({
        user: { email: 'leak@test.com', ip_address: '1.2.3.4' },
      })
      const result = piiBeforeSend(event, noHint)
      expect(result.user).toEqual({})
    })

    it('aplica redactKeys em event.extra, contexts e tags', () => {
      const event = makeEvent({
        extra: { password: 'leak', safe: 'ok' },
        contexts: { app: { token: 'leak', version: '1.0' } },
        tags: { email: 'leak@x.com', env: 'prod' },
      })
      const result = piiBeforeSend(event, noHint)
      expect(result.extra).toEqual({ password: '[REDACTED]', safe: 'ok' })
      expect(result.contexts).toEqual({ app: { token: '[REDACTED]', version: '1.0' } })
      expect(result.tags).toEqual({ email: '[REDACTED]', env: 'prod' })
    })

    it('redacta data dentro de cada breadcrumb', () => {
      const event = makeEvent({
        breadcrumbs: [
          { message: 'login', data: { password: 'leak', user_id: 'safe' } },
          { message: 'click', data: { name: 'leak', x: 100 } },
        ],
      })
      const result = piiBeforeSend(event, noHint)
      expect(result.breadcrumbs![0].data).toEqual({ password: '[REDACTED]', user_id: 'safe' })
      expect(result.breadcrumbs![1].data).toEqual({ name: '[REDACTED]', x: 100 })
    })

    it('não throw quando event não tem request/user/extra/contexts/tags/breadcrumbs', () => {
      const event = makeEvent({})
      expect(() => piiBeforeSend(event, noHint)).not.toThrow()
      const result = piiBeforeSend(event, noHint)
      expect(result).toBeDefined()
    })

    it('retorna o mesmo objeto event (mutação in-place)', () => {
      const event = makeEvent({ extra: { foo: 'bar' } })
      const result = piiBeforeSend(event, noHint)
      expect(result).toBe(event) // identity check (===)
    })
  })
})
