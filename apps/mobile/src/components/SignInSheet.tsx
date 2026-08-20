import * as AppleAuthentication from "expo-apple-authentication";
import * as Linking from "expo-linking";
import { useEffect, useState } from "react";
import { Platform, StyleSheet, Text } from "react-native";

import { errorMessage, isCancel, reportError } from "../lib/errors";
import { LEGAL_URLS } from "../lib/legal";
import { useSession } from "../lib/session";
import { colors, fonts, radius } from "../theme";
import { RipplePressable } from "./RipplePressable";
import { Sheet } from "./Sheet";

export function SignInSheet({ visible, dimmed }: { visible: boolean; dimmed?: boolean }) {
  const { signInApple, signInGoogle } = useSession();
  const [appleReady, setAppleReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    AppleAuthentication.isAvailableAsync()
      .then(setAppleReady)
      .catch(() => setAppleReady(false));
  }, []);

  if (!visible) return null;

  const onApple = async () => {
    setError("");
    try {
      await signInApple();
    } catch (err) {
      if (isCancel(err)) return;
      reportError(err, { context: "apple_button" });
      setError(errorMessage(err, "Apple Sign In failed. Try again."));
    }
  };

  const onGoogle = async () => {
    setError("");
    try {
      await signInGoogle();
    } catch (err) {
      if (isCancel(err)) return;
      reportError(err, { context: "google_button" });
      setError(errorMessage(err, "Google Sign In failed. Try again."));
    }
  };

  return (
    <Sheet dimmed={dimmed}>
      <Text
        allowFontScaling
        maxFontSizeMultiplier={1.3}
        style={styles.headline}
      >
        Keep going.
      </Text>
      <Text allowFontScaling style={styles.sub}>
        Three free votes. Sign in to vote, post, and follow.
      </Text>
      {appleReady ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
          cornerRadius={radius.pill}
          style={styles.appleOfficial}
          onPress={onApple}
        />
      ) : null}
      <RipplePressable
        accessibilityRole="button"
        accessibilityLabel="Continue with Google"
        style={styles.google}
        onPress={onGoogle}
      >
        <Text style={styles.g}>G</Text>
        <Text allowFontScaling style={styles.googleText}>
          Continue with Google
        </Text>
      </RipplePressable>
      {error ? (
        <Text allowFontScaling style={styles.error}>
          {error}
        </Text>
      ) : null}
      <Text allowFontScaling style={styles.terms}>
        By continuing you agree to{" "}
        <Text style={styles.link} onPress={() => Linking.openURL(LEGAL_URLS.terms)}>
          Terms
        </Text>
        {" and "}
        <Text style={styles.link} onPress={() => Linking.openURL(LEGAL_URLS.privacy)}>
          Privacy
        </Text>
        .
      </Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  headline: {
    color: colors.text,
    fontFamily: fonts.black,
    fontSize: 44,
    letterSpacing: -1.6,
    lineHeight: 46,
  },
  sub: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: 16,
    marginTop: 10,
    marginBottom: 26,
    lineHeight: 22,
  },
  appleOfficial: {
    width: "100%",
    height: 54,
    marginBottom: 12,
  },
  google: {
    height: 54,
    borderRadius: radius.pill,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  g: { color: "#4285F4", fontFamily: fonts.black, fontSize: 18 },
  googleText: { color: colors.ink, fontFamily: fonts.bold, fontSize: 16 },
  error: {
    color: "#FF8B8B",
    fontFamily: fonts.medium,
    fontSize: 14,
    marginTop: 12,
    textAlign: "center",
  },
  terms: {
    textAlign: "center",
    color: colors.quiet,
    fontFamily: fonts.regular,
    fontSize: 12,
    marginTop: 18,
  },
  link: { color: colors.accent, fontFamily: fonts.medium },
});
