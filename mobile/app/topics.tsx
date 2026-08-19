import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SignInSheet } from "../src/components/SignInSheet";
import { TopicChip } from "../src/components/TopicChip";
import { api } from "../src/lib/api";
import { useSession } from "../src/lib/session";
import type { Topic } from "../src/lib/types";
import { colors, fonts, radius } from "../src/theme";

export default function TopicsScreen() {
  const session = useSession();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [sheet, setSheet] = useState(false);

  const load = () => {
    if (!session.deviceId) return;
    api.topics(session.deviceId, session.token).then(setTopics);
  };

  useEffect(load, [session.deviceId, session.token]);

  const toggle = async (topic: Topic) => {
    if (!session.token) {
      setSheet(true);
      return;
    }
    const updated = await api.followTopic(topic.id, session.deviceId, session.token, !topic.following);
    setTopics((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Pressable onPress={() => router.back()} style={{ paddingHorizontal: 18, paddingVertical: 10 }}>
        <Text style={{ color: colors.text, fontSize: 28 }}>‹</Text>
      </Pressable>
      <Text
        style={{
          color: colors.text,
          fontFamily: fonts.black,
          fontSize: 40,
          letterSpacing: -1.4,
          paddingHorizontal: 22,
        }}
      >
        Topics
      </Text>
      <Text style={{ color: colors.muted, fontFamily: fonts.medium, paddingHorizontal: 22, marginTop: 8 }}>
        Follow what you want more of. Everyone can still see every poll.
      </Text>
      <ScrollView contentContainerStyle={{ padding: 22, gap: 10 }}>
        {topics.map((topic) => (
          <Pressable
            key={topic.id}
            onPress={() => toggle(topic)}
            style={{
              borderWidth: 1,
              borderColor: topic.following ? colors.accent : colors.hairline,
              borderRadius: radius.card,
              padding: 18,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <TopicChip name={topic.name} icon={topic.icon} accent={topic.following} />
            </View>
            <Text
              style={{
                color: topic.following ? colors.accent : colors.muted,
                fontFamily: fonts.bold,
              }}
            >
              {topic.following ? "Following" : "Follow"}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <SignInSheet visible={sheet && !session.token} dimmed />
    </SafeAreaView>
  );
}
