import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { GroupedRow, GroupedSection, ScreenBack, ScreenTitle } from "../src/components/GroupedList";
import { RipplePressable } from "../src/components/RipplePressable";
import { api } from "../src/lib/api";
import { errorMessage, reportError } from "../src/lib/errors";
import { hasNotificationPermission, requestPushWithCopy } from "../src/lib/push";
import { useSession } from "../src/lib/session";
import { colors, fonts, minHit, radius, space, type } from "../src/theme";

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
      <ScreenBack />
      <ScreenTitle>Notifications</ScreenTitle>
      <ScrollView contentContainerStyle={{ padding: space.s20, gap: space.s20 }}>
        {session.token && !pushOn ? (
          <View
            style={{
              backgroundColor: colors.sheet,
              borderWidth: 1,
              borderColor: colors.hairline,
              borderRadius: radius.card,
              padding: space.s16,
              gap: space.s8,
            }}
          >
            <Text allowFontScaling style={{ color: colors.text, fontFamily: fonts.bold, fontSize: 18 }}>
              Device alerts are off
            </Text>
            <Text allowFontScaling style={{ ...type.body, color: colors.muted }}>
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
                minHeight: minHit,
                borderRadius: radius.pill,
                backgroundColor: colors.accent,
                alignItems: "center",
                justifyContent: "center",
                marginTop: space.s4,
              }}
            >
              <Text allowFontScaling style={{ color: colors.ink, fontFamily: fonts.bold }}>
                Turn on notifications
              </Text>
            </RipplePressable>
            {pushError ? (
              <Text allowFontScaling style={{ color: colors.danger }}>
                {pushError}
              </Text>
            ) : null}
          </View>
        ) : null}
        {loadError ? (
          <Text allowFontScaling style={{ color: colors.danger }}>
            {loadError}
          </Text>
        ) : items.length === 0 ? (
          <Text allowFontScaling style={{ ...type.body, color: colors.muted }}>
            Nothing yet.
          </Text>
        ) : (
          <GroupedSection>
            {items.map((item, index) => (
              <GroupedRow key={item.id} label={item.title} detail={item.body} last={index === items.length - 1} />
            ))}
          </GroupedSection>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
