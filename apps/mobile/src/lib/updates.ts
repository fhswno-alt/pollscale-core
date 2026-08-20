/** Optional JS hotfix path. Compiles without EAS credentials. */
export async function checkForHotfix(): Promise<void> {
  try {
    const Updates = await import("expo-updates");
    if (!Updates.isEnabled) return;
    const result = await Updates.checkForUpdateAsync();
    if (result.isAvailable) await Updates.fetchUpdateAsync();
  } catch {
    // No EAS project, Expo Go, or updates URL yet.
  }
}
