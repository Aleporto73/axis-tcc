import { test as setup, expect } from '@playwright/test'

/**
 * Global Setup — Faz login via Clerk e salva storageState
 * Roda antes de todos os testes do projeto 'tdah-e2e'
 */

const authFile = 'e2e/.auth/user.json'

setup('authenticate via Clerk', async ({ page }) => {
  const email = process.env.E2E_CLERK_EMAIL
  const password = process.env.E2E_CLERK_PASSWORD

  if (!email || !password) {
    throw new Error(
      'E2E_CLERK_EMAIL e E2E_CLERK_PASSWORD devem estar definidos.\n' +
      'Exemplo: E2E_CLERK_EMAIL=teste@axisclinico.com E2E_CLERK_PASSWORD=xxx npx playwright test'
    )
  }

  // Navegar para sign-in do Clerk
  await page.goto('/sign-in')

  // Clerk sign-in form — aguardar o form renderizar
  await page.waitForSelector('input[name="identifier"], input[type="email"]', { timeout: 15_000 })

  // Preencher email
  const emailInput = page.locator('input[name="identifier"], input[type="email"]').first()
  await emailInput.fill(email)

  // Clicar em continuar/next
  const continueBtn = page.locator('button:has-text("Continue"), button:has-text("Continuar"), button[type="submit"]').first()
  await continueBtn.click()

  // Aguardar campo de senha aparecer
  await page.waitForSelector('input[type="password"]', { timeout: 10_000 })
  const passwordInput = page.locator('input[type="password"]').first()
  await passwordInput.fill(password)

  // Submeter
  const submitBtn = page.locator('button:has-text("Continue"), button:has-text("Continuar"), button:has-text("Sign in"), button:has-text("Entrar"), button[type="submit"]').first()
  await submitBtn.click()

  // Aguardar redirect para /hub (autenticado)
  await page.waitForURL('**/hub**', { timeout: 20_000 })
  await expect(page.locator('body')).toBeVisible()

  // Salvar estado de autenticação
  await page.context().storageState({ path: authFile })
})
