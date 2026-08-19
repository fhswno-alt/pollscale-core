import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BrandHeader } from "../src/components/BrandHeader";
import { useSession } from "../src/lib/session";
import { colors, fonts, radius } from "../src/theme";

export default function YouScreen() {
  const session = useSession();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}>
      <BrandHeader />
      <View style={{ padding: 22, gap: 18 }}>
        <Text style={{ color: colors.text, fontFamily: fonts.black, fontSize: 40, letterSpacing: -1.4 }}>
          {session.user?.display_name ?? "You"}
        </Text>
        {session.user ? (
          <Text style={{ color: colors.muted, fontFamily: fonts.medium, fontSize: 16 }}>
            @{session.user.handle}
          </Text>
        ) : (
          <Text style={{ color: colors.muted, fontFamily: fonts.medium, fontSize: 16 }}>
            Sign in to post and follow.
          </Text>
        )}
        <Row label="Topics" onPress={() => router.push("/topics")} />
        <Row label="People" onPress={() => router.push("/people")} />
        {session.token ? (
          <Pressable onPress={session.signOut} style={{ marginTop: 12 }}>
            <Text style={{ color: colors.quiet, fontFamily: fonts.medium, fontSize: 16 }}>Sign out</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function Row({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        borderWidth: 1,
        borderColor: colors.hairline,
        borderRadius: radius.card,
        padding: 18,
      }}
    >
      <Text style={{ color: colors.text, fontFamily: fonts.bold, fontSize: 20 }}>{label}</Text>
    </Pressable>
  );
}
