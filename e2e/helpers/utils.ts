import { Page, expect } from '@playwright/test'
import { TIMEOUTS } from './constants'

/**
 * Helpers reutilizáveis para testes E2E TDAH
 */

/** Aguardar resposta de API e verificar status */
export async function waitForApi(page: Page, urlPattern: string | RegExp, status = 200) {
  const response = await page.waitForResponse(
    (resp) => {
      const url = resp.url()
      if (typeof urlPattern === 'string') return url.includes(urlPattern) && resp.status() === status
      return urlPattern.test(url) && resp.status() === status
    },
    { timeout: TIMEOUTS.apiResponse }
  )
  return response
}

/** Aguardar API e retornar JSON */
export async function waitForApiJson<T = unknown>(page: Page, urlPattern: string | RegExp, status = 200): Promise<T> {
  const response = await waitForApi(page, urlPattern, status)
  return response.json() as Promise<T>
}

/** Navegar para rota TDAH via sidebar */
export async function navigateTdah(page: Page, linkText: string) {
  await page.locator(`a:has-text("${linkText}")`).first().click()
  await page.waitForLoadState('networkidle', { timeout: TIMEOUTS.navigation })
}

/** Aguardar modal abrir (procura overlay ou dialog) */
export async function waitForModal(page: Page) {
  await page.waitForSelector('[role="dialog"], [class*="modal"], [class*="Modal"]', {
    timeout: TIMEOUTS.modalOpen,
  })
}

/** Preencher campo por label ou placeholder */
export async function fillField(page: Page, identifier: string, value: string) {
  // Tenta por placeholder primeiro, depois por label text
  const byPlaceholder = page.locator(`input[placeholder*="${identifier}"], textarea[placeholder*="${identifier}"]`).first()
  if (await byPlaceholder.isVisible({ timeout: 1000 }).catch(() => false)) {
    await byPlaceholder.fill(value)
    return
  }

  // Tenta por label
  const byLabel = page.locator(`label:has-text("${identifier}") + input, label:has-text("${identifier}") + textarea, label:has-text("${identifier}") ~ input, label:has-text("${identifier}") ~ textarea`).first()
  if (await byLabel.isVisible({ timeout: 1000 }).catch(() => false)) {
    await byLabel.fill(value)
    return
  }

  // Fallback: qualquer input/textarea com o texto no name ou id
  const byAttr = page.locator(`input[name*="${identifier}"], textarea[name*="${identifier}"], input[id*="${identifier}"]`).first()
  await byAttr.fill(value)
}

/** Selecionar opção em dropdown (select) */
export async function selectOption(page: Page, identifier: string, value: string) {
  const select = page.locator(`select[name*="${identifier}"], select[id*="${identifier}"]`).first()
  if (await select.isVisible({ timeout: 2000 }).catch(() => false)) {
    await select.selectOption(value)
    return
  }
  // Fallback por label
  const byLabel = page.locator(`label:has-text("${identifier}") ~ select`).first()
  await byLabel.selectOption(value)
}

/** Screenshot helper para debug */
export async function debugScreenshot(page: Page, name: string) {
  await page.screenshot({ path: `e2e/screenshots/${name}.png`, fullPage: true })
}

/** Extrair texto de elemento */
export async function getText(page: Page, selector: string): Promise<string> {
  const el = page.locator(selector).first()
  await el.waitFor({ timeout: TIMEOUTS.apiResponse })
  return (await el.textContent()) || ''
}

/** Verificar que estamos na rota correta */
export async function expectRoute(page: Page, pathIncludes: string) {
  await expect(page).toHaveURL(new RegExp(pathIncludes), { timeout: TIMEOUTS.navigation })
}
