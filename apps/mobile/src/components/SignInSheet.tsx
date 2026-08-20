import { Pressable, StyleSheet, Text, View } from "react-native";

import { useSession } from "../lib/session";
import { colors, fonts, radius } from "../theme";

export function SignInSheet({ visible, dimmed }: { visible: boolean; dimmed?: boolean }) {
  const { signInApple, signInGoogle } = useSession();
  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {dimmed ? <View style={styles.dim} /> : null}
      <View style={styles.sheet}>
        <View style={styles.grab} />
        <Text style={styles.headline}>Keep going.</Text>
        <Text style={styles.sub}>Three free votes. Sign in to vote, post, and follow.</Text>
        <Pressable style={styles.apple} onPress={signInApple}>
          <Text style={styles.appleMark}></Text>
          <Text style={styles.appleText}>Continue with Apple</Text>
        </Pressable>
        <Pressable style={styles.google} onPress={signInGoogle}>
          <Text style={styles.g}>G</Text>
          <Text style={styles.googleText}>Continue with Google</Text>
        </Pressable>
        <Text style={styles.terms}>By continuing you agree to the terms.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.sheet,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 28,
  },
  grab: {
    alignSelf: "center",
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
    marginBottom: 22,
  },
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
  apple: {
    height: 54,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.ink,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
  },
  appleMark: { color: colors.text, fontSize: 20, marginTop: -2 },
  appleText: { color: colors.text, fontFamily: fonts.bold, fontSize: 16 },
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
  terms: {
    textAlign: "center",
    color: colors.quiet,
    fontFamily: fonts.regular,
    fontSize: 12,
    marginTop: 18,
  },
});
