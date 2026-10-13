import { GRANTING_EVENTS, type PaymentBetaEvent, type RevokeKind } from './paymentbeta-contract'
import type { PlanKey } from './plans'

// =====================================================
// AXIS — O que cada evento do PaymentBeta faz com a licença (pagamento P2)
//
// Função PURA: recebe as licenças do produto no tenant e devolve a decisão.
// Quem grava é src/billing/paymentbeta-license.ts.
//
// Uma linha por tenant+produto. access_until = até quando vale; quem desliga
// is_active é a rotina /api/cron/expire-licenses, 2 dias depois da data (tolerância).
//
//   sale.confirmed      ativa/renova: access_until = MAIOR entre o atual e expires_at
//                       (renovação nunca encurta); plan_key pelo entitlement.code
//   subscription.pending   1ª cobrança ainda não paga: abre janela provisória até
//                       expires_at (criação + 7 dias) para quem não tem acesso.
//                       Repetida, nunca cresce (MIN): a assinatura que já tem linha não muda
//   subscription.payment_failed  carência até expires_at (vencimento + 3 dias)
//   subscription.cancelled       mantém até expires_at (nunca encurta)
//   subscription.reactivated     mantém/estende até expires_at (não religa licença vencida)
//   subscription.access_revoked  corta agora. Estorno de um mês já superado por
//                       outro mês pago não corta. Chargeback corta de vez: nada
//                       desta assinatura religa sozinho (só à mão)
//
// Licença 'cortesia': nenhum evento altera. Licença 'hotmart' ativa: a compra
// paga assume a linha (e alerta para cancelar a Hotmart à mão).
// Nenhum prazo sai de now(): só de expires_at (o PaymentBeta fixa as datas).
// =====================================================

const DAY_MS = 24 * 60 * 60 * 1000
/** Carência só reabre licença que venceu até 1 dia antes do vencimento que falhou (3 + 1 dias). */
const GRACE_REOPEN_MS = 4 * DAY_MS

export interface PbLicense {
  id: string
  clerk_user_id: string
  is_active: boolean
  plan_key: string | null
  billing_source: string | null
  access_until: Date | null
  paymentbeta_subscription_id: string | null
}

export interface PbFact {
  event: PaymentBetaEvent
  planKey: PlanKey
  subscriptionId: string | null
  expiresAt: Date
  revokeKind: RevokeKind | null
}

/** Cortes já registrados para esta assinatura (axis_audit_logs). */
export interface PbHistory {
  chargeback: boolean
  revoked: boolean
}

export const NO_HISTORY: PbHistory = { chargeback: false, revoked: false }

export type PbResult =
  | 'ativada'
  | 'renovada'
  | 'assinatura_trocada'
  | 'hotmart_assumida'
  | 'pendente_aberta'
  | 'carencia'
  | 'cancelada_mantida'
  | 'reativada'
  | 'revogada'
  | 'sem_mudanca'
  | 'ja_tem_acesso'
  | 'vencido_na_chegada'
  | 'estorno_de_periodo_antigo'
  | 'cortesia_intocada'
  | 'bloqueada_chargeback'
  | 'assinatura_desconhecida'

export type PbAlert =
  | 'hotmart_takeover'
  | 'other_subscription'
  | 'cortesia_paid'
  | 'chargeback'
  | 'chargeback_paid'
  | 'unknown_revocation'

export interface PbWrite {
  /** Linha a atualizar; null = inserir linha nova. */
  rowId: string | null
  is_active: boolean
  access_until: Date
  /** null = mantém a plan_key da linha. */
  plan_key: string | null
  paymentbeta_subscription_id: string | null
  /** true = acesso (re)começa agora: valid_from = hoje. */
  restart: boolean
}

export interface PbDecision {
  result: PbResult
  /** null = nada muda no banco. */
  write: PbWrite | null
  /** Linha que o evento olhou (para auditoria). */
  target: PbLicense | null
  /** Quem não tinha acesso PaymentBeta passou a ter (manda o e-mail pós-compra). */
  accessOpened: boolean
  /** access_revoked aplicado: fica no histórico da assinatura. */
  cut: boolean
  alerts: PbAlert[]
}

const time = (d: Date | null): number => (d ? d.getTime() : Number.NEGATIVE_INFINITY)
const latest = (a: Date | null, b: Date): Date => (time(a) >= b.getTime() ? (a as Date) : b)
const earliest = (a: Date | null, b: Date): Date => (a && a.getTime() <= b.getTime() ? a : b)

function none(result: PbResult, target: PbLicense | null, alerts: PbAlert[] = []): PbDecision {
  return { result, write: null, target, accessOpened: false, cut: false, alerts }
}

/** Grava só se algo muda de fato. */
function keep(row: PbLicense, next: { is_active: boolean; access_until: Date }): PbWrite | null {
  if (next.is_active === row.is_active && time(row.access_until) === next.access_until.getTime()) return null
  return {
    rowId: row.id,
    is_active: next.is_active,
    access_until: next.access_until,
    plan_key: null,
    paymentbeta_subscription_id: row.paymentbeta_subscription_id,
    restart: false,
  }
}

export function decidePaymentBeta(
  fact: PbFact,
  rows: PbLicense[],
  ownerClerkId: string | null,
  history: PbHistory,
  now: Date,
): PbDecision {
  const linked = fact.subscriptionId
    ? rows.find((r) => r.paymentbeta_subscription_id === fact.subscriptionId) ?? null
    : null
  return GRANTING_EVENTS.has(fact.event)
    ? decideGrant(fact, rows, linked, ownerClerkId, history, now)
    : decideLifecycle(fact, linked, history, now)
}

