import { Platform } from "react-native";

export async function hapticVote(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const Haptics = await import("expo-haptics");
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    // Simulator or missing native module
  }
}

export async function hapticSkip(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const Haptics = await import("expo-haptics");
    await Haptics.selectionAsync();
  } catch {
    // Simulator or missing native module
  }
}

export async function hapticNext(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const Haptics = await import("expo-haptics");
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Simulator or missing native module
  }
}
