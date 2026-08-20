import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BrandHeader } from "../src/components/BrandHeader";
import { OptionCard } from "../src/components/OptionCard";
import { PollMenu } from "../src/components/PollMenu";
import { ReportSheet } from "../src/components/ReportSheet";
import { SignInSheet } from "../src/components/SignInSheet";
import { api } from "../src/lib/api";
import { useSession } from "../src/lib/session";
import type { Poll } from "../src/lib/types";
import { colors, fonts, radius } from "../src/theme";

function formatVotes(n: number) {
  if (n >= 10000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K votes`;
  return `${n.toLocaleString()} votes`;
}

export default function VoteScreen() {
  const session = useSession();
  const [poll, setPoll] = useState<Poll | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [report, setReport] = useState(false);
  const [menu, setMenu] = useState(false);
  const [shownAt, setShownAt] = useState(0);

  const voted = !!poll?.viewer_vote_option_id;
  const photo = !!poll?.options.some((option) => option.image_url);
  const compact = (poll?.options.length ?? 0) >= 4;

  const loadNext = useCallback(async () => {
    if (!session.ready || !session.deviceId) return;
    setLoading(true);
    try {
      const feed = await api.feed(session.deviceId, session.token);
      session.applyFeed(feed);
      setPoll(feed.poll);
      setShownAt(Date.now());
      if (!session.token && feed.guest_votes_used >= 3) setSheet(true);
    } catch {
      setPoll(null);
    } finally {
      setLoading(false);
    }
  }, [session.ready, session.deviceId, session.token]);

  useEffect(() => {
    if (session.wall) setSheet(true);
    loadNext();
  }, [loadNext, session.wall, session.token]);

  const vote = async (optionId: string) => {
    if (!poll || voted || busy) return;
    if (!session.token && session.guestVotesUsed >= 3) {
      setSheet(true);
      return;
    }
    setBusy(true);
    try {
      await sendDwell(poll.id);
      const feed = await api.vote(poll.id, optionId, session.deviceId, session.token);
      session.applyFeed(feed);
      setPoll(feed.poll);
      if (!session.token && feed.guest_votes_used >= 3) {
        setSheet(true);
      }
    } catch (error) {
      const detail = (error as Error).message;
      if (detail === "guest_quota_exceeded") setSheet(true);
    } finally {
      setBusy(false);
    }
  };

  const sendDwell = async (pollId: string) => {
    if (!session.token || !shownAt) return;
    const seconds = Math.max(0, (Date.now() - shownAt) / 1000);
    if (seconds < 0.4) return;
    await api.dwell(pollId, seconds, session.deviceId, session.token).catch(() => undefined);
  };

  const skip = async () => {
    if (!poll || voted || busy) return;
    setBusy(true);
    try {
      await sendDwell(poll.id);
      const feed = await api.skip(poll.id, session.deviceId, session.token);
      session.applyFeed(feed);
      setPoll(feed.poll);
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    if (!session.token && session.guestVotesUsed >= 3) {
      setSheet(true);
      return;
    }
    setPoll(null);
    loadNext();
  };

  const onTopic = async () => {
    if (!poll) return;
    if (!session.token) {
      router.push("/topics");
      return;
    }
    await api.followTopic(poll.topic.id, session.deviceId, session.token, !poll.topic.following);
    setPoll({ ...poll, topic: { ...poll.topic, following: !poll.topic.following } });
  };

  const winning = poll
    ? Math.max(...poll.options.map((option) => option.percent ?? -1))
    : -1;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}>
      <BrandHeader
        topicName={poll?.topic.name}
        topicIcon={poll?.topic.icon}
        onTopic={onTopic}
        showActions
      />
      {loading && !poll ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : !poll ? (
        <View style={{ flex: 1, padding: 24, justifyContent: "center" }}>
          <Text style={{ color: colors.text, fontFamily: fonts.black, fontSize: 40, letterSpacing: -1.4 }}>
            You are caught up.
          </Text>
          <Text style={{ color: colors.muted, fontFamily: fonts.medium, fontSize: 16, marginTop: 10 }}>
            Follow topics and people, or post a poll of your own.
          </Text>
          {session.token ? (
            <Pressable
              onPress={() => router.push("/create")}
              style={{
                marginTop: 28,
                height: 56,
                borderRadius: radius.pill,
                backgroundColor: colors.accent,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: colors.ink, fontFamily: fonts.bold, fontSize: 18 }}>Post a poll</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: voted ? 140 : 90, flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
          >
            <Text
              style={{
                color: colors.text,
                fontFamily: fonts.black,
                fontSize: photo ? 34 : 38,
                lineHeight: photo ? 36 : 40,
                letterSpacing: -1.3,
                marginTop: 18,
                marginBottom: 22,
              }}
            >
              {poll.question}
            </Text>
            <View style={{ gap: photo ? 12 : 10 }}>
              {poll.options.map((option) => (
                <OptionCard
                  key={option.id}
                  option={option}
                  photo={photo}
                  compact={compact}
                  results={voted}
                  winning={voted && (option.percent ?? 0) === winning && winning >= 0}
                  onPress={() => vote(option.id)}
                />
              ))}
            </View>
            {voted && poll.total_votes != null ? (
              <Text
                style={{
                  color: colors.muted,
                  fontFamily: fonts.medium,
                  fontSize: 14,
                  marginTop: 14,
                }}
              >
                {formatVotes(poll.total_votes)}
              </Text>
            ) : null}
            <View style={{ flexDirection: "row", gap: 18, marginTop: 16 }}>
              <Pressable onPress={() => setMenu(true)}>
                <Text style={{ color: colors.quiet, fontFamily: fonts.medium }}>···</Text>
              </Pressable>
              {poll.is_author ? (
                <Pressable
                  onPress={async () => {
                    if (!session.token) return;
                    await api.deletePoll(poll.id, session.deviceId, session.token);
                    setPoll(null);
                    loadNext();
                  }}
                >
                  <Text style={{ color: colors.quiet, fontFamily: fonts.medium }}>Delete poll</Text>
                </Pressable>
              ) : null}
            </View>
          </ScrollView>
          {voted ? (
            <View style={{ position: "absolute", left: 20, right: 20, bottom: 18 }}>
              <Pressable
                onPress={next}
                style={{
                  height: 56,
                  borderRadius: radius.pill,
                  backgroundColor: colors.accent,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: colors.ink, fontFamily: fonts.bold, fontSize: 18 }}>Next poll</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={skip} style={{ alignItems: "center", paddingBottom: 18, paddingTop: 8 }}>
              <Text style={{ color: colors.quiet, fontFamily: fonts.medium, fontSize: 16 }}>Skip</Text>
            </Pressable>
          )}
        </View>
      )}
      <SignInSheet visible={sheet && !session.token} dimmed />
      {menu && poll ? (
        <PollMenu
          onClose={() => setMenu(false)}
          onReport={() => {
            setMenu(false);
            setReport(true);
          }}
          onRelevant={async () => {
            setMenu(false);
            if (!session.token) {
              setSheet(true);
              return;
            }
            await api.feedback(poll.id, "relevant", session.deviceId, session.token);
          }}
          onNotInterested={async () => {
            setMenu(false);
            if (!session.token) {
              setSheet(true);
              return;
            }
            await sendDwell(poll.id);
            await api.feedback(poll.id, "not_interested", session.deviceId, session.token);
            setPoll(null);
            loadNext();
          }}
        />
      ) : null}
      {report && poll ? <ReportSheet pollId={poll.id} onClose={() => setReport(false)} /> : null}
    </SafeAreaView>
  );
}
