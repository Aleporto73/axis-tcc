// app/lib/pdf-helpers.ts
//
// Helper compartilhado pra setup de jsPDF com suporte UTF-8 PT-BR completo.
// Substitui Helvetica default + elimina necessidade de stripAccents.
//
// Font embedded: DejaVu Sans v2.37 (TrueType, ~742 KB raw / ~1 MB base64).
// Public domain (Bitstream + Tavmjong Bah). Cobertura Unicode: Latin-1 + Latin Extended A/B
// + diacríticos PT-BR completos (ã ç é ê í ó ô õ ú á à â).
//
// Bundle strategy: dynamic import garante 1 MB carregado on-demand (na primeira geração de PDF),
// não no first-load da página. Cache singleton (fontLoadPromise) evita recarregar entre múltiplas
// gerações na mesma sessão browser.
//
// PDF strategy: use `new jsPDF({ subsetFonts: true })` em conjunto. jsPDF embed APENAS
// os caracteres realmente usados, reduzindo PDF gerado de ~750 KB pra ~50 KB.
//
// Uso:
//   const doc = new jsPDF({ subsetFonts: true })
//   await setupPdfWithDejaVu(doc)
//   doc.text('Sessão: Relatório clínico', 10, 20)  // acentos preservados nativamente

import jsPDF from 'jspdf'

// Cache singleton: 1 MB carregado UMA VEZ por sessão browser.
let fontLoadPromise: Promise<string> | null = null

async function loadDejaVuSans(): Promise<string> {
  if (!fontLoadPromise) {
    fontLoadPromise = import('./dejavu-sans').then((m) => m.dejavuSansBase64)
  }
  return fontLoadPromise
}

/**
 * Configura um jsPDF instance com DejaVu Sans (suporte UTF-8 PT-BR completo).
 *
 * - Carrega a font base64 via dynamic import (~1 MB on-demand, cacheado).
 * - Adiciona à VFS interna do jsPDF + registra como família 'DejaVuSans'.
 * - Define como font ativa do doc.
 *
 * Após este setup, `doc.text(...)` e `doc.splitTextToSize(...)` aceitam strings
 * UTF-8 com acentos PT-BR sem necessidade de NFD/strip.
 *
 * @param doc Instância jsPDF (idealmente criada com { subsetFonts: true })
 */
export async function setupPdfWithDejaVu(doc: jsPDF): Promise<void> {
  const fontBase64 = await loadDejaVuSans()

  // jsPDF v4 runtime APIs `addFileToVFS` e `addFont` são funcionais mas podem não
  // estar declaradas em @types/jspdf v1.3.3 (era v1, antes do split modular v4).
  // Cast pontual pra runtime call sem TS error. Mitigação correta seria upgrade
  // de @types/jspdf pra v2+, mas v2 é stub deprecation (vide Item 27 análise).
  const docAny = doc as any
  docAny.addFileToVFS('DejaVuSans.ttf', fontBase64)
  docAny.addFont('DejaVuSans.ttf', 'DejaVuSans', 'normal')

  doc.setFont('DejaVuSans', 'normal')
}
