import {
  Archivo_400Regular,
  Archivo_500Medium,
  Archivo_700Bold,
  Archivo_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/archivo";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View } from "react-native";

import { AppChrome } from "../src/components/AppChrome";
import { SessionProvider } from "../src/lib/session";
import { colors } from "../src/theme";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [loaded] = useFonts({
    Archivo_400Regular,
    Archivo_500Medium,
    Archivo_700Bold,
    Archivo_800ExtraBold,
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => undefined);
  }, [loaded]);

  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.canvas }} />;

  return (
    <SessionProvider>
      <View style={{ flex: 1, backgroundColor: colors.canvas }}>
        <StatusBar style="light" />
        <AppChrome>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.canvas },
              animation: "fade",
            }}
          />
        </AppChrome>
      </View>
    </SessionProvider>
  );
}
