import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { RipplePressable } from "../src/components/RipplePressable";
import { api } from "../src/lib/api";
import { errorMessage, reportError } from "../src/lib/errors";
import { hasNotificationPermission, requestPushWithCopy } from "../src/lib/push";
import { useSession } from "../src/lib/session";
import { colors, fonts, radius } from "../src/theme";

export default function NotificationsScreen() {
  const session = useSession();
  const [items, setItems] = useState<{ id: string; title: string; body: string }[]>([]);
  const [loadError, setLoadError] = useState("");
  const [pushOn, setPushOn] = useState(false);
  const [pushError, setPushError] = useState("");

  useEffect(() => {
    if (!session.token) return;
    api
      .notifications(session.deviceId, session.token)
      .then(setItems)
      .catch((error) => {
        reportError(error, { context: "notifications" });
        setLoadError(errorMessage(error, "Couldn’t load notifications."));
      });
    hasNotificationPermission().then(setPushOn).catch(() => undefined);
  }, [session.token, session.deviceId]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}>
      <RipplePressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => router.back()}
        style={{ padding: 16 }}
      >
        <Text allowFontScaling style={{ color: colors.text, fontSize: 28 }}>
          ‹
        </Text>
      </RipplePressable>
      <Text
        allowFontScaling
        maxFontSizeMultiplier={1.3}
        style={{ color: colors.text, fontFamily: fonts.black, fontSize: 40, paddingHorizontal: 22 }}
      >
        Notifications
      </Text>
      <ScrollView contentContainerStyle={{ padding: 22, gap: 14 }}>
        {session.token && !pushOn ? (
          <View
            style={{
              borderWidth: 1,
              borderColor: colors.hairline,
              borderRadius: radius.card,
              padding: 16,
              gap: 10,
            }}
          >
            <Text allowFontScaling style={{ color: colors.text, fontFamily: fonts.bold, fontSize: 18 }}>
              Device alerts are off
            </Text>
            <Text allowFontScaling style={{ color: colors.muted }}>
              In-app rows still land here. Turn on system notifications if you want a banner when someone votes or
              follows you.
            </Text>
            <RipplePressable
              accessibilityRole="button"
              accessibilityLabel="Turn on notifications"
              onPress={async () => {
                setPushError("");
                try {
                  const ok = await requestPushWithCopy(session.deviceId, session.token!);
                  setPushOn(ok);
                  if (!ok) setPushError("Permission stayed off.");
                } catch (error) {
                  reportError(error, { context: "notifications_push" });
                  setPushError(errorMessage(error, "Couldn’t register notifications."));
                }
              }}
              style={{
                height: 48,
                borderRadius: radius.pill,
                backgroundColor: colors.accent,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text allowFontScaling style={{ color: colors.ink, fontFamily: fonts.bold }}>
                Turn on notifications
              </Text>
            </RipplePressable>
            {pushError ? (
              <Text allowFontScaling style={{ color: "#FF8B8B" }}>
                {pushError}
              </Text>
            ) : null}
          </View>
        ) : null}
        {loadError ? (
          <Text allowFontScaling style={{ color: "#FF8B8B" }}>
            {loadError}
          </Text>
        ) : items.length === 0 ? (
          <Text allowFontScaling style={{ color: colors.muted }}>
            Nothing yet.
          </Text>
        ) : (
          items.map((item) => (
            <View key={item.id}>
              <Text allowFontScaling style={{ color: colors.text, fontFamily: fonts.bold, fontSize: 18 }}>
                {item.title}
              </Text>
              <Text allowFontScaling style={{ color: colors.muted, marginTop: 4 }}>
                {item.body}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
