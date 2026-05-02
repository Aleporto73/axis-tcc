// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { piiBeforeSend } from "./src/lib/sentry-pii";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const SENTRY_ENABLED =
  process.env.NODE_ENV === "production" && !!SENTRY_DSN;

const TRACES_SAMPLE_RATE = Number(
  process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0.05"
);

Sentry.init({
  dsn: SENTRY_DSN,
  enabled: SENTRY_ENABLED,

  tracesSampleRate: TRACES_SAMPLE_RATE,
  sendDefaultPii: false,
  enableLogs: false,

  beforeSend: piiBeforeSend,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
