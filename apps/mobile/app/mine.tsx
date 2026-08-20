import { useEffect, useState } from "react";
import { ScrollView, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ConfirmSheet } from "../src/components/ConfirmSheet";
import { GroupedRow, GroupedSection, ScreenBack, ScreenTitle } from "../src/components/GroupedList";
import { api } from "../src/lib/api";
import { useSession } from "../src/lib/session";
import type { Poll } from "../src/lib/types";
import { colors, fonts, space, type } from "../src/theme";

export default function MineScreen() {
  const session = useSession();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [pending, setPending] = useState<Poll | null>(null);

  const load = () => {
    if (!session.token) return;
    api.myPolls(session.deviceId, session.token).then(setPolls);
  };

  useEffect(load, [session.token, session.deviceId]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScreenBack />
      <ScreenTitle>Your polls</ScreenTitle>
      <ScrollView contentContainerStyle={{ padding: space.s20, gap: space.s20 }}>
        {polls.length === 0 ? (
          <Text allowFontScaling style={{ ...type.body, color: colors.muted }}>
            Nothing posted yet.
          </Text>
        ) : (
          <GroupedSection>
            {polls.map((poll, index) => (
              <GroupedRow
                key={poll.id}
                label={poll.question}
                detail={poll.review_message ? `${poll.status} · ${poll.review_message}` : poll.status}
                last={index === polls.length - 1}
              >
                <Text
                  allowFontScaling
                  onPress={() => setPending(poll)}
                  style={{ color: colors.quiet, fontFamily: fonts.medium }}
                >
                  Delete
                </Text>
              </GroupedRow>
            ))}
          </GroupedSection>
        )}
      </ScrollView>
      <ConfirmSheet
        visible={!!pending}
        title="Delete this poll?"
        body="It leaves Your polls. Votes already cast stay in the totals."
        confirmLabel="Delete poll"
        onConfirm={async () => {
          if (!pending || !session.token) return;
          await api.deletePoll(pending.id, session.deviceId, session.token);
          setPending(null);
          load();
        }}
        onClose={() => setPending(null)}
      />
    </SafeAreaView>
  );
}