// ─── sale.confirmed / subscription.pending ───

function decideGrant(
  fact: PbFact,
  rows: PbLicense[],
  linked: PbLicense | null,
  ownerClerkId: string | null,
  history: PbHistory,
  now: Date,
): PbDecision {
  const paid = fact.event === 'sale.confirmed'
  const target =
    linked ??
    rows.find((r) => r.is_active && r.billing_source === 'hotmart') ??
    rows.find((r) => r.is_active && r.billing_source !== 'cortesia') ??
    rows.find((r) => r.clerk_user_id === ownerClerkId) ??
    null

  const cortesia = rows.find((r) => r.billing_source === 'cortesia' && (r.is_active || r === target))
  if (cortesia) return none('cortesia_intocada', cortesia, paid ? ['cortesia_paid'] : [])
  if (fact.subscriptionId && history.chargeback) return none('bloqueada_chargeback', target, paid ? ['chargeback_paid'] : [])
  if (fact.expiresAt.getTime() <= now.getTime()) return none('vencido_na_chegada', target)

  const wasPaymentBeta = !!target && target.billing_source === 'paymentbeta'
  const wasActivePb = wasPaymentBeta && target!.is_active

  if (!paid) {
    // MIN: a janela provisória desta assinatura nasce uma vez e nunca cresce.
    if (linked) return none('sem_mudanca', linked)
    if (target && target.is_active && (target.billing_source === 'hotmart' || target.billing_source === 'paymentbeta')) {
      return none('ja_tem_acesso', target)
    }
    return {
      result: 'pendente_aberta',
      write: {
        rowId: target?.id ?? null,
        is_active: true,
        access_until: fact.expiresAt,
        plan_key: fact.planKey,
        paymentbeta_subscription_id: fact.subscriptionId,
        restart: true,
      },
      target,
      accessOpened: true,
      cut: false,
      alerts: [],
    }
  }

  const alerts: PbAlert[] = []
  if (rows.some((r) => r.is_active && r.billing_source === 'hotmart')) alerts.push('hotmart_takeover')
  const otherSubscription =
    wasActivePb && !!fact.subscriptionId && !!target!.paymentbeta_subscription_id &&
    target!.paymentbeta_subscription_id !== fact.subscriptionId
  if (otherSubscription) alerts.push('other_subscription')

  let result: PbResult = 'ativada'
  if (target?.is_active && target.billing_source === 'hotmart') result = 'hotmart_assumida'
  else if (otherSubscription) result = 'assinatura_trocada'
  else if (wasActivePb) result = 'renovada'

  return {
    result,
    write: {
      rowId: target?.id ?? null,
      is_active: true,
      // Nunca encurta: a data atual só conta se a linha já era PaymentBeta.
      access_until: latest(wasPaymentBeta ? target!.access_until : null, fact.expiresAt),
      plan_key: fact.planKey,
      paymentbeta_subscription_id: fact.subscriptionId ?? target?.paymentbeta_subscription_id ?? null,
      restart: !wasActivePb,
    },
    target,
    accessOpened: !wasActivePb,
    cut: false,
    alerts,
  }
}

// ─── payment_failed / cancelled / reactivated / access_revoked ───

function decideLifecycle(fact: PbFact, row: PbLicense | null, history: PbHistory, now: Date): PbDecision {
  if (!row) {
    return none('assinatura_desconhecida', null, fact.event === 'subscription.access_revoked' ? ['unknown_revocation'] : [])
  }
  if (row.billing_source === 'cortesia') return none('cortesia_intocada', row)
  if (row.billing_source !== 'paymentbeta') return none('sem_mudanca', row)

  const until = row.access_until
  const extend = (result: PbResult): PbDecision => {
    if (!row.is_active) return none('sem_mudanca', row)
    return { result, write: keep(row, { is_active: true, access_until: latest(until, fact.expiresAt) }), target: row, accessOpened: false, cut: false, alerts: [] }
  }

  switch (fact.event) {
    case 'subscription.cancelled':
      return extend('cancelada_mantida')

    case 'subscription.reactivated':
      if (history.chargeback) return none('bloqueada_chargeback', row)
      return extend('reativada')

    case 'subscription.payment_failed': {
      if (history.chargeback) return none('bloqueada_chargeback', row)
      if (fact.expiresAt.getTime() <= now.getTime()) return none('sem_mudanca', row)
      if (row.is_active) return extend('carencia')
      // Já vencida: a carência só reabre se o mês pago acabou junto com o vencimento que falhou.
      if (history.revoked || !until || until.getTime() + GRACE_REOPEN_MS < fact.expiresAt.getTime()) {
        return none('sem_mudanca', row)
      }
      return {
        result: 'carencia',
        write: keep(row, { is_active: true, access_until: latest(until, fact.expiresAt) }),
        target: row,
        accessOpened: false,
        cut: false,
        alerts: [],
      }
    }

    case 'subscription.access_revoked': {
      const chargeback = fact.revokeKind === 'chargeback'
      // expires_at = fim do mês que este pagamento pagou. Se já há mês mais novo pago, o estorno não corta.
      if (!chargeback && until && until.getTime() > fact.expiresAt.getTime()) {
        return none('estorno_de_periodo_antigo', row)
      }
      return {
        result: 'revogada',
        write: keep(row, { is_active: false, access_until: earliest(until, now) }),
        target: row,
        accessOpened: false,
        cut: true,
        alerts: chargeback ? ['chargeback'] : [],
      }
    }

    default:
      return none('sem_mudanca', row)
  }
}
