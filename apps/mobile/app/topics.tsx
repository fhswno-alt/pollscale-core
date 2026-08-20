import { useEffect, useState } from "react";
import { ScrollView, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { GroupedRow, GroupedSection, ScreenBack, ScreenTitle } from "../src/components/GroupedList";
import { SignInSheet } from "../src/components/SignInSheet";
import { api } from "../src/lib/api";
import { useSession } from "../src/lib/session";
import type { Topic } from "../src/lib/types";
import { colors, fonts, space, type } from "../src/theme";

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
      <ScreenBack />
      <ScreenTitle>Topics</ScreenTitle>
      <Text
        allowFontScaling
        style={{ ...type.body, color: colors.muted, paddingHorizontal: space.s20, marginTop: space.s8 }}
      >
        Follow what you want more of. Everyone can still see every poll.
      </Text>
      <ScrollView contentContainerStyle={{ padding: space.s20, gap: space.s20 }}>
        <GroupedSection>
          {topics.map((topic, index) => (
            <GroupedRow
              key={topic.id}
              label={topic.name}
              onPress={() => toggle(topic)}
              last={index === topics.length - 1}
            >
              <Text
                allowFontScaling
                style={{
                  color: topic.following ? colors.accent : colors.muted,
                  fontFamily: fonts.bold,
                }}
              >
                {topic.following ? "Following" : "Follow"}
              </Text>
            </GroupedRow>
          ))}
        </GroupedSection>
      </ScrollView>
      <SignInSheet visible={sheet && !session.token} dimmed />
    </SafeAreaView>
  );
}
