import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BrandHeader } from "../src/components/BrandHeader";
import { GlassSurface } from "../src/components/GlassSurface";
import { OptionCard } from "../src/components/OptionCard";
import { PollMenu } from "../src/components/PollMenu";
import { ReportSheet } from "../src/components/ReportSheet";
import { RipplePressable } from "../src/components/RipplePressable";
import { SignInSheet } from "../src/components/SignInSheet";
import { trackFunnel } from "../src/lib/analytics";
import { api } from "../src/lib/api";
import { errorMessage, reportError } from "../src/lib/errors";
import { hapticSkip, hapticVote } from "../src/lib/haptics";
import { useSession } from "../src/lib/session";
import type { Poll } from "../src/lib/types";
import { colors, fonts, radius } from "../src/theme";

async function recordDwell(
  pollId: string,
  shownAt: number,
  deviceId: string,
  token: string | null,
) {
  if (!token || !shownAt) return;
  const seconds = Math.max(0, (Date.now() - shownAt) / 1000);
  if (seconds < 0.4) return;
  await api.dwell(pollId, seconds, deviceId, token).catch((error) => {
    reportError(error, { context: "dwell", pollId });
  });
}

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
  const [feedError, setFeedError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const voted = !!poll?.viewer_vote_option_id;
  const photo = !!poll?.options.some((option) => option.image_url);
  const compact = (poll?.options.length ?? 0) >= 4;

  const loadNext = useCallback(async () => {
    if (!session.ready || !session.deviceId) return;
    setLoading(true);
    setFeedError(null);
    try {
      const feed = await api.feed(session.deviceId, session.token);
      session.applyFeed(feed);
      setPoll(feed.poll);
      setShownAt(Date.now());
      if (!session.token && feed.guest_votes_used >= 3) setSheet(true);
    } catch (error) {
      reportError(error, { context: "feed_next" });
      setPoll(null);
      setFeedError(errorMessage(error, "Couldn’t load For You."));
    } finally {
      setLoading(false);
    }
    // session.applyFeed is stable enough for this load cycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.ready, session.deviceId, session.token]);

  useEffect(() => {
    void loadNext();
  }, [loadNext, session.token]);

  const vote = async (optionId: string) => {
    if (!poll || voted || busy) return;
    if (!session.token && session.guestVotesUsed >= 3) {
      setSheet(true);
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      await hapticVote();
      await sendDwell(poll.id);
      const feed = await api.vote(poll.id, optionId, session.deviceId, session.token);
      session.applyFeed(feed);
      setPoll(feed.poll);
      if (session.token && session.guestVotesUsed === 0) {
        const already = await AsyncStorage.getItem("pollscale.first_vote");
        if (!already) {
          await AsyncStorage.setItem("pollscale.first_vote", "1");
          trackFunnel("first_vote", { userId: session.user?.id, deviceId: session.deviceId }, { poll_id: poll.id });
        }
      }
      if (!session.token && feed.guest_votes_used >= 3) {
        setSheet(true);
      }
    } catch (error) {
      const detail = (error as Error).message;
      reportError(error, { context: "vote", pollId: poll.id });
      if (detail === "guest_quota_exceeded") setSheet(true);
      else setActionError(errorMessage(error, "Vote didn’t land. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const sendDwell = (pollId: string) =>
    recordDwell(pollId, shownAt, session.deviceId, session.token);

  const skip = async () => {
    if (!poll || voted || busy) return;
    setBusy(true);
    setActionError(null);
    try {
      await hapticSkip();
      await sendDwell(poll.id);
      const feed = await api.skip(poll.id, session.deviceId, session.token);
      session.applyFeed(feed);
      setPoll(feed.poll);
    } catch (error) {
      reportError(error, { context: "skip", pollId: poll.id });
      setActionError(errorMessage(error, "Skip failed. Try again."));
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
    try {
      await api.followTopic(poll.topic.id, session.deviceId, session.token, !poll.topic.following);
      setPoll({ ...poll, topic: { ...poll.topic, following: !poll.topic.following } });
    } catch (error) {
      reportError(error, { context: "follow_topic" });
      setActionError(errorMessage(error, "Couldn’t update that topic."));
    }
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
      ) : feedError ? (
        <View style={{ flex: 1, padding: 24, justifyContent: "center" }}>
          <Text
            allowFontScaling
            maxFontSizeMultiplier={1.3}
            style={{ color: colors.text, fontFamily: fonts.black, fontSize: 40, letterSpacing: -1.4 }}
          >
            Couldn’t load For You.
          </Text>
          <Text allowFontScaling style={{ color: colors.muted, fontFamily: fonts.medium, fontSize: 16, marginTop: 10 }}>
            {feedError}
          </Text>
          <RipplePressable
            accessibilityRole="button"
            accessibilityLabel="Retry feed"
            onPress={loadNext}
            style={{
              marginTop: 28,
              height: 56,
              borderRadius: radius.pill,
              backgroundColor: colors.accent,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text allowFontScaling style={{ color: colors.ink, fontFamily: fonts.bold, fontSize: 18 }}>
              Retry
            </Text>
          </RipplePressable>
        </View>
      ) : !poll ? (
        <View style={{ flex: 1, padding: 24, justifyContent: "center" }}>
          <Text
            allowFontScaling
            maxFontSizeMultiplier={1.3}
            style={{ color: colors.text, fontFamily: fonts.black, fontSize: 40, letterSpacing: -1.4 }}
          >
            You are caught up.
          </Text>
          <Text allowFontScaling style={{ color: colors.muted, fontFamily: fonts.medium, fontSize: 16, marginTop: 10 }}>
            Follow topics and people, or post a poll of your own.
          </Text>
          {session.token ? (
            <RipplePressable
              accessibilityRole="button"
              accessibilityLabel="Post a poll"
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
              <Text allowFontScaling style={{ color: colors.ink, fontFamily: fonts.bold, fontSize: 18 }}>
                Post a poll
              </Text>
            </RipplePressable>
          ) : null}
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: voted ? 140 : 90, flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
          >
            <Text
              allowFontScaling
              maxFontSizeMultiplier={1.35}
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
            {actionError ? (
              <Text allowFontScaling style={{ color: "#FF8B8B", fontFamily: fonts.medium, marginTop: 12 }}>
                {actionError}
              </Text>
            ) : null}
            {voted && poll.total_votes != null ? (
              <Text
                allowFontScaling
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
              <RipplePressable
                accessibilityRole="button"
                accessibilityLabel="Poll menu"
                onPress={() => setMenu(true)}
              >
                <Text allowFontScaling style={{ color: colors.quiet, fontFamily: fonts.medium }}>
                  ···
                </Text>
              </RipplePressable>
              {poll.is_author ? (
                <RipplePressable
                  accessibilityRole="button"
                  accessibilityLabel="Delete poll"
                  onPress={async () => {
                    if (!session.token) return;
                    try {
                      await api.deletePoll(poll.id, session.deviceId, session.token);
                      setPoll(null);
                      loadNext();
                    } catch (error) {
                      reportError(error, { context: "delete_poll" });
                      setActionError(errorMessage(error, "Couldn’t delete that poll."));
                    }
                  }}
                >
                  <Text allowFontScaling style={{ color: colors.quiet, fontFamily: fonts.medium }}>
                    Delete poll
                  </Text>
                </RipplePressable>
              ) : null}
            </View>
          </ScrollView>
          {voted ? (
            <GlassSurface
              fallbackColor={colors.canvas}
              style={{ position: "absolute", left: 12, right: 12, bottom: 12, padding: 8, borderRadius: radius.sheet }}
            >
              <RipplePressable
                accessibilityRole="button"
                accessibilityLabel="Next poll"
                onPress={next}
                style={{
                  height: 56,
                  borderRadius: radius.pill,
                  backgroundColor: colors.accent,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text allowFontScaling style={{ color: colors.ink, fontFamily: fonts.bold, fontSize: 18 }}>
                  Next poll
                </Text>
              </RipplePressable>
            </GlassSurface>
          ) : (
            <RipplePressable
              accessibilityRole="button"
              accessibilityLabel="Skip this poll"
              onPress={skip}
              style={{ alignItems: "center", paddingBottom: 18, paddingTop: 8 }}
            >
              <Text allowFontScaling style={{ color: colors.quiet, fontFamily: fonts.medium, fontSize: 16 }}>
                Skip
              </Text>
            </RipplePressable>
          )}
        </View>
      )}
      <SignInSheet visible={(sheet || session.wall) && !session.token} dimmed />
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
            try {
              await api.feedback(poll.id, "relevant", session.deviceId, session.token);
            } catch (error) {
              reportError(error, { context: "feedback_relevant" });
              setActionError(errorMessage(error, "Couldn’t save Relevant."));
            }
          }}
          onNotInterested={async () => {
            setMenu(false);
            if (!session.token) {
              setSheet(true);
              return;
            }
            try {
              await sendDwell(poll.id);
              await api.feedback(poll.id, "not_interested", session.deviceId, session.token);
              setPoll(null);
              loadNext();
            } catch (error) {
              reportError(error, { context: "feedback_not_interested" });
              setActionError(errorMessage(error, "Couldn’t save Not interested."));
            }
          }}
        />
      ) : null}
      {report && poll ? <ReportSheet pollId={poll.id} onClose={() => setReport(false)} /> : null}
    </SafeAreaView>
  );
}
