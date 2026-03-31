/**
 * Transcript Post-Processing Pipeline v1.0.0
 *
 * Pipeline leve, conservador e determinístico para melhorar a legibilidade
 * da transcrição sem alterar sentido clínico.
 *
 * Princípios:
 *   - Não usa LLM, API externa, correção "inteligente"
 *   - Preserva o texto bruto em disco para auditoria
 *   - Determinístico: mesma entrada = mesma saída
 *   - Reversível: raw_text sempre acessível
 *   - Versionado: postprocess_version acompanha cada registro
 *
 * Pipeline v1.0.0 executa na ordem:
 *   1. cleanTechnicalNoise
 *   2. protectClinicalTerms
 *   3. applySafeDictionaryCorrections
 *   4. restoreClinicalTerms
 *   — applyLightPunctuation NÃO roda na v1.0 (risco clínico)
 *
 * Referência: Documento Mestre TCC v2.1, Guardrails AXIS
 */

export const POSTPROCESS_VERSION = '1.0.0'

// ─────────────────────────────────────────────
// 1. CLEAN TECHNICAL NOISE
// ─────────────────────────────────────────────

/**
 * Limpeza mecânica de ruído técnico do ASR.
 * Não troca palavra, não resume, não reorganiza.
 */
export function cleanTechnicalNoise(text: string): string {
  let result = text

  // Trim geral
  result = result.trim()

  // Normalizar espaços múltiplos (2+) para um só
  result = result.replace(/ {2,}/g, ' ')

  // Normalizar 3+ quebras de linha para no máximo 2
  result = result.replace(/\n{3,}/g, '\n\n')

  // Remover espaços antes de quebra de linha
  result = result.replace(/ +\n/g, '\n')

  // Remover espaços no início de cada linha
  result = result.replace(/\n +/g, '\n')

  // Normalizar aspas curvas para retas (consistência)
  result = result.replace(/[\u201C\u201D]/g, '"') // " " → "
  result = result.replace(/[\u2018\u2019]/g, "'") // ' ' → '

  // Normalizar travessões longos para hífen-travessão simples
  result = result.replace(/[\u2013\u2014]/g, ' - ') // – — → -
  result = result.replace(/ {2,}/g, ' ') // limpar espaços duplos gerados

  return result
}

// ─────────────────────────────────────────────
// 2. PROTECT CLINICAL TERMS
// ─────────────────────────────────────────────

/**
 * Lista de termos clínicos protegidos.
 * Ordenados do maior para o menor para evitar matches parciais.
 * Expandível conforme necessidade clínica.
 */
const CLINICAL_TERMS = [
  'reestruturação cognitiva',
  'ativação comportamental',
  'pensamentos automáticos',
  'pensamento automático',
  'distorção cognitiva',
  'distorções cognitivas',
  'exposição gradual',
  'comparação social',
  'higiene do sono',
  'crença central',
  'crenças centrais',
  'filtro mental',
  'desesperança',
  'ruminação',
  'evitação',
  'TCC',
].sort((a, b) => b.length - a.length)

/** Armazena as ocorrências protegidas */
interface ProtectedOccurrence {
  placeholder: string
  original: string
}

let _protectedOccurrences: ProtectedOccurrence[] = []

/**
 * Protege termos clínicos substituindo por placeholders temporários.
 * Preserva a forma exata encontrada (caixa, acentuação).
 * Cada ocorrência recebe um placeholder único.
 */
export function protectClinicalTerms(text: string): string {
  _protectedOccurrences = []
  let result = text
  let counter = 0

  for (const term of CLINICAL_TERMS) {
    const regex = new RegExp(escapeRegex(term), 'gi')
    result = result.replace(regex, (match) => {
      const placeholder = `__AXIS_PROT_${counter}__`
      _protectedOccurrences.push({ placeholder, original: match })
      counter++
      return placeholder
    })
  }

  return result
}

/**
 * Restaura todos os termos clínicos protegidos.
 * Devolve cada ocorrência exatamente como foi encontrada.
 */
export function restoreClinicalTerms(text: string): string {
  let result = text
  // Restaurar em ordem reversa para evitar conflitos de placeholder
  for (let i = _protectedOccurrences.length - 1; i >= 0; i--) {
    const { placeholder, original } = _protectedOccurrences[i]
    result = result.replace(placeholder, original)
  }
  _protectedOccurrences = []
  return result
}

