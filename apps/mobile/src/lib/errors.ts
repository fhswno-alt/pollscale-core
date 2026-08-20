import { captureException } from "./sentry";

export function errorMessage(error: unknown, fallback = "Something went wrong. Try again."): string {
  if (error && typeof error === "object" && "message" in error) {
    const detail = String((error as { message?: string }).message || "");
    if (detail === "guest_quota_exceeded") return "Sign in to keep voting.";
    if (detail === "already_voted") return "You already voted on this poll.";
    if (detail === "poll_not_found") return "That poll is gone.";
    if (detail === "rate_limited") return "Too many tries. Wait a minute and try again.";
    if (detail === "network" || detail.startsWith("http_5")) return "Pollscale is having trouble. Try again.";
    if (detail.startsWith("http_")) return fallback;
    if (detail && detail.length < 80 && !detail.includes(" ")) return fallback;
    if (detail) return detail;
  }
  return fallback;
}

export function reportError(error: unknown, context?: Record<string, unknown>): void {
  captureException(error, context);
}

export function isCancel(error: unknown): boolean {
  const code = error && typeof error === "object" ? (error as { code?: string }).code : "";
  return code === "ERR_REQUEST_CANCELED" || code === "ERR_CANCELED";
}
