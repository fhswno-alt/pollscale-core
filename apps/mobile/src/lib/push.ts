import Constants from "expo-constants";
import { Platform } from "react-native";

import { api } from "./api";
import { reportError } from "./errors";

const CHANNEL_ID = "pollscale-default";

function expoProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId || Constants.easConfig?.projectId || undefined;
}

export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  const Notifications = await import("expo-notifications");
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Pollscale",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 180],
    lightColor: "#E8FF3D",
  });
}

export async function hasNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const Notifications = await import("expo-notifications");
  const existing = await Notifications.getPermissionsAsync();
  return existing.status === "granted";
}

export async function registerPush(deviceId: string, jwt: string): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const Notifications = await import("expo-notifications");
    const granted = await hasNotificationPermission();
    if (!granted) {
      throw new Error("notification_permission_denied");
    }
    await ensureAndroidChannel();
    const projectId = expoProjectId();
    const token = (
      await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)
    ).data;
    await api.registerPush(jwt, token, deviceId, Platform.OS);
  } catch (error) {
    reportError(error, { context: "push_register" });
    throw error;
  }
}

export async function requestPushWithCopy(deviceId: string, jwt: string): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const Notifications = await import("expo-notifications");
  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== "granted") {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== "granted") return false;
  await registerPush(deviceId, jwt);
  return true;
}
