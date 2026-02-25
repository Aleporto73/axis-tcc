/**
 * Ciclo de Vida do Protocolo — Bible S3
 *
 * 10 status oficiais com transições rígidas.
 * Transições não listadas são PROIBIDAS (S3.2 regra 5).
 *
 * Regras adicionais (S3.2):
 *  1. archived só a partir de maintained
 *  2. discontinued exige discontinuation_reason (NOT NULL)
 *  3. suspended max 30 dias — após D+30: alerta automático
 *  4. Toda transição gera registro em axis_audit_logs
 *  5. Transições não listadas são PROIBIDAS
 */

// ─── Status oficiais ──────────────────────────────

export const PROTOCOL_STATUSES = [
  "draft",
  "active",
  "mastered",
  "generalization",
  "maintenance",
  "maintained",
  "regression",
  "suspended",
  "discontinued",
  "archived",
] as const;

export type ProtocolStatus = (typeof PROTOCOL_STATUSES)[number];

// ─── Terminal status (sem saída) ──────────────────

export const TERMINAL_STATUSES: ReadonlySet<ProtocolStatus> = new Set([
  "discontinued",
  "archived",
]);

// ─── Mapa de transições válidas (Bible S3.1) ──────

export const VALID_TRANSITIONS: Record<ProtocolStatus, readonly ProtocolStatus[]> = {
  draft:          ["active", "archived"],
  active:         ["mastered", "suspended", "discontinued"],
  mastered:       ["generalization", "regression"],
  generalization: ["maintenance", "regression"],
  maintenance:    ["maintained", "regression"],
  maintained:     ["archived", "regression"],
  regression:     ["active"],
  suspended:      ["active", "discontinued"],
  discontinued:   [],  // terminal
  archived:       [],  // terminal
} as const;

// ─── Erros tipados ────────────────────────────────

export class TransitionError extends Error {
  constructor(
    public readonly from: ProtocolStatus,
    public readonly to: ProtocolStatus,
    public readonly reason: string,
  ) {
    super(`Transição proibida: ${from} → ${to}. ${reason}`);
    this.name = "TransitionError";
  }
}

// ─── Contexto da transição ─────────────────────────

export interface TransitionContext {
  /** Motivo de descontinuação (obrigatório para discontinued — S3.2 regra 2) */
  discontinuationReason?: string;

  /** Data de início da suspensão (para validar regra dos 30 dias — S3.2 regra 3) */
  suspendedAt?: Date;

  /** Data atual (para cálculos de prazo) */
  now?: Date;
}

export interface TransitionResult {
  success: true;
  from: ProtocolStatus;
  to: ProtocolStatus;
  warnings: string[];
}

// ─── Validações ────────────────────────────────────

/** Verifica se um status é válido */
export function isValidStatus(status: string): status is ProtocolStatus {
  return PROTOCOL_STATUSES.includes(status as ProtocolStatus);
}

/** Verifica se a transição é permitida (sem contexto adicional) */
export function isTransitionAllowed(
  from: ProtocolStatus,
  to: ProtocolStatus,
): boolean {
  const allowed = VALID_TRANSITIONS[from];
  return allowed.includes(to);
}

/** Retorna todos os destinos possíveis a partir de um status */
export function getAvailableTransitions(from: ProtocolStatus): readonly ProtocolStatus[] {
  return VALID_TRANSITIONS[from];
}

/** Verifica se o status é terminal */
export function isTerminal(status: ProtocolStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

/**
 * Valida e executa uma transição de protocolo.
 * Lança TransitionError se proibida.
 * Retorna warnings (ex: suspended > 30 dias).
 */
export function validateTransition(
  from: ProtocolStatus,
  to: ProtocolStatus,
  ctx: TransitionContext = {},
): TransitionResult {
  // 1. Status de origem válido?
  if (!isValidStatus(from)) {
    throw new TransitionError(from, to, `Status de origem "${from}" não é válido.`);
  }

  // 2. Status de destino válido?
  if (!isValidStatus(to)) {
    throw new TransitionError(from, to, `Status de destino "${to}" não é válido.`);
  }

  // 3. Transição permitida? (S3.2 regra 5)
  if (!isTransitionAllowed(from, to)) {
    throw new TransitionError(
      from,
      to,
      `Transição não listada na Bible S3.1. Transições proibidas não são executáveis.`,
    );
  }

  // 4. S3.2 regra 1: archived só a partir de maintained (ou draft)
  if (to === "archived" && from !== "maintained" && from !== "draft") {
    throw new TransitionError(
      from,
      to,
      `S3.2 regra 1: archived só a partir de maintained (ou draft).`,
    );
  }

  // 5. S3.2 regra 2: discontinued exige discontinuation_reason
  if (to === "discontinued" && !ctx.discontinuationReason?.trim()) {
    throw new TransitionError(
      from,
      to,
      `S3.2 regra 2: discontinued exige discontinuation_reason (NOT NULL).`,
    );
  }

  const warnings: string[] = [];

  // 6. S3.2 regra 3: suspended max 30 dias — alerta
  if (from === "suspended" && ctx.suspendedAt) {
    const now = ctx.now ?? new Date();
    const daysSuspended = Math.floor(
      (now.getTime() - ctx.suspendedAt.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysSuspended > 30) {
      warnings.push(
        `S3.2 regra 3: Protocolo suspenso há ${daysSuspended} dias (máximo 30). Alerta automático.`,
      );
    }
  }

  return { success: true, from, to, warnings };
}

/**
 * Calcula dias em suspensão
 */
export function daysSuspended(suspendedAt: Date, now?: Date): number {
  const current = now ?? new Date();
  return Math.floor(
    (current.getTime() - suspendedAt.getTime()) / (1000 * 60 * 60 * 24),
  );
}

/**
 * Verifica se suspensão excedeu 30 dias (S3.2 regra 3)
 */
export function isSuspensionExpired(suspendedAt: Date, now?: Date): boolean {
  return daysSuspended(suspendedAt, now) > 30;
}
