import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "../src/lib/api";
import { useSession } from "../src/lib/session";
import { colors, fonts } from "../src/theme";

export default function NotificationsScreen() {
  const session = useSession();
  const [items, setItems] = useState<{ id: string; title: string; body: string }[]>([]);

  useEffect(() => {
    if (!session.token) return;
    api.notifications(session.deviceId, session.token).then(setItems);
  }, [session.token, session.deviceId]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Pressable onPress={() => router.back()} style={{ padding: 16 }}>
        <Text style={{ color: colors.text, fontSize: 28 }}>‹</Text>
      </Pressable>
      <Text style={{ color: colors.text, fontFamily: fonts.black, fontSize: 40, paddingHorizontal: 22 }}>
        Notifications
      </Text>
      <ScrollView contentContainerStyle={{ padding: 22, gap: 14 }}>
        {items.length === 0 ? (
          <Text style={{ color: colors.muted }}>Nothing yet.</Text>
        ) : (
          items.map((item) => (
            <View key={item.id}>
              <Text style={{ color: colors.text, fontFamily: fonts.bold, fontSize: 18 }}>{item.title}</Text>
              <Text style={{ color: colors.muted, marginTop: 4 }}>{item.body}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
