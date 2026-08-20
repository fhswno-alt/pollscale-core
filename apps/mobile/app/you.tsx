import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BrandHeader } from "../src/components/BrandHeader";
import { ConfirmSheet } from "../src/components/ConfirmSheet";
import { GroupedRow, GroupedSection } from "../src/components/GroupedList";
import { RipplePressable } from "../src/components/RipplePressable";
import { api } from "../src/lib/api";
import { errorMessage, reportError } from "../src/lib/errors";
import { LEGAL_URLS } from "../src/lib/legal";
import { hasNotificationPermission, requestPushWithCopy } from "../src/lib/push";
import { useSession } from "../src/lib/session";
import { colors, fonts, minHit, radius, space, type } from "../src/theme";

export default function YouScreen() {
  const session = useSession();
  const [pushOn, setPushOn] = useState(false);
  const [pushError, setPushError] = useState("");
  const [confirmWipe, setConfirmWipe] = useState(false);

  useEffect(() => {
    hasNotificationPermission().then(setPushOn).catch(() => undefined);
  }, [session.token]);

  const wipe = async () => {
    if (!session.token) return;
    setConfirmWipe(false);
    try {
      await api.deleteAccount(session.deviceId, session.token);
      await session.signOut();
      router.replace("/");
    } catch (error) {
      reportError(error, { context: "delete_account" });
      setPushError(errorMessage(error, "Couldn’t delete account."));
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
      <ScrollView contentContainerStyle={{ padding: space.s20, gap: space.s20, paddingBottom: space.s40 }}>
        <View style={{ paddingTop: space.s8, paddingBottom: space.s4 }}>
          <Text allowFontScaling maxFontSizeMultiplier={1.3} style={{ ...type.display, color: colors.text }}>
            {session.user?.display_name ?? "You"}
          </Text>
          <Text allowFontScaling style={{ ...type.body, color: colors.muted, marginTop: space.s4 }}>
            {session.user ? `@${session.user.handle}` : "Sign in to post and follow."}
          </Text>
        </View>

        <GroupedSection>
          <GroupedRow label="Topics" onPress={() => router.push("/topics")} />
          {session.token ? <GroupedRow label="Interests" onPress={() => router.push("/interests")} /> : null}
          <GroupedRow label="People" onPress={() => router.push("/people")} last={!session.token} />
          {session.token ? <GroupedRow label="Notifications" onPress={() => router.push("/notifications")} /> : null}
          {session.token ? <GroupedRow label="Your polls" onPress={() => router.push("/mine")} last /> : null}
        </GroupedSection>

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
              Optional notifications
            </Text>
            <Text allowFontScaling style={{ ...type.body, color: colors.muted }}>
              Pollscale can tell you when a poll is approved, someone votes, or someone follows you. We only ask after
              you tap this.
            </Text>
            <RipplePressable
              accessibilityRole="button"
              accessibilityLabel="Turn on notifications"
              onPress={enablePush}
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

        <GroupedSection>
          <GroupedRow label="Privacy" onPress={() => Linking.openURL(LEGAL_URLS.privacy)} />
          <GroupedRow label="Terms" onPress={() => Linking.openURL(LEGAL_URLS.terms)} />
          <GroupedRow label="Support" onPress={() => Linking.openURL(LEGAL_URLS.support)} last />
        </GroupedSection>

        {session.token ? (
          <GroupedSection>
            <GroupedRow label="Sign out" onPress={session.signOut} />
            <GroupedRow label="Delete account" onPress={() => setConfirmWipe(true)} last destructive />
          </GroupedSection>
        ) : null}
      </ScrollView>
      <ConfirmSheet
        visible={confirmWipe}
        title="Delete account?"
        body="This removes your polls, follows, and identity. Votes you cast are dropped."
        confirmLabel="Delete account"
        onConfirm={wipe}
        onClose={() => setConfirmWipe(false)}
      />
    </SafeAreaView>
  );
}
