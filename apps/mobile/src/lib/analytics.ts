import { Platform } from "react-native";

export const FUNNEL_EVENTS = [
  "onboarding_started",
  "onboarding_name",
  "onboarding_username",
  "onboarding_dob",
  "onboarding_city",
  "onboarding_interests",
  "onboarding_completed",
  "first_vote",
] as const;

export type FunnelEvent = (typeof FUNNEL_EVENTS)[number];

const HOST = (process.env.EXPO_PUBLIC_POSTHOG_HOST || "").replace(/\/$/, "");
const KEY = process.env.EXPO_PUBLIC_POSTHOG_PROJECT_API_KEY || "";

type Identify = {
  userId?: string | null;
  deviceId: string;
};

function distinctId(who: Identify) {
  return who.userId || `device:${who.deviceId}`;
}

export function trackFunnel(event: FunnelEvent, who: Identify, properties?: Record<string, unknown>) {
  if (!KEY || !HOST) return;
  const body = {
    api_key: KEY,
    event,
    distinct_id: distinctId(who),
    properties: {
      ...properties,
      $lib: "pollscale-mobile",
      $os: Platform.OS,
    },
  };
  fetch(`${HOST}/capture/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => undefined);
}

export function identifyUser(who: Identify, properties?: Record<string, unknown>) {
  if (!KEY || !HOST || !who.userId) return;
  fetch(`${HOST}/capture/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: KEY,
      event: "$identify",
      distinct_id: who.userId,
      properties: {
        $anon_distinct_id: `device:${who.deviceId}`,
        ...properties,
      },
    }),
  }).catch(() => undefined);
}
