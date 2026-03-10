// =====================================================
// AXIS ABA — Catálogo CID (CID-10 / CID-11)
// Códigos curados para diagnósticos mais comuns em ABA
// =====================================================

export type CIDSystem = 'CID-10' | 'CID-11'
export type DiagnosticGroup = 'TEA' | 'TDAH' | 'DI' | 'LINGUAGEM' | 'MOTOR' | 'OUTRO'

export interface CIDCode {
  code: string
  system: CIDSystem
  label_pt: string
  label_short: string
  group: DiagnosticGroup
  mapping?: string       // código equivalente no outro sistema
  is_core: boolean       // códigos mais usados na prática clínica
  synonyms: string[]     // termos de busca
}

// ─── Catálogo Mínimo Curado ───

export const CID_CATALOG: CIDCode[] = [
  // ─── TEA - CID-10 ───
  { code: 'F84.0', system: 'CID-10', label_pt: 'Autismo infantil', label_short: 'Autismo infantil', group: 'TEA', mapping: '6A02', is_core: true, synonyms: ['autismo', 'tea', 'autista'] },
  { code: 'F84.1', system: 'CID-10', label_pt: 'Autismo atípico', label_short: 'Autismo atípico', group: 'TEA', mapping: '6A02.Y', is_core: true, synonyms: ['autismo atípico'] },
  { code: 'F84.5', system: 'CID-10', label_pt: 'Síndrome de Asperger', label_short: 'Asperger', group: 'TEA', mapping: '6A02', is_core: true, synonyms: ['asperger', 'aspie'] },
  { code: 'F84.8', system: 'CID-10', label_pt: 'Outros transtornos globais do desenvolvimento', label_short: 'Outros TGD', group: 'TEA', mapping: '6A02.Y', is_core: false, synonyms: ['tgd'] },
  { code: 'F84.9', system: 'CID-10', label_pt: 'TGD não especificado', label_short: 'TGD NE', group: 'TEA', mapping: '6A02.Z', is_core: true, synonyms: ['tgd', 'pdd-nos'] },

  // ─── TEA - CID-11 ───
  { code: '6A02', system: 'CID-11', label_pt: 'Transtorno do Espectro do Autismo', label_short: 'TEA', group: 'TEA', mapping: 'F84.0', is_core: true, synonyms: ['tea', 'autismo', 'asd'] },
  { code: '6A02.0', system: 'CID-11', label_pt: 'TEA sem DI, linguagem preservada', label_short: 'TEA sem DI, ling+', group: 'TEA', is_core: true, synonyms: ['tea nível 1', 'tea leve'] },
  { code: '6A02.1', system: 'CID-11', label_pt: 'TEA com DI, linguagem preservada', label_short: 'TEA com DI, ling+', group: 'TEA', is_core: true, synonyms: ['tea com di'] },
  { code: '6A02.2', system: 'CID-11', label_pt: 'TEA sem DI, linguagem prejudicada', label_short: 'TEA sem DI, ling-', group: 'TEA', is_core: true, synonyms: ['tea moderado'] },
  { code: '6A02.3', system: 'CID-11', label_pt: 'TEA com DI, linguagem prejudicada', label_short: 'TEA com DI, ling-', group: 'TEA', is_core: true, synonyms: ['tea severo'] },
  { code: '6A02.4', system: 'CID-11', label_pt: 'TEA sem DI, sem linguagem funcional', label_short: 'TEA sem DI, s/ling', group: 'TEA', is_core: true, synonyms: ['tea não verbal'] },
  { code: '6A02.5', system: 'CID-11', label_pt: 'TEA com DI, sem linguagem funcional', label_short: 'TEA com DI, s/ling', group: 'TEA', is_core: true, synonyms: ['tea grave', 'tea profundo'] },
  { code: '6A02.Y', system: 'CID-11', label_pt: 'Outro TEA especificado', label_short: 'Outro TEA', group: 'TEA', mapping: 'F84.8', is_core: false, synonyms: ['outro tea'] },
  { code: '6A02.Z', system: 'CID-11', label_pt: 'TEA não especificado', label_short: 'TEA NE', group: 'TEA', mapping: 'F84.9', is_core: true, synonyms: ['tea ne'] },

  // ─── TDAH - CID-10 ───
  { code: 'F90.0', system: 'CID-10', label_pt: 'Distúrbios da atividade e da atenção', label_short: 'TDAH desatento', group: 'TDAH', mapping: '6A05.0', is_core: true, synonyms: ['tdah', 'dda', 'déficit de atenção', 'desatento'] },
  { code: 'F90.1', system: 'CID-10', label_pt: 'Transtorno hipercinético de conduta', label_short: 'TDAH hiperativo', group: 'TDAH', mapping: '6A05.2', is_core: true, synonyms: ['hiperativo', 'hipercinético'] },
  { code: 'F90.8', system: 'CID-10', label_pt: 'Outros transtornos hipercinéticos', label_short: 'Outros TDAH', group: 'TDAH', mapping: '6A05.Y', is_core: false, synonyms: ['outro tdah'] },
  { code: 'F90.9', system: 'CID-10', label_pt: 'Transtorno hipercinético NE', label_short: 'TDAH NE', group: 'TDAH', mapping: '6A05.Z', is_core: true, synonyms: ['tdah ne'] },

  // ─── TDAH - CID-11 ───
  { code: '6A05', system: 'CID-11', label_pt: 'Transtorno do déficit de atenção com hiperatividade', label_short: 'TDAH', group: 'TDAH', mapping: 'F90.0', is_core: true, synonyms: ['tdah', 'adhd'] },
  { code: '6A05.0', system: 'CID-11', label_pt: 'TDAH predominantemente desatento', label_short: 'TDAH desatento', group: 'TDAH', mapping: 'F90.0', is_core: true, synonyms: ['tdah desatento', 'dda'] },
  { code: '6A05.1', system: 'CID-11', label_pt: 'TDAH predominantemente hiperativo-impulsivo', label_short: 'TDAH hiperativo', group: 'TDAH', is_core: true, synonyms: ['tdah hiperativo', 'impulsivo'] },
  { code: '6A05.2', system: 'CID-11', label_pt: 'TDAH apresentação combinada', label_short: 'TDAH combinado', group: 'TDAH', mapping: 'F90.1', is_core: true, synonyms: ['tdah combinado', 'tdah misto'] },
  { code: '6A05.Y', system: 'CID-11', label_pt: 'TDAH outra apresentação', label_short: 'Outro TDAH', group: 'TDAH', mapping: 'F90.8', is_core: false, synonyms: ['outro tdah'] },
  { code: '6A05.Z', system: 'CID-11', label_pt: 'TDAH não especificado', label_short: 'TDAH NE', group: 'TDAH', mapping: 'F90.9', is_core: true, synonyms: ['tdah ne'] },

  // ─── DI - CID-10 ───
  { code: 'F70', system: 'CID-10', label_pt: 'Retardo mental leve', label_short: 'DI leve', group: 'DI', mapping: '6A00.0', is_core: true, synonyms: ['di leve', 'deficiência intelectual leve'] },
  { code: 'F71', system: 'CID-10', label_pt: 'Retardo mental moderado', label_short: 'DI moderada', group: 'DI', mapping: '6A00.1', is_core: true, synonyms: ['di moderada'] },
  { code: 'F72', system: 'CID-10', label_pt: 'Retardo mental grave', label_short: 'DI grave', group: 'DI', mapping: '6A00.2', is_core: true, synonyms: ['di grave', 'di severa'] },
  { code: 'F73', system: 'CID-10', label_pt: 'Retardo mental profundo', label_short: 'DI profunda', group: 'DI', mapping: '6A00.3', is_core: false, synonyms: ['di profunda'] },
  { code: 'F79', system: 'CID-10', label_pt: 'Retardo mental NE', label_short: 'DI NE', group: 'DI', mapping: '6A00.Z', is_core: true, synonyms: ['di ne'] },

  // ─── DI - CID-11 ───
  { code: '6A00', system: 'CID-11', label_pt: 'Transtornos do desenvolvimento intelectual', label_short: 'DI', group: 'DI', is_core: true, synonyms: ['di', 'deficiência intelectual'] },
  { code: '6A00.0', system: 'CID-11', label_pt: 'DI leve', label_short: 'DI leve', group: 'DI', mapping: 'F70', is_core: true, synonyms: ['di leve'] },
  { code: '6A00.1', system: 'CID-11', label_pt: 'DI moderada', label_short: 'DI moderada', group: 'DI', mapping: 'F71', is_core: true, synonyms: ['di moderada'] },
  { code: '6A00.2', system: 'CID-11', label_pt: 'DI grave', label_short: 'DI grave', group: 'DI', mapping: 'F72', is_core: true, synonyms: ['di grave'] },
  { code: '6A00.3', system: 'CID-11', label_pt: 'DI profunda', label_short: 'DI profunda', group: 'DI', mapping: 'F73', is_core: false, synonyms: ['di profunda'] },
  { code: '6A00.Z', system: 'CID-11', label_pt: 'DI não especificada', label_short: 'DI NE', group: 'DI', mapping: 'F79', is_core: true, synonyms: ['di ne'] },

  // ─── LINGUAGEM - CID-10 ───
  { code: 'F80.1', system: 'CID-10', label_pt: 'Transtorno expressivo de linguagem', label_short: 'Transt. expressivo', group: 'LINGUAGEM', mapping: '6A01.2', is_core: true, synonyms: ['transtorno expressivo', 'tel'] },
  { code: 'F80.2', system: 'CID-10', label_pt: 'Transtorno receptivo da linguagem', label_short: 'Transt. receptivo', group: 'LINGUAGEM', mapping: '6A01.20', is_core: true, synonyms: ['transtorno receptivo'] },
  { code: 'F80.9', system: 'CID-10', label_pt: 'Transtorno de linguagem NE', label_short: 'Transt. ling. NE', group: 'LINGUAGEM', mapping: '6A01.Z', is_core: false, synonyms: ['atraso linguagem'] },

  // ─── LINGUAGEM - CID-11 ───
  { code: '6A01', system: 'CID-11', label_pt: 'Distúrbios da fala ou linguagem', label_short: 'Transt. linguagem', group: 'LINGUAGEM', is_core: true, synonyms: ['dld', 'distúrbio fala'] },
  { code: '6A01.2', system: 'CID-11', label_pt: 'Distúrbio de linguagem de desenvolvimento', label_short: 'DLD', group: 'LINGUAGEM', mapping: 'F80.1', is_core: true, synonyms: ['dld', 'tel'] },
  { code: '6A01.20', system: 'CID-11', label_pt: 'DLD receptivo e expressivo', label_short: 'DLD misto', group: 'LINGUAGEM', mapping: 'F80.2', is_core: true, synonyms: ['dld misto'] },
  { code: '6A01.Z', system: 'CID-11', label_pt: 'DLD não especificado', label_short: 'DLD NE', group: 'LINGUAGEM', mapping: 'F80.9', is_core: false, synonyms: ['dld ne'] },

  // ─── MOTOR ───
  { code: 'F82', system: 'CID-10', label_pt: 'Transtorno do desenvolvimento motor', label_short: 'Transt. motor', group: 'MOTOR', mapping: '6A04', is_core: false, synonyms: ['coordenação', 'dispraxia', 'tdc'] },
  { code: '6A04', system: 'CID-11', label_pt: 'Transtorno de coordenação motora', label_short: 'TDC', group: 'MOTOR', mapping: 'F82', is_core: false, synonyms: ['tdc', 'dcd', 'dispraxia'] },

  // ─── OUTROS ───
  { code: 'F84.2', system: 'CID-10', label_pt: 'Síndrome de Rett', label_short: 'Rett', group: 'OUTRO', mapping: '8A25.00', is_core: false, synonyms: ['rett'] },
  { code: 'F95.2', system: 'CID-10', label_pt: 'Síndrome de Tourette', label_short: 'Tourette', group: 'OUTRO', mapping: '8A05.00', is_core: false, synonyms: ['tourette', 'tiques'] },
]

