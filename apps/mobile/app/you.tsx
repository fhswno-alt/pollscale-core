import { router } from "expo-router";
import { Alert, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BrandHeader } from "../src/components/BrandHeader";
import { api } from "../src/lib/api";
import { useSession } from "../src/lib/session";
import { colors, fonts, radius } from "../src/theme";

export default function YouScreen() {
  const session = useSession();

  const wipe = () => {
    const run = async () => {
      if (!session.token) return;
      await api.deleteAccount(session.deviceId, session.token);
      await session.signOut();
      router.replace("/");
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
        {session.token ? <Row label="Notifications" onPress={() => router.push("/notifications")} /> : null}
        {session.token ? <Row label="Your polls" onPress={() => router.push("/mine")} /> : null}
        {session.token ? (
          <Pressable onPress={session.signOut} style={{ marginTop: 12 }}>
            <Text style={{ color: colors.quiet, fontFamily: fonts.medium, fontSize: 16 }}>Sign out</Text>
          </Pressable>
        ) : null}
        {session.token ? (
          <Pressable onPress={wipe}>
            <Text style={{ color: colors.quiet, fontFamily: fonts.medium, fontSize: 16 }}>Delete account</Text>
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
