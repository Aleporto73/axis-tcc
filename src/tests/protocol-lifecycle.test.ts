import { describe, it, expect } from "vitest";
import {
  PROTOCOL_STATUSES,
  VALID_TRANSITIONS,
  TERMINAL_STATUSES,
  isValidStatus,
  isTransitionAllowed,
  getAvailableTransitions,
  isTerminal,
  validateTransition,
  daysSuspended,
  isSuspensionExpired,
  TransitionError,
} from "@/src/engines/protocol-lifecycle";
import type { ProtocolStatus } from "@/src/engines/protocol-lifecycle";

// ─── Helper: gerar todos os pares (from, to) ──────

function allPairs(): { from: ProtocolStatus; to: ProtocolStatus }[] {
  const pairs: { from: ProtocolStatus; to: ProtocolStatus }[] = [];
  for (const from of PROTOCOL_STATUSES) {
    for (const to of PROTOCOL_STATUSES) {
      pairs.push({ from, to });
    }
  }
  return pairs;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

// ─── Status oficiais ──────────────────────────────

describe("PROTOCOL_STATUSES — Bible S3.1", () => {
  it("contém exatamente 11 status", () => {
    expect(PROTOCOL_STATUSES).toHaveLength(11);
  });

  it("contém todos os status da Bible S3.1", () => {
    const expected = [
      "draft", "active", "mastered", "generalization",
      "mastered_validated", "maintenance", "maintained",
      "regression", "suspended", "discontinued", "archived",
    ];
    for (const s of expected) {
      expect(PROTOCOL_STATUSES).toContain(s);
    }
  });

  it("não contém status extras", () => {
    const expected = new Set([
      "draft", "active", "mastered", "generalization",
      "mastered_validated", "maintenance", "maintained",
      "regression", "suspended", "discontinued", "archived",
    ]);
    for (const s of PROTOCOL_STATUSES) {
      expect(expected.has(s)).toBe(true);
    }
  });
});

// ─── isValidStatus ─────────────────────────────────

describe("isValidStatus", () => {
  it("retorna true para todos os status oficiais", () => {
    for (const s of PROTOCOL_STATUSES) {
      expect(isValidStatus(s)).toBe(true);
    }
  });

  it("retorna false para strings inválidas", () => {
    expect(isValidStatus("completed")).toBe(false);
    expect(isValidStatus("paused")).toBe(false);
    expect(isValidStatus("")).toBe(false);
    expect(isValidStatus("ACTIVE")).toBe(false);
  });
});

// ─── Status terminais ──────────────────────────────

describe("status terminais — Bible S3.1", () => {
  it("discontinued é terminal", () => {
    expect(isTerminal("discontinued")).toBe(true);
  });

  it("archived é terminal", () => {
    expect(isTerminal("archived")).toBe(true);
  });

  it("nenhum outro status é terminal", () => {
    const nonTerminal: ProtocolStatus[] = [
      "draft", "active", "mastered", "generalization",
      "mastered_validated", "maintenance", "maintained",
      "regression", "suspended",
    ];
    for (const s of nonTerminal) {
      expect(isTerminal(s)).toBe(false);
    }
  });

  it("status terminais não possuem transições de saída", () => {
    for (const s of TERMINAL_STATUSES) {
      expect(VALID_TRANSITIONS[s]).toHaveLength(0);
    }
  });
});

// ─── Transições válidas por status (Bible S3.1) ───

describe("transições válidas — Bible S3.1", () => {
  it("draft → active, discontinued", () => {
    expect(VALID_TRANSITIONS.draft).toEqual(["active", "discontinued"]);
  });

  it("active → mastered, suspended, discontinued", () => {
    expect(VALID_TRANSITIONS.active).toEqual(["mastered", "suspended", "discontinued"]);
  });

  it("mastered → generalization, suspended, active", () => {
    expect(VALID_TRANSITIONS.mastered).toEqual(["generalization", "suspended", "active"]);
  });

  it("generalization → mastered_validated, maintained, active", () => {
    expect(VALID_TRANSITIONS.generalization).toEqual(["mastered_validated", "maintained", "active"]);
  });

  it("mastered_validated → maintenance, maintained, active", () => {
    expect(VALID_TRANSITIONS.mastered_validated).toEqual(["maintenance", "maintained", "active"]);
  });

  it("maintenance → maintained, active", () => {
    expect(VALID_TRANSITIONS.maintenance).toEqual(["maintained", "active"]);
  });

  it("maintained → archived, active", () => {
    expect(VALID_TRANSITIONS.maintained).toEqual(["archived", "active"]);
  });

  it("regression → [] (tombstone — removido da máquina)", () => {
    expect(VALID_TRANSITIONS.regression).toEqual([]);
  });

  it("suspended → active, discontinued", () => {
    expect(VALID_TRANSITIONS.suspended).toEqual(["active", "discontinued"]);
  });

  it("discontinued → [] (terminal)", () => {
    expect(VALID_TRANSITIONS.discontinued).toEqual([]);
  });

  it("archived → [] (terminal)", () => {
    expect(VALID_TRANSITIONS.archived).toEqual([]);
  });
});

// ─── isTransitionAllowed ──────────────────────────

describe("isTransitionAllowed", () => {
  it("permite todas as transições válidas da tabela S3.1", () => {
    for (const from of PROTOCOL_STATUSES) {
      for (const to of VALID_TRANSITIONS[from]) {
        expect(isTransitionAllowed(from, to)).toBe(true);
      }
    }
  });

  it("proíbe self-transitions (mesmo status → mesmo status)", () => {
    for (const s of PROTOCOL_STATUSES) {
      expect(isTransitionAllowed(s, s)).toBe(false);
    }
  });
});

// ─── getAvailableTransitions ──────────────────────

describe("getAvailableTransitions", () => {
  it("retorna destinos corretos para cada status", () => {
    for (const from of PROTOCOL_STATUSES) {
      expect(getAvailableTransitions(from)).toEqual(VALID_TRANSITIONS[from]);
    }
  });
});

// ─── S3.2 regra 5: Transições PROIBIDAS ───────────

describe("transições proibidas — S3.2 regra 5", () => {
  // Gerar todas as combinações (from, to) e filtrar apenas as proibidas
  const allProhibited = allPairs().filter(
    ({ from, to }) => !VALID_TRANSITIONS[from].includes(to),
  );

  it(`existem ${allProhibited.length} transições proibidas no total`, () => {
    // 11 status × 11 status = 121 pares
    // Total permitidas: 2+3+3+3+3+2+2+0+2+0+0 = 20
    // Proibidas = 121 - 20 = 101
    expect(allProhibited).toHaveLength(101);
  });

  // Testes explícitos para transições comuns que NÃO devem ser permitidas
  const explicitProhibitions: [ProtocolStatus, ProtocolStatus, string][] = [
    ["draft", "mastered", "não pode pular aquisição"],
    ["draft", "archived", "draft não vai mais para archived (Fase A)"],
    ["draft", "regression", "regression é tombstone"],
    ["active", "archived", "active não pode ir direto para archived"],
    ["active", "maintained", "active precisa passar por mastered/gen/maintenance"],
    ["active", "generalization", "active precisa dominar antes de generalizar"],
    ["mastered", "archived", "mastered não pode ir direto para archived"],
    ["mastered", "maintenance", "mastered precisa generalizar antes da manutenção"],
    ["mastered", "discontinued", "mastered não pode descontinuar diretamente"],
    ["generalization", "archived", "generalization não pode ir direto para archived"],
    ["generalization", "mastered", "generalization não volta para mastered"],
    ["generalization", "maintenance", "generalization precisa de mastered_validated antes"],
    ["mastered_validated", "archived", "mastered_validated não pode ir direto para archived"],
    ["mastered_validated", "generalization", "mastered_validated não volta para generalization"],
    ["maintenance", "archived", "maintenance não pode ir direto para archived"],
    ["maintained", "maintenance", "maintained não volta para maintenance"],
    ["mastered", "regression", "regression é tombstone (sem entrada)"],
    ["maintenance", "regression", "regression é tombstone (sem entrada)"],
    ["regression", "active", "regression é tombstone (sem saída)"],
    ["regression", "mastered", "regression é tombstone (sem saída)"],
    ["regression", "discontinued", "regression é tombstone (sem saída)"],
    ["suspended", "mastered", "suspended não pode pular para mastered"],
    ["suspended", "archived", "suspended não pode ir para archived"],
    ["discontinued", "active", "terminal — sem saída"],
    ["discontinued", "draft", "terminal — sem saída"],
    ["archived", "active", "terminal — sem saída"],
    ["archived", "draft", "terminal — sem saída"],
  ];

  for (const [from, to, reason] of explicitProhibitions) {
    it(`PROIBIDO: ${from} → ${to} (${reason})`, () => {
      expect(isTransitionAllowed(from, to)).toBe(false);
    });
  }
});

// ─── validateTransition — regras de negócio S3.2 ──

describe("validateTransition — regras de negócio S3.2", () => {
  // ─── Transições válidas simples ─────────────────

  it("draft → active: sucesso", () => {
    const result = validateTransition("draft", "active");
    expect(result.success).toBe(true);
    expect(result.from).toBe("draft");
    expect(result.to).toBe("active");
    expect(result.warnings).toEqual([]);
  });

  it("active → mastered: sucesso", () => {
    const result = validateTransition("active", "mastered");
    expect(result.success).toBe(true);
  });

  it("mastered → generalization: sucesso", () => {
    const result = validateTransition("mastered", "generalization");
    expect(result.success).toBe(true);
  });

  it("generalization → mastered_validated: sucesso (com grid completo)", () => {
    const result = validateTransition("generalization", "mastered_validated", {
      generalizationGrid: { targets: 3, environments: 2, passedCells: 6 },
    });
    expect(result.success).toBe(true);
  });

  it("mastered_validated → maintenance: sucesso", () => {
    const result = validateTransition("mastered_validated", "maintenance");
    expect(result.success).toBe(true);
  });

  it("maintenance → maintained: sucesso", () => {
    const result = validateTransition("maintenance", "maintained");
    expect(result.success).toBe(true);
  });

  it("maintained → archived: sucesso", () => {
    const result = validateTransition("maintained", "archived");
    expect(result.success).toBe(true);
  });

  it("mastered → active (reversão do Dominado): sucesso", () => {
    const result = validateTransition("mastered", "active");
    expect(result.success).toBe(true);
  });

  // ─── Caminho completo feliz (fluxo ideal) ──────

  it("caminho feliz completo: draft → ... → archived", () => {
    const path: ProtocolStatus[] = [
      "draft", "active", "mastered", "generalization",
      "mastered_validated", "maintenance", "maintained", "archived",
    ];
    for (let i = 0; i < path.length - 1; i++) {
      const from = path[i];
      const to = path[i + 1];
      const ctx = to === "discontinued"
        ? { discontinuationReason: "motivo" }
        : to === "mastered_validated"
        ? { generalizationGrid: { targets: 3, environments: 2, passedCells: 6 } }
        : {};
      const result = validateTransition(from, to, ctx);
      expect(result.success).toBe(true);
    }
  });

  // ─── Transição proibida lança TransitionError ───

  it("transição proibida lança TransitionError", () => {
    expect(() => validateTransition("draft", "mastered")).toThrow(TransitionError);
  });

  it("TransitionError contém from, to e reason", () => {
    try {
      validateTransition("active", "archived");
      expect.unreachable("deveria ter lançado");
    } catch (e) {
      expect(e).toBeInstanceOf(TransitionError);
      const err = e as TransitionError;
      expect(err.from).toBe("active");
      expect(err.to).toBe("archived");
      expect(err.reason).toContain("proibida");
    }
  });

  it("terminal → qualquer lança TransitionError", () => {
    for (const terminal of TERMINAL_STATUSES) {
      for (const to of PROTOCOL_STATUSES) {
        expect(() => validateTransition(terminal, to)).toThrow(TransitionError);
      }
    }
  });

  // ─── S3.2 regra 1: archived só de maintained (ou draft) ──

  describe("S3.2 regra 1 — archived só de maintained ou draft", () => {
    it("maintained → archived: permitido", () => {
      const result = validateTransition("maintained", "archived");
      expect(result.success).toBe(true);
    });

    it("draft → archived: NÃO permitido (Fase A: draft → active|discontinued)", () => {
      expect(() => validateTransition("draft", "archived")).toThrow(TransitionError);
    });

    it("qualquer outro → archived: proibido pelo mapa de transições", () => {
      const nonAllowed: ProtocolStatus[] = [
        "draft", "active", "mastered", "generalization", "mastered_validated",
        "maintenance", "regression", "suspended",
      ];
      for (const from of nonAllowed) {
        expect(() => validateTransition(from, "archived")).toThrow(TransitionError);
      }
    });
  });

  // ─── S3.2 regra 2: discontinued exige reason ───

  describe("S3.2 regra 2 — discontinued exige discontinuation_reason", () => {
    it("active → discontinued SEM reason: lança TransitionError", () => {
      expect(() => validateTransition("active", "discontinued")).toThrow(
        TransitionError,
      );
      expect(() => validateTransition("active", "discontinued", {})).toThrow(
        TransitionError,
      );
    });

    it("active → discontinued com reason vazia: lança TransitionError", () => {
      expect(() =>
        validateTransition("active", "discontinued", {
          discontinuationReason: "",
        }),
      ).toThrow(TransitionError);
    });

    it("active → discontinued com reason whitespace-only: lança TransitionError", () => {
      expect(() =>
        validateTransition("active", "discontinued", {
          discontinuationReason: "   ",
        }),
      ).toThrow(TransitionError);
    });

    it("active → discontinued COM reason válida: sucesso", () => {
      const result = validateTransition("active", "discontinued", {
        discontinuationReason: "Família mudou de cidade",
      });
      expect(result.success).toBe(true);
    });

    it("suspended → discontinued COM reason válida: sucesso", () => {
      const result = validateTransition("suspended", "discontinued", {
        discontinuationReason: "Alta clínica solicitada pela família",
      });
      expect(result.success).toBe(true);
    });

    it("suspended → discontinued SEM reason: lança TransitionError", () => {
      expect(() => validateTransition("suspended", "discontinued")).toThrow(
        TransitionError,
      );
    });
  });

  // ─── S3.2 regra 3: suspended max 30 dias ───────

  describe("S3.2 regra 3 — suspended max 30 dias", () => {
    it("suspended → active dentro de 30 dias: sem warning", () => {
      const result = validateTransition("suspended", "active", {
        suspendedAt: daysAgo(15),
      });
      expect(result.success).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it("suspended → active exatamente 30 dias: sem warning", () => {
      const result = validateTransition("suspended", "active", {
        suspendedAt: daysAgo(30),
      });
      expect(result.success).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it("suspended → active com 31+ dias: warning de alerta", () => {
      const result = validateTransition("suspended", "active", {
        suspendedAt: daysAgo(45),
      });
      expect(result.success).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain("45 dias");
      expect(result.warnings[0]).toContain("máximo 30");
    });

    it("suspended → discontinued com 60 dias: warning + reason obrigatório", () => {
      const result = validateTransition("suspended", "discontinued", {
        suspendedAt: daysAgo(60),
        discontinuationReason: "Abandono de tratamento após 60 dias",
      });
      expect(result.success).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain("60 dias");
    });

    it("sem suspendedAt fornecido: não gera warning", () => {
      const result = validateTransition("suspended", "active");
      expect(result.success).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });
  });

  // ─── S3.2 regra 6: mastered_validated exige grid 3×2 ──

  describe("S3.2 regra 6 — mastered_validated exige grid 3×2", () => {
    it("generalization → mastered_validated SEM grid: lança TransitionError", () => {
      expect(() => validateTransition("generalization", "mastered_validated")).toThrow(
        TransitionError,
      );
    });

    it("generalization → mastered_validated com grid incompleto (4/6): lança TransitionError", () => {
      expect(() =>
        validateTransition("generalization", "mastered_validated", {
          generalizationGrid: { targets: 3, environments: 2, passedCells: 4 },
        }),
      ).toThrow(TransitionError);
    });

    it("generalization → mastered_validated com alvos insuficientes: lança TransitionError", () => {
      expect(() =>
        validateTransition("generalization", "mastered_validated", {
          generalizationGrid: { targets: 2, environments: 2, passedCells: 4 },
        }),
      ).toThrow(TransitionError);
    });

    it("generalization → mastered_validated com ambientes insuficientes: lança TransitionError", () => {
      expect(() =>
        validateTransition("generalization", "mastered_validated", {
          generalizationGrid: { targets: 3, environments: 1, passedCells: 3 },
        }),
      ).toThrow(TransitionError);
    });

    it("generalization → mastered_validated com grid completo (6/6): sucesso", () => {
      const result = validateTransition("generalization", "mastered_validated", {
        generalizationGrid: { targets: 3, environments: 2, passedCells: 6 },
      });
      expect(result.success).toBe(true);
    });

    it("generalization → mastered_validated com grid excedente (4 alvos × 3 ambientes): sucesso", () => {
      const result = validateTransition("generalization", "mastered_validated", {
        generalizationGrid: { targets: 4, environments: 3, passedCells: 12 },
      });
      expect(result.success).toBe(true);
    });
  });

  // ─── Regressão ─────────────────────────────────

  describe("reversão e tombstone de regression — Fase A (ABA v9, Decisão 1)", () => {
    it("mastered → active (reversão do Dominado): permitido", () => {
      expect(validateTransition("mastered", "active").success).toBe(true);
    });

    it("maintenance → active (sonda abaixo do critério, volta ao ensino): permitido", () => {
      expect(validateTransition("maintenance", "active").success).toBe(true);
    });

    it("maintained → active (retorno ao ensino): permitido", () => {
      expect(validateTransition("maintained", "active").success).toBe(true);
    });

    it("regression é tombstone — sem transições de saída", () => {
      expect(getAvailableTransitions("regression")).toEqual([]);
    });

    it("nenhuma transição PARA regression é permitida", () => {
      for (const from of PROTOCOL_STATUSES) {
        expect(isTransitionAllowed(from, "regression")).toBe(false);
      }
    });

    it("nenhuma transição A PARTIR DE regression é permitida", () => {
      for (const to of PROTOCOL_STATUSES) {
        expect(isTransitionAllowed("regression", to)).toBe(false);
      }
    });
  });
});

// ─── daysSuspended / isSuspensionExpired ──────────

describe("daysSuspended", () => {
  it("retorna 0 para data de hoje", () => {
    const now = new Date();
    expect(daysSuspended(now, now)).toBe(0);
  });

  it("retorna 30 para 30 dias atrás", () => {
    const now = new Date("2026-02-25T12:00:00Z");
    const suspended = new Date("2026-01-26T12:00:00Z");
    expect(daysSuspended(suspended, now)).toBe(30);
  });

  it("retorna 1 para ontem", () => {
    const now = new Date("2026-02-25T12:00:00Z");
    const yesterday = new Date("2026-02-24T12:00:00Z");
    expect(daysSuspended(yesterday, now)).toBe(1);
  });
});

describe("isSuspensionExpired", () => {
  it("false quando <= 30 dias", () => {
    expect(isSuspensionExpired(daysAgo(30))).toBe(false);
    expect(isSuspensionExpired(daysAgo(15))).toBe(false);
    expect(isSuspensionExpired(daysAgo(1))).toBe(false);
  });

  it("true quando > 30 dias", () => {
    expect(isSuspensionExpired(daysAgo(31))).toBe(true);
    expect(isSuspensionExpired(daysAgo(60))).toBe(true);
    expect(isSuspensionExpired(daysAgo(365))).toBe(true);
  });
});

// ─── Integridade do mapa de transições ────────────

describe("integridade do mapa VALID_TRANSITIONS", () => {
  it("todos os status possuem entrada no mapa", () => {
    for (const s of PROTOCOL_STATUSES) {
      expect(VALID_TRANSITIONS).toHaveProperty(s);
      expect(Array.isArray(VALID_TRANSITIONS[s])).toBe(true);
    }
  });

  it("todos os destinos no mapa são status válidos", () => {
    for (const from of PROTOCOL_STATUSES) {
      for (const to of VALID_TRANSITIONS[from]) {
        expect(PROTOCOL_STATUSES).toContain(to);
      }
    }
  });

  it("nenhum status aponta para si mesmo", () => {
    for (const s of PROTOCOL_STATUSES) {
      expect(VALID_TRANSITIONS[s]).not.toContain(s);
    }
  });

  it("total de transições válidas = 20", () => {
    let total = 0;
    for (const from of PROTOCOL_STATUSES) {
      total += VALID_TRANSITIONS[from].length;
    }
    // draft(2) + active(3) + mastered(3) + generalization(3)
    // + mastered_validated(3) + maintenance(2) + maintained(2)
    // + regression(0) + suspended(2) + discontinued(0) + archived(0) = 20
    expect(total).toBe(20);
  });

  it("não há transições duplicadas em nenhum status", () => {
    for (const from of PROTOCOL_STATUSES) {
      const transitions = VALID_TRANSITIONS[from];
      const unique = new Set(transitions);
      expect(unique.size).toBe(transitions.length);
    }
  });
});