// ─── Funções Auxiliares ───

/** Busca códigos CID por termo (código, label ou sinônimo) */
export function searchCID(query: string, system?: CIDSystem): CIDCode[] {
  const q = query.toLowerCase().trim()
  if (!q) return []

  return CID_CATALOG.filter(c => {
    if (system && c.system !== system) return false
    return (
      c.code.toLowerCase().includes(q) ||
      c.label_pt.toLowerCase().includes(q) ||
      c.label_short.toLowerCase().includes(q) ||
      c.synonyms.some(s => s.toLowerCase().includes(q))
    )
  })
}

/** Retorna códigos do catálogo mínimo (is_core = true) */
export function getCoreCatalog(system?: CIDSystem): CIDCode[] {
  return CID_CATALOG.filter(c => {
    if (system && c.system !== system) return false
    return c.is_core
  })
}

/** Retorna o código equivalente no outro sistema */
export function getMappedCode(code: string): CIDCode | undefined {
  const original = CID_CATALOG.find(c => c.code === code)
  if (!original?.mapping) return undefined
  return CID_CATALOG.find(c => c.code === original.mapping)
}

/** Agrupa códigos por grupo diagnóstico */
export function groupByDiagnosticGroup(codes: CIDCode[]): Partial<Record<DiagnosticGroup, CIDCode[]>> {
  return codes.reduce((acc, code) => {
    if (!acc[code.group]) acc[code.group] = []
    acc[code.group]!.push(code)
    return acc
  }, {} as Partial<Record<DiagnosticGroup, CIDCode[]>>)
}

/** Busca um código específico no catálogo */
export function findCIDCode(code: string): CIDCode | undefined {
  return CID_CATALOG.find(c => c.code === code)
}

/** Labels dos grupos para exibição */
export const GROUP_LABELS: Record<DiagnosticGroup, string> = {
  TEA: 'TEA / Autismo',
  TDAH: 'TDAH',
  DI: 'Deficiência Intelectual',
  LINGUAGEM: 'Linguagem',
  MOTOR: 'Motor',
  OUTRO: 'Outros',
}
