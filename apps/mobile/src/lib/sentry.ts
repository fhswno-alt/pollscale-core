import { Platform } from "react-native";

const DSN = (process.env.EXPO_PUBLIC_SENTRY_DSN || "").trim();

type SentryModule = typeof import("@sentry/react-native");

let sentry: SentryModule | null = null;
let ready = false;

export function sentryDsn(): string {
  return DSN;
}

export function isSentryEnabled(): boolean {
  return Boolean(DSN) && ready;
}

export function initSentry(): boolean {
  if (!DSN || ready) return ready;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sentry = require("@sentry/react-native") as SentryModule;
    sentry.init({
      dsn: DSN,
      enabled: true,
      enableNative: Platform.OS !== "web",
      tracesSampleRate: 0.15,
      environment: process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT || "development",
    });
    ready = true;
    return true;
  } catch {
    sentry = null;
    ready = false;
    return false;
  }
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!error) return;
  if (!isSentryEnabled() || !sentry) return;
  try {
    sentry.withScope((scope) => {
      if (context) scope.setContext("pollscale", context);
      sentry!.captureException(error);
    });
  } catch {
    // reporting must never crash the app
  }
}

export function captureMessage(message: string): void {
  if (!isSentryEnabled() || !sentry) return;
  try {
    sentry.captureMessage(message);
  } catch {
    // no-op
  }
}

