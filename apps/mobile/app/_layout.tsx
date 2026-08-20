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
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { AppChrome } from "../src/components/AppChrome";
import { RootErrorBoundary } from "../src/components/ErrorBoundary";
import { SessionProvider } from "../src/lib/session";
import { initSentry } from "../src/lib/sentry";
import { checkForHotfix } from "../src/lib/updates";
import { colors } from "../src/theme";

initSentry();
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

  useEffect(() => {
    checkForHotfix();
  }, []);

  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.canvas }} />;

  return (
    <RootErrorBoundary>
      <SessionProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: colors.canvas }}>
            <StatusBar style="light" />
            <AppChrome>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.canvas },
                  animation: "fade",
                  gestureEnabled: true,
                  animationTypeForReplace: "push",
                }}
              />
            </AppChrome>
          </View>
        </GestureHandlerRootView>
      </SessionProvider>
    </RootErrorBoundary>
  );
}
