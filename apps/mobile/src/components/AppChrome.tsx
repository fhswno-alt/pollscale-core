import { useEffect, type ReactNode } from "react";
import { View } from "react-native";

import { registerPush } from "../lib/push";
import { useSession } from "../lib/session";
import { UsernameGate } from "./UsernameGate";

export function AppChrome({ children }: { children: ReactNode }) {
  const session = useSession();
  useEffect(() => {
    if (session.token && session.deviceId) {
      registerPush(session.deviceId, session.token).catch(() => undefined);
    }
  }, [session.token, session.deviceId]);
  return (
    <View style={{ flex: 1 }}>
      {children}
      <UsernameGate />
    </View>
  );
}
