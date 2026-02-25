// ─── Vitest Global Setup ─────────────────────────
// Runs before every test file.

// Ensure NODE_ENV is set
process.env.NODE_ENV = "test";

// Silence console during tests (optional — comment out to debug)
// vi.spyOn(console, 'log').mockImplementation(() => {});
// vi.spyOn(console, 'warn').mockImplementation(() => {});
