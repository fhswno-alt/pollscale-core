import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BrandHeader } from "../src/components/BrandHeader";
import { RipplePressable } from "../src/components/RipplePressable";
import { api } from "../src/lib/api";
import { errorMessage, reportError } from "../src/lib/errors";
import { LEGAL_URLS } from "../src/lib/legal";
import { hasNotificationPermission, requestPushWithCopy } from "../src/lib/push";
import { useSession } from "../src/lib/session";
import { colors, fonts, radius } from "../src/theme";

export default function YouScreen() {
  const session = useSession();
  const [pushOn, setPushOn] = useState(false);
  const [pushError, setPushError] = useState("");

  useEffect(() => {
    hasNotificationPermission().then(setPushOn).catch(() => undefined);
  }, [session.token]);

  const wipe = () => {
    const run = async () => {
      if (!session.token) return;
      try {
        await api.deleteAccount(session.deviceId, session.token);
        await session.signOut();
        router.replace("/");
      } catch (error) {
        reportError(error, { context: "delete_account" });
        Alert.alert("Couldn’t delete account", errorMessage(error));
      }
    };
    if (typeof Alert.alert === "function") {
      Alert.alert("Delete account", "This removes your polls, follows, and identity. Votes you cast are dropped.", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: run },
      ]);
    } else {
      run();
    }
  };

  const enablePush = async () => {
    if (!session.token) return;
    setPushError("");
    try {
      const ok = await requestPushWithCopy(session.deviceId, session.token);
      setPushOn(ok);
      if (!ok) setPushError("Notifications stayed off. You can enable them in system settings.");
    } catch (error) {
      reportError(error, { context: "enable_push" });
      setPushError(errorMessage(error, "Couldn’t register notifications."));
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}>
      <BrandHeader />
      <ScrollView contentContainerStyle={{ padding: 22, gap: 14, paddingBottom: 40 }}>
        <Text
          allowFontScaling
          maxFontSizeMultiplier={1.3}
          style={{ color: colors.text, fontFamily: fonts.black, fontSize: 40, letterSpacing: -1.4 }}
        >
          {session.user?.display_name ?? "You"}
        </Text>
        {session.user ? (
          <Text allowFontScaling style={{ color: colors.muted, fontFamily: fonts.medium, fontSize: 16 }}>
            @{session.user.handle}
          </Text>
        ) : (
          <Text allowFontScaling style={{ color: colors.muted, fontFamily: fonts.medium, fontSize: 16 }}>
            Sign in to post and follow.
          </Text>
        )}
        <Row label="Topics" onPress={() => router.push("/topics")} />
        {session.token ? <Row label="Interests" onPress={() => router.push("/interests")} /> : null}
        <Row label="People" onPress={() => router.push("/people")} />
        {session.token ? <Row label="Notifications" onPress={() => router.push("/notifications")} /> : null}
        {session.token ? <Row label="Your polls" onPress={() => router.push("/mine")} /> : null}
        {session.token && !pushOn ? (
          <View
            style={{
              borderWidth: 1,
              borderColor: colors.hairline,
              borderRadius: radius.card,
              padding: 18,
              gap: 10,
            }}
          >
            <Text allowFontScaling style={{ color: colors.text, fontFamily: fonts.bold, fontSize: 18 }}>
              Optional notifications
            </Text>
            <Text allowFontScaling style={{ color: colors.muted, fontFamily: fonts.medium, fontSize: 15 }}>
              Pollscale can tell you when a poll is approved, someone votes, or someone follows you. We only ask after
              you tap this.
            </Text>
            <RipplePressable
              accessibilityRole="button"
              accessibilityLabel="Turn on notifications"
              onPress={enablePush}
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
        <Row label="Privacy" onPress={() => Linking.openURL(LEGAL_URLS.privacy)} />
        <Row label="Terms" onPress={() => Linking.openURL(LEGAL_URLS.terms)} />
        <Row label="Support" onPress={() => Linking.openURL(LEGAL_URLS.support)} />
        {session.token ? (
          <RipplePressable
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            onPress={session.signOut}
            style={{ marginTop: 8 }}
          >
            <Text allowFontScaling style={{ color: colors.quiet, fontFamily: fonts.medium, fontSize: 16 }}>
              Sign out
            </Text>
          </RipplePressable>
        ) : null}
        {session.token ? (
          <RipplePressable accessibilityRole="button" accessibilityLabel="Delete account" onPress={wipe}>
            <Text allowFontScaling style={{ color: colors.quiet, fontFamily: fonts.medium, fontSize: 16 }}>
              Delete account
            </Text>
          </RipplePressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <RipplePressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        borderWidth: 1,
        borderColor: colors.hairline,
        borderRadius: radius.card,
        padding: 18,
      }}
    >
      <Text allowFontScaling style={{ color: colors.text, fontFamily: fonts.bold, fontSize: 20 }}>
        {label}
      </Text>
    </RipplePressable>
  );
}
