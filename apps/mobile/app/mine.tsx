import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "../src/lib/api";
import { useSession } from "../src/lib/session";
import type { Poll } from "../src/lib/types";
import { colors, fonts, radius } from "../src/theme";

export default function MineScreen() {
  const session = useSession();
  const [polls, setPolls] = useState<Poll[]>([]);

  const load = () => {
    if (!session.token) return;
    api.myPolls(session.deviceId, session.token).then(setPolls);
  };

  useEffect(load, [session.token, session.deviceId]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Pressable onPress={() => router.back()} style={{ padding: 16 }}>
        <Text style={{ color: colors.text, fontSize: 28 }}>‹</Text>
      </Pressable>
      <Text style={{ color: colors.text, fontFamily: fonts.black, fontSize: 40, paddingHorizontal: 22 }}>
        Your polls
      </Text>
      <ScrollView contentContainerStyle={{ padding: 22, gap: 12 }}>
        {polls.map((poll) => (
          <Pressable
            key={poll.id}
            style={{ borderWidth: 1, borderColor: colors.hairline, borderRadius: radius.card, padding: 16 }}
          >
            <Text style={{ color: colors.text, fontFamily: fonts.bold, fontSize: 18 }}>{poll.question}</Text>
            <Text style={{ color: colors.muted, marginTop: 6 }}>{poll.status}</Text>
            {poll.review_message ? (
              <Text style={{ color: colors.accent, marginTop: 6 }}>{poll.review_message}</Text>
            ) : null}
            <Pressable
              onPress={async () => {
                await api.deletePoll(poll.id, session.deviceId, session.token!);
                load();
              }}
            >
              <Text style={{ color: colors.quiet, marginTop: 10 }}>Delete</Text>
            </Pressable>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
