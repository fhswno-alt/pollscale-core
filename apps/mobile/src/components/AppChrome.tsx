import { useEffect, type ReactNode } from "react";
import { View } from "react-native";

import { ensureAndroidChannel } from "../lib/push";
import { useSession } from "../lib/session";
import { OnboardingGate } from "./OnboardingGate";

export function AppChrome({ children }: { children: ReactNode }) {
  const session = useSession();
  useEffect(() => {
    if (session.token) {
      ensureAndroidChannel().catch(() => undefined);
    }
  }, [session.token]);
  return (
    <View style={{ flex: 1 }}>
      {children}
      <OnboardingGate />
    </View>
  );
}
