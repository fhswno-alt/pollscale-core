import { Platform } from "react-native";

import { api } from "./api";

export async function registerPush(deviceId: string, jwt: string) {
  if (Platform.OS === "web") return;
  const Notifications = await import("expo-notifications");
  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== "granted") {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== "granted") return;
  const token = (await Notifications.getExpoPushTokenAsync()).data;
  await api.registerPush(jwt, token, deviceId, Platform.OS);
}
