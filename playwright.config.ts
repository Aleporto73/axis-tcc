import { defineConfig, devices } from '@playwright/test'

/**
 * AXIS TDAH — Playwright E2E Config
 *
 * Variáveis de ambiente necessárias:
 *   E2E_BASE_URL       — URL da aplicação (default: http://localhost:3000)
 *   E2E_CLERK_EMAIL    — Email do usuário de teste (Clerk)
 *   E2E_CLERK_PASSWORD — Senha do usuário de teste (Clerk)
 *
 * Executar:
 *   npx playwright test                 — todos os testes
 *   npx playwright test e2e/tdah-flow   — apenas fluxo TDAH
 *   npx playwright test --headed        — modo visual
 *   npx playwright test --ui            — modo interativo
 */

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,         // Fluxo sequencial (cada passo depende do anterior)
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,                   // Sequencial — state compartilhado entre testes
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  timeout: 60_000,              // 60s por teste (operações clínicas podem ser lentas)
  expect: {
    timeout: 10_000,
  },

  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'setup',
      testMatch: /global-setup\.ts/,
    },
    {
      name: 'tdah-e2e',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
})
