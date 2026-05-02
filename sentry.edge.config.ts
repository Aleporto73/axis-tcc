// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { piiBeforeSend } from "./src/lib/sentry-pii";

const SENTRY_DSN = process.env.SENTRY_DSN;
const SENTRY_ENABLED =
  process.env.NODE_ENV === "production" && !!SENTRY_DSN;

const TRACES_SAMPLE_RATE = Number(
  process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.05"
);

Sentry.init({
  dsn: SENTRY_DSN,
  enabled: SENTRY_ENABLED,

  tracesSampleRate: TRACES_SAMPLE_RATE,
  sendDefaultPii: false,
  enableLogs: false,

  beforeSend: piiBeforeSend,
});
