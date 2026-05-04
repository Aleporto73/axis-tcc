import { describe, it, expect } from 'vitest'
import { redactEmail, redactCPF, redactPhone, redactPII } from '../log-redaction'

describe('redactEmail', () => {
  it('redige email padrão mantendo 3 chars + domínio', () => {
    expect(redactEmail('joao.silva@gmail.com')).toBe('joa***@gmail.com')
  })
  it('redige email curto (1-2 chars) sem expor', () => {
    expect(redactEmail('a@b.com')).toBe('a***@b.com')
    expect(redactEmail('ab@b.com')).toBe('ab***@b.com')
  })
  it('retorna placeholder pra email vazio/null/undefined', () => {
    expect(redactEmail(null)).toBe('[no-email]')
    expect(redactEmail(undefined)).toBe('[no-email]')
    expect(redactEmail('')).toBe('[no-email]')
  })
  it('retorna placeholder pra string sem @', () => {
    expect(redactEmail('semarroba')).toBe('[invalid-email]')
  })
  it('redige email Hotmart pending', () => {
    expect(redactEmail('pending_hotmart_aleporto305@gmail.com')).toBe('pen***@gmail.com')
  })
})

describe('redactCPF', () => {
  it('redige CPF formatado mantendo últimos 2', () => {
    expect(redactCPF('123.456.789-10')).toBe('***.***.***-10')
  })
  it('redige CPF sem formato', () => {
    expect(redactCPF('12345678910')).toBe('***.***.***-10')
  })
  it('retorna placeholder pra CPF vazio/null', () => {
    expect(redactCPF(null)).toBe('[no-cpf]')
    expect(redactCPF('')).toBe('[no-cpf]')
  })
})

describe('redactPhone', () => {
  it('redige telefone mantendo últimos 4', () => {
    expect(redactPhone('+55 11 98765-4321')).toBe('***-4321')
  })
  it('retorna placeholder pra phone vazio', () => {
    expect(redactPhone(null)).toBe('[no-phone]')
  })
})

describe('redactPII (recursivo)', () => {
  it('redige email em objeto plano', () => {
    const out = redactPII({ email: 'joao@gmail.com', name: 'Joao' })
    expect(out).toEqual({ email: 'joa***@gmail.com', name: 'Joao' })
  })
  it('redige objeto aninhado', () => {
    const out = redactPII({ user: { email: 'a@b.com', id: 1 } })
    expect(out).toEqual({ user: { email: 'a***@b.com', id: 1 } })
  })
  it('redige array de objetos', () => {
    const out = redactPII([{ email: 'a@b.com' }, { email: 'c@d.com' }])
    expect(out).toEqual([{ email: 'a***@b.com' }, { email: 'c***@d.com' }])
  })
  it('preserva chaves não-sensíveis', () => {
    const out = redactPII({ id: 1, name: 'Joao', count: 42 })
    expect(out).toEqual({ id: 1, name: 'Joao', count: 42 })
  })
  it('redige variantes de email (camelCase + snake_case)', () => {
    const out = redactPII({ buyer_email: 'a@b.com', userEmail: 'c@d.com' })
    expect(out).toEqual({ buyer_email: 'a***@b.com', userEmail: 'c***@d.com' })
  })
  it('passa null/undefined intacto', () => {
    expect(redactPII(null)).toBe(null)
    expect(redactPII(undefined)).toBe(undefined)
  })
})