// ─────────────────────────────────────────────
// 3. SAFE DICTIONARY CORRECTIONS
// ─────────────────────────────────────────────

/**
 * Dicionário de correções seguras do ASR.
 *
 * Governança:
 *   - Cada entrada deve nascer de erro real observado em produção
 *   - Substituição com confiança alta
 *   - Nunca corrigir termos ambíguos
 *   - Não adivinhar conteúdo
 *
 * Formato: [regex case-insensitive, substituição]
 * Usar word boundaries (\b) para evitar matches parciais.
 */
const SAFE_CORRECTIONS: Array<[RegExp, string]> = [
  // Erros reais observados no Whisper com áudio PT-BR
  [/\bcompareção social\b/gi, 'comparação social'],
  [/\bpensamento automáticos\b/gi, 'pensamentos automáticos'],
  [/\bdistorção conginitiva\b/gi, 'distorção cognitiva'],
  [/\bdistorções conginitivas\b/gi, 'distorções cognitivas'],
  [/\breestrturação\b/gi, 'reestruturação'],
  [/\bcomportamentual\b/gi, 'comportamental'],
  [/\bpsicoterapeuta\b/gi, 'psicoterapeuta'], // manter correto
  [/\bcognitivo comportamental\b/gi, 'cognitivo-comportamental'],
]

/**
 * Aplica correções seguras baseadas em dicionário explícito.
 * Não faz correção "inteligente" — só substituições mapeadas.
 */
export function applySafeDictionaryCorrections(text: string): string {
  let result = text
  for (const [pattern, replacement] of SAFE_CORRECTIONS) {
    result = result.replace(pattern, replacement)
  }
  return result
}

// ─────────────────────────────────────────────
// 4. LIGHT PUNCTUATION (DESLIGADA na v1.0)
// ─────────────────────────────────────────────

/**
 * Pontuação leve automática.
 *
 * ⚠️ NÃO ATIVA na v1.0.0 — risco clínico.
 * Pontuação em fala espontânea pode alterar sentido terapêutico.
 * Requer validação com exemplos reais antes de ativar.
 *
 * Preparada para futura v1.1 quando houver confiança clínica.
 */
export function applyLightPunctuation(text: string): string {
  let result = text

  // Capitalizar primeira letra após ponto final + espaço
  result = result.replace(/\. ([a-záàâãéèêíïóôõúüç])/g, (_, char) => {
    return '. ' + char.toUpperCase()
  })

  // Capitalizar início do texto
  if (result.length > 0) {
    result = result[0].toUpperCase() + result.slice(1)
  }

  return result
}

// ─────────────────────────────────────────────
// PIPELINE PRINCIPAL
// ─────────────────────────────────────────────

/**
 * Pipeline completo de pós-processamento v1.0.0.
 *
 * Ordem fixa:
 *   1. cleanTechnicalNoise — limpeza mecânica
 *   2. protectClinicalTerms — blindar termos clínicos
 *   3. applySafeDictionaryCorrections — correções seguras
 *   4. restoreClinicalTerms — devolver termos originais
 *   — applyLightPunctuation NÃO roda (v1.0)
 *
 * @param rawText - Saída bruta do ASR
 * @returns Texto pós-processado
 */
export function postProcessTranscript(rawText: string): string {
  if (!rawText || rawText.trim().length === 0) return rawText

  let text = rawText

  // Etapa 1: limpeza mecânica
  text = cleanTechnicalNoise(text)

  // Etapa 2: proteger termos clínicos
  text = protectClinicalTerms(text)

  // Etapa 3: correções seguras de dicionário
  text = applySafeDictionaryCorrections(text)

  // Etapa 4: restaurar termos clínicos protegidos
  text = restoreClinicalTerms(text)

  // applyLightPunctuation(text) — DESLIGADA na v1.0.0

  return text
}

// ─────────────────────────────────────────────
// PREVIEW
// ─────────────────────────────────────────────

/**
 * Gera preview centralizado a partir do final_text.
 * Única fonte de truth para regra de truncamento + "..."
 *
 * @param text - Texto completo (preferencialmente final_text)
 * @param maxLength - Tamanho máximo do preview (default 500)
 */
export function buildPreview(text: string, maxLength: number = 500): string {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trimEnd() + '...'
}

// ─────────────────────────────────────────────
// UTIL
// ─────────────────────────────────────────────

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
