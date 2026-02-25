import { describe, it, expect } from "vitest";
import {
  calculateSAS,
  calculatePIS,
  calculateBSS,
  calculateTCM,
  calculateCsoAba,
  getFaixa,
  computeFullCsoAba,
  clamp,
  WEIGHTS,
  MASTERY_SCORES,
  PROMPT_SCALE,
  INTENSITY_VALUES,
  CSO_ABA_ENGINE_VERSION,
} from "@/src/engines/cso-aba";
import type {
  TargetScore,
  MasteryStatus,
  PromptLevel,
  BehaviorIntensity,
} from "@/src/engines/cso-aba";

// ─── Helpers ───────────────────────────────────────

describe("clamp", () => {
  it("retorna valor dentro da faixa sem alteração", () => {
    expect(clamp(50)).toBe(50);
  });

  it("limita valor abaixo do mínimo a 0", () => {
    expect(clamp(-10)).toBe(0);
  });

  it("limita valor acima do máximo a 100", () => {
    expect(clamp(150)).toBe(100);
  });

  it("aceita limites customizados", () => {
    expect(clamp(5, 10, 20)).toBe(10);
    expect(clamp(25, 10, 20)).toBe(20);
  });
});

// ─── Constantes Bible S2 ──────────────────────────

describe("constantes Bible S2", () => {
  it("pesos fixos são todos 0.25", () => {
    expect(WEIGHTS.SAS).toBe(0.25);
    expect(WEIGHTS.PIS).toBe(0.25);
    expect(WEIGHTS.BSS).toBe(0.25);
    expect(WEIGHTS.TCM).toBe(0.25);
    expect(WEIGHTS.SAS + WEIGHTS.PIS + WEIGHTS.BSS + WEIGHTS.TCM).toBe(1.0);
  });

  it("mastery scores seguem tabela S2.3", () => {
    expect(MASTERY_SCORES.maintained).toBe(100);
    expect(MASTERY_SCORES.mastered_validated).toBe(85);
    expect(MASTERY_SCORES.mastered).toBe(75);
  });

  it("prompt scale segue tabela S2.4", () => {
    expect(PROMPT_SCALE.independente).toBe(1.0);
    expect(PROMPT_SCALE.gestual).toBe(0.8);
    expect(PROMPT_SCALE.verbal).toBe(0.6);
    expect(PROMPT_SCALE.modelacao).toBe(0.4);
    expect(PROMPT_SCALE.fisica_parcial).toBe(0.2);
    expect(PROMPT_SCALE.fisica_total).toBe(0.0);
  });

  it("intensidade comportamental segue tabela S2.5", () => {
    expect(INTENSITY_VALUES.leve).toBe(0.25);
    expect(INTENSITY_VALUES.moderada).toBe(0.5);
    expect(INTENSITY_VALUES.alta).toBe(0.75);
    expect(INTENSITY_VALUES.severa).toBe(1.0);
  });

  it("engine version é string semver", () => {
    expect(CSO_ABA_ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

// ─── S2.3 — SAS (Skill Acquisition Score) ─────────

describe("calculateSAS — Bible S2.3", () => {
  it("retorna 0 quando não há alvos", () => {
    expect(calculateSAS([], [])).toBe(0);
  });

  it("calcula SAS_ativos corretamente (média ponderada por trials)", () => {
    // Sem alvos dominados, SAS = SAS_ativos × (1 - 0) = SAS_ativos
    const targets: TargetScore[] = [
      { score: 80, trials: 10 }, // 800
      { score: 60, trials: 5 },  // 300
    ];
    // SAS_ativos = (800 + 300) / (10 + 5) = 1100 / 15 ≈ 73.33
    const sas = calculateSAS(targets, []);
    expect(sas).toBeCloseTo(73.33, 1);
  });

  it("calcula mastery score para alvos com status maintained (100)", () => {
    const mastered = [{ status: "maintained" as MasteryStatus }];
    // mastery_rate = 1/1 = 1, SAS = 0 × 0 + 100 × 1 = 100
    const sas = calculateSAS([], mastered);
    expect(sas).toBe(100);
  });

  it("calcula mastery score para alvos com status mastered_validated (85)", () => {
    const mastered = [{ status: "mastered_validated" as MasteryStatus }];
    const sas = calculateSAS([], mastered);
    expect(sas).toBe(85);
  });

  it("calcula mastery score para alvos com status mastered (75)", () => {
    const mastered = [{ status: "mastered" as MasteryStatus }];
    const sas = calculateSAS([], mastered);
    expect(sas).toBe(75);
  });

  it("combina alvos ativos e dominados corretamente", () => {
    const active: TargetScore[] = [
      { score: 70, trials: 10 }, // SAS_ativos = 70
    ];
    const mastered = [
      { status: "maintained" as MasteryStatus }, // score = 100
    ];
    // total = 2, mastery_rate = 1/2 = 0.5
    // mastery_score = 100
    // SAS = 70 × 0.5 + 100 × 0.5 = 35 + 50 = 85
    const sas = calculateSAS(active, mastered);
    expect(sas).toBe(85);
  });

  it("respeita score customizado em alvos dominados (override da tabela)", () => {
    const mastered = [
      { status: "mastered" as MasteryStatus, score: 90 },
    ];
    // Override: usa 90 em vez do padrão 75
    const sas = calculateSAS([], mastered);
    expect(sas).toBe(90);
  });

  it("clamp: nunca retorna acima de 100", () => {
    // Forçar valor > 100 com scores artificialmente altos
    const active: TargetScore[] = [{ score: 120, trials: 10 }];
    const sas = calculateSAS(active, []);
    expect(sas).toBeLessThanOrEqual(100);
  });

  it("clamp: nunca retorna abaixo de 0", () => {
    const active: TargetScore[] = [{ score: 0, trials: 10 }];
    const sas = calculateSAS(active, []);
    expect(sas).toBeGreaterThanOrEqual(0);
  });

  it("múltiplos alvos dominados com status diferentes", () => {
    const mastered = [
      { status: "maintained" as MasteryStatus },         // 100
      { status: "mastered_validated" as MasteryStatus },  // 85
      { status: "mastered" as MasteryStatus },            // 75
    ];
    // mastery_score = (100 + 85 + 75) / 3 ≈ 86.67
    // mastery_rate = 3/3 = 1
    // SAS = 0 × 0 + 86.67 × 1 ≈ 86.67
    const sas = calculateSAS([], mastered);
    expect(sas).toBeCloseTo(86.67, 1);
  });
});

// ─── S2.4 — PIS (Prompt Independence Score) ───────

describe("calculatePIS — Bible S2.4", () => {
  it("retorna 0 quando não há alvos", () => {
    expect(calculatePIS([])).toBe(0);
  });

  it("100 quando todos os alvos são independentes", () => {
    const levels: PromptLevel[] = ["independente", "independente", "independente"];
    // mean = (1.0 + 1.0 + 1.0) / 3 = 1.0 → PIS = 100
    expect(calculatePIS(levels)).toBe(100);
  });

  it("0 quando todos os alvos são física total", () => {
    const levels: PromptLevel[] = ["fisica_total", "fisica_total"];
    // mean = (0.0 + 0.0) / 2 = 0 → PIS = 0
    expect(calculatePIS(levels)).toBe(0);
  });

  it("calcula média correta com níveis mistos", () => {
    const levels: PromptLevel[] = ["independente", "gestual", "verbal"];
    // mean = (1.0 + 0.8 + 0.6) / 3 = 2.4 / 3 = 0.8 → PIS = 80
    expect(calculatePIS(levels)).toBe(80);
  });

  it("calcula escala completa (todos os 6 níveis)", () => {
    const allLevels: PromptLevel[] = [
      "independente",   // 1.00
      "gestual",        // 0.80
      "verbal",         // 0.60
      "modelacao",      // 0.40
      "fisica_parcial", // 0.20
      "fisica_total",   // 0.00
    ];
    // mean = (1.0 + 0.8 + 0.6 + 0.4 + 0.2 + 0.0) / 6 = 3.0 / 6 = 0.5
    // PIS = 50
    expect(calculatePIS(allLevels)).toBe(50);
  });

  it("alvo único — modelação", () => {
    expect(calculatePIS(["modelacao"])).toBe(40);
  });
});

// ─── S2.5 — BSS (Behavioral Stability Score) ──────

describe("calculateBSS — Bible S2.5", () => {
  it("intensidade leve com trend_factor 1.0 → 75", () => {
    // BSS = 100 × (1 - 0.25) × 1.0 = 75
    expect(calculateBSS("leve", 1.0)).toBe(75);
  });

  it("intensidade moderada com trend_factor 1.0 → 50", () => {
    // BSS = 100 × (1 - 0.50) × 1.0 = 50
    expect(calculateBSS("moderada", 1.0)).toBe(50);
  });

  it("intensidade alta com trend_factor 1.0 → 25", () => {
    // BSS = 100 × (1 - 0.75) × 1.0 = 25
    expect(calculateBSS("alta", 1.0)).toBe(25);
  });

  it("intensidade severa → 0 independente do trend_factor", () => {
    // BSS = 100 × (1 - 1.0) × qualquer = 0
    expect(calculateBSS("severa", 1.0)).toBe(0);
    expect(calculateBSS("severa", 0.5)).toBe(0);
    expect(calculateBSS("severa", 2.0)).toBe(0);
  });

  it("trend_factor 0 → sempre 0", () => {
    expect(calculateBSS("leve", 0)).toBe(0);
    expect(calculateBSS("moderada", 0)).toBe(0);
  });

  it("trend_factor > 1 com intensidade leve pode exceder → clamp a 100", () => {
    // BSS = 100 × (1 - 0.25) × 1.5 = 112.5 → clamp → 100
    expect(calculateBSS("leve", 1.5)).toBe(100);
  });

  it("trend_factor 0.8 com intensidade moderada", () => {
    // BSS = 100 × (1 - 0.5) × 0.8 = 40
    expect(calculateBSS("moderada", 0.8)).toBe(40);
  });
});

// ─── S2.6 — TCM (Therapeutic Consistency Metric) ──

describe("calculateTCM — Bible S2.6", () => {
  it("retorna 75 (neutro) quando < 2 sessões", () => {
    expect(calculateTCM([])).toBe(75);
    expect(calculateTCM([80])).toBe(75);
  });

  it("sessões idênticas → CV = 0 → TCM = 100", () => {
    // Todos iguais: σ = 0, CV = 0, TCM = 100 × (1 - 0) = 100
    expect(calculateTCM([80, 80, 80, 80, 80])).toBe(100);
  });

  it("calcula CV corretamente para 5 sessões variáveis", () => {
    const scores = [70, 80, 90, 70, 80];
    // Média = 78, σ² = ((8²+2²+12²+8²+2²)/5) = (64+4+144+64+4)/5 = 56
    // σ = √56 ≈ 7.483, CV = 7.483/78 ≈ 0.09594
    // TCM = 100 × (1 - 0.09594) ≈ 90.41
    const tcm = calculateTCM(scores);
    expect(tcm).toBeCloseTo(90.41, 0);
  });

  it("usa apenas últimas 5 sessões quando há mais", () => {
    // As 3 primeiras devem ser ignoradas
    const scores = [10, 10, 10, 80, 80, 80, 80, 80];
    // Últimas 5: [80, 80, 80, 80, 80] → TCM = 100
    expect(calculateTCM(scores)).toBe(100);
  });

  it("alta variabilidade → TCM baixo", () => {
    const scores = [20, 90, 20, 90, 20];
    // Média = 48, σ² = ((28²+42²+28²+42²+28²)/5) = (784+1764+784+1764+784)/5 = 1176
    // σ ≈ 34.29, CV = 34.29/48 ≈ 0.7144
    // TCM = 100 × (1 - 0.7144) ≈ 28.56
    const tcm = calculateTCM(scores);
    expect(tcm).toBeCloseTo(28.56, 0);
  });

  it("2 sessões (mínimo para cálculo)", () => {
    const scores = [80, 80];
    // CV = 0 → TCM = 100
    expect(calculateTCM(scores)).toBe(100);
  });

  it("clamp: TCM nunca fica negativo mesmo com CV > 1", () => {
    // Scores com CV muito alto (ex: média pequena, alta variância)
    const scores = [1, 100, 1, 100, 1];
    const tcm = calculateTCM(scores);
    expect(tcm).toBeGreaterThanOrEqual(0);
  });

  it("média zero → retorna 0", () => {
    const scores = [0, 0, 0, 0, 0];
    expect(calculateTCM(scores)).toBe(0);
  });
});

// ─── S2.1 — Fórmula Principal CSO-ABA ─────────────

describe("calculateCsoAba — Bible S2.1", () => {
  it("todos os scores em 0 → CSO-ABA = 0", () => {
    expect(calculateCsoAba(0, 0, 0, 0)).toBe(0);
  });

  it("todos os scores em 100 → CSO-ABA = 100", () => {
    expect(calculateCsoAba(100, 100, 100, 100)).toBe(100);
  });

  it("pesos iguais 0.25 — cada dimensão contribui 25%", () => {
    // Apenas SAS = 100, resto 0
    expect(calculateCsoAba(100, 0, 0, 0)).toBe(25);
    // Apenas PIS = 100
    expect(calculateCsoAba(0, 100, 0, 0)).toBe(25);
    // Apenas BSS = 100
    expect(calculateCsoAba(0, 0, 100, 0)).toBe(25);
    // Apenas TCM = 100
    expect(calculateCsoAba(0, 0, 0, 100)).toBe(25);
  });

  it("cenário realista — Bible exemplo", () => {
    // SAS=80, PIS=70, BSS=75, TCM=90
    // CSO = 0.25×80 + 0.25×70 + 0.25×75 + 0.25×90
    //     = 20 + 17.5 + 18.75 + 22.5 = 78.75
    expect(calculateCsoAba(80, 70, 75, 90)).toBe(78.75);
  });

  it("clamp: resultado nunca excede 100", () => {
    // Impossível com pesos 0.25 e clamp individual, mas testar defensivamente
    expect(calculateCsoAba(100, 100, 100, 100)).toBeLessThanOrEqual(100);
  });
});

// ─── S2.7 — Faixas Interpretativas ────────────────

describe("getFaixa — Bible S2.7", () => {
  it("85-100 → excelente", () => {
    expect(getFaixa(85)).toBe("excelente");
    expect(getFaixa(100)).toBe("excelente");
    expect(getFaixa(92.5)).toBe("excelente");
  });

  it("70-84 → bom", () => {
    expect(getFaixa(70)).toBe("bom");
    expect(getFaixa(84)).toBe("bom");
    expect(getFaixa(84.99)).toBe("bom");
  });

  it("50-69 → atenção", () => {
    expect(getFaixa(50)).toBe("atencao");
    expect(getFaixa(69)).toBe("atencao");
    expect(getFaixa(69.99)).toBe("atencao");
  });

  it("0-49 → crítico", () => {
    expect(getFaixa(0)).toBe("critico");
    expect(getFaixa(49)).toBe("critico");
    expect(getFaixa(49.99)).toBe("critico");
  });

  it("limites exatos das faixas", () => {
    expect(getFaixa(85)).toBe("excelente");
    expect(getFaixa(84.99)).toBe("bom");
    expect(getFaixa(70)).toBe("bom");
    expect(getFaixa(69.99)).toBe("atencao");
    expect(getFaixa(50)).toBe("atencao");
    expect(getFaixa(49.99)).toBe("critico");
  });
});

// ─── computeFullCsoAba (integração) ────────────────

describe("computeFullCsoAba — integração completa", () => {
  it("cenário paciente com progresso excelente", () => {
    const result = computeFullCsoAba({
      activeTargets: [
        { score: 90, trials: 20 },
        { score: 85, trials: 15 },
      ],
      masteredTargets: [
        { status: "maintained" },         // 100
        { status: "mastered_validated" },  // 85
      ],
      promptLevels: ["independente", "independente", "gestual", "independente"],
      behaviorIntensity: "leve",
      trendFactor: 1.0,
      sessionScores: [85, 88, 90, 87, 89],
    });

    expect(result.sas).toBeGreaterThan(80);
    expect(result.pis).toBe(95); // mean([1,1,0.8,1]) = 0.95 × 100 = 95
    expect(result.bss).toBe(75); // 100 × (1-0.25) × 1.0 = 75
    expect(result.tcm).toBeGreaterThan(90);
    expect(result.csoAba).toBeGreaterThan(0);
    expect(result.faixa).toBeDefined();
    expect(["excelente", "bom", "atencao", "critico"]).toContain(result.faixa);
  });

  it("cenário paciente em crise (crítico)", () => {
    const result = computeFullCsoAba({
      activeTargets: [
        { score: 20, trials: 5 },
      ],
      masteredTargets: [],
      promptLevels: ["fisica_total", "fisica_parcial"],
      behaviorIntensity: "severa",
      trendFactor: 0.5,
      sessionScores: [20, 80, 10, 90, 15],
    });

    expect(result.sas).toBe(20);
    expect(result.pis).toBe(10); // mean([0.0, 0.2]) = 0.1 × 100 = 10
    expect(result.bss).toBe(0);  // severidade = 1.0 → BSS = 0
    expect(result.csoAba).toBeLessThan(50);
    expect(result.faixa).toBe("critico");
  });

  it("cenário neutro (início de tratamento — poucos dados)", () => {
    const result = computeFullCsoAba({
      activeTargets: [
        { score: 50, trials: 3 },
      ],
      masteredTargets: [],
      promptLevels: ["verbal"],
      behaviorIntensity: "moderada",
      trendFactor: 1.0,
      sessionScores: [50], // < 2 → TCM = 75
    });

    expect(result.sas).toBe(50);
    expect(result.pis).toBe(60);  // verbal = 0.6 × 100 = 60
    expect(result.bss).toBe(50);  // 100 × (1-0.5) × 1.0 = 50
    expect(result.tcm).toBe(75);  // < 2 sessões = neutro
    // CSO = 0.25×50 + 0.25×60 + 0.25×50 + 0.25×75 = 12.5+15+12.5+18.75 = 58.75
    expect(result.csoAba).toBeCloseTo(58.75, 2);
    expect(result.faixa).toBe("atencao");
  });

  it("retorna todas as propriedades esperadas", () => {
    const result = computeFullCsoAba({
      activeTargets: [{ score: 50, trials: 10 }],
      masteredTargets: [],
      promptLevels: ["verbal"],
      behaviorIntensity: "leve",
      trendFactor: 1.0,
      sessionScores: [70, 75],
    });

    expect(result).toHaveProperty("sas");
    expect(result).toHaveProperty("pis");
    expect(result).toHaveProperty("bss");
    expect(result).toHaveProperty("tcm");
    expect(result).toHaveProperty("csoAba");
    expect(result).toHaveProperty("faixa");
    expect(typeof result.sas).toBe("number");
    expect(typeof result.pis).toBe("number");
    expect(typeof result.bss).toBe("number");
    expect(typeof result.tcm).toBe("number");
    expect(typeof result.csoAba).toBe("number");
    expect(typeof result.faixa).toBe("string");
  });
});
