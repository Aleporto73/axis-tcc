// src/lib/sentry-pii.ts
//
// Util compartilhado entre os 3 configs Sentry — PII redaction unificada.
// Single source of truth para SENSITIVE_KEYS, redactKeys e piiBeforeSend.
//
// Compatível com edge runtime (zero APIs Node.js, apenas Web Standards).

import type { ErrorEvent, EventHint } from "@sentry/nextjs";

// Chaves que nunca podem sair do ambiente — PII clinica + credenciais.
// Match case-insensitive em qualquer profundidade de objeto estruturado.
export const SENSITIVE_KEYS = new Set<string>([
  "password", "pwd", "secret", "token", "api_key", "apikey",
  "authorization", "cookie", "session", "jwt", "bearer",
  "email", "cpf", "phone", "tel", "address", "endereco",
  "birth_date", "birthdate", "data_nascimento",
  "name", "nome", "patient_name", "patientname",
  "guardian_name", "responsavel",
  "transcript", "transcription", "transcript_text", "text", "content",
  "notes", "notas", "observations", "observacoes",
]);

export function redactKeys(obj: unknown, depth = 0): unknown {
  if (depth > 6 || obj == null) return obj;
  if (Array.isArray(obj)) return obj.map((v) => redactKeys(v, depth + 1));
  if (typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(k.toLowerCase())) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redactKeys(v, depth + 1);
      }
    }
    return out;
  }
  return obj;
}

export function piiBeforeSend(event: ErrorEvent, _hint: EventHint): ErrorEvent {
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.query_string;
    if (event.request.headers) {
      const h = event.request.headers as Record<string, string>;
      for (const key of Object.keys(h)) {
        if (SENSITIVE_KEYS.has(key.toLowerCase())) {
          h[key] = "[REDACTED]";
        }
      }
    }
  }
  if (event.user) {
    event.user = event.user.id ? { id: event.user.id } : {};
  }
  if (event.extra)    event.extra    = redactKeys(event.extra)    as typeof event.extra;
  if (event.contexts) event.contexts = redactKeys(event.contexts) as typeof event.contexts;
  if (event.tags)     event.tags     = redactKeys(event.tags)     as typeof event.tags;
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((bc) => ({
      ...bc,
      data: bc.data ? (redactKeys(bc.data) as typeof bc.data) : bc.data,
    }));
  }
  return event;
}
