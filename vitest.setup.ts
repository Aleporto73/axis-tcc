// ─── Vitest Global Setup ─────────────────────────
// Runs before every test file.

import { vi } from 'vitest'

// NODE_ENV is read-only in Next.js 16 — vitest sets it automatically
// process.env.NODE_ENV = "test";

// Silence console during tests (optional — comment out to debug)
// vi.spyOn(console, 'log').mockImplementation(() => {});
// vi.spyOn(console, 'warn').mockImplementation(() => {});

// ─── Mock global: rate-limit middleware ──────────
// Em testes, rateLimit() recebe mock requests sem .headers.get(),
// causando excecao em getIP() e mascarando status codes esperados (401/404 -> 500).
// Mock retorna null (= permite request) em todos os testes.
// Endpoints com rate-limit em prod: push/send, aba/google/webhook, aba/portal,
// escola/[token], escola/[token]/drc, transcribe-audio, analyze-clinical,
// portal/[token], portal/invite, familia/[token].
vi.mock('@/src/middleware/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue(null),
  withRateLimit: vi.fn((handler) => handler),
}))
