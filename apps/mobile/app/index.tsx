import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandHeader } from "../src/components/BrandHeader";
import { ConfirmSheet } from "../src/components/ConfirmSheet";
import { PollCanvas } from "../src/components/feed/PollCanvas";
import { PollMenu } from "../src/components/PollMenu";
import { ReportSheet } from "../src/components/ReportSheet";
import { RipplePressable } from "../src/components/RipplePressable";
import { SignInSheet } from "../src/components/SignInSheet";
import { trackFunnel } from "../src/lib/analytics";
import { api } from "../src/lib/api";
import { errorMessage, reportError } from "../src/lib/errors";
import { hapticNext, hapticSkip, hapticVote } from "../src/lib/haptics";
import { useSession } from "../src/lib/session";
import type { Poll } from "../src/lib/types";
import { colors, fonts, minHit, radius, space, type } from "../src/theme";

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

export default function VoteScreen() {
  const session = useSession();
  const insets = useSafeAreaInsets();
  const [poll, setPoll] = useState<Poll | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [report, setReport] = useState(false);
  const [menu, setMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [shownAt, setShownAt] = useState(0);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const pollRef = useRef<Poll | null>(null);
  pollRef.current = poll;

  const voted = !!poll?.viewer_vote_option_id;

  const loadNext = useCallback(async () => {
    if (!session.ready || !session.deviceId) return;
    const keepResult = !!pollRef.current;
    if (!keepResult) setLoading(true);
    else setBusy(true);
    setFeedError(null);
    try {
      const feed = await api.feed(session.deviceId, session.token);
      session.applyFeed(feed);
      setPoll(feed.poll);
      setShownAt(Date.now());
      if (!session.token && feed.guest_votes_used >= 3) setSheet(true);
    } catch (error) {
      reportError(error, { context: "feed_next" });
      if (!keepResult) {
        setPoll(null);
        setFeedError(errorMessage(error, "Couldn’t load For You."));
      } else {
        setActionError(errorMessage(error, "Couldn’t load the next poll."));
      }
    } finally {
      setLoading(false);
      setBusy(false);
    }
    // session.applyFeed is stable enough for this load cycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.ready, session.deviceId, session.token]);

  useEffect(() => {
    void loadNext();
  }, [loadNext, session.token]);

  const sendDwell = (pollId: string) =>
    recordDwell(pollId, shownAt, session.deviceId, session.token);

  const guestBlocked = () => {
    if (!session.token && session.guestVotesUsed >= 3) {
      setSheet(true);
      return true;
    }
    return false;
  };

  const vote = async (optionId: string) => {
    if (!poll || voted || busy) return;
    if (guestBlocked()) return;
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

  const skip = async () => {
    if (!poll || voted || busy) return;
    if (guestBlocked()) return;
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
    if (guestBlocked()) return;
    void hapticNext();
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

  const deletePoll = async () => {
    if (!poll || !session.token) return;
    setConfirmDelete(false);
    try {
      await api.deletePoll(poll.id, session.deviceId, session.token);
      setPoll(null);
      loadNext();
    } catch (error) {
      reportError(error, { context: "delete_poll" });
      setActionError(errorMessage(error, "Couldn’t delete that poll."));
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      {loading && !poll ? (
        <View style={{ flex: 1 }}>
          <BrandHeader overlay showActions />
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={colors.accent} />
          </View>
        </View>
      ) : feedError ? (
        <FeedState
          title="Couldn’t load For You."
          body={feedError}
          action="Retry"
          onAction={loadNext}
          top={insets.top}
        />
      ) : !poll ? (
        <FeedState
          title="That’s the lot."
          body="Follow topics and people to keep For You moving. Or post something people will actually pick."
          action={session.token ? "Post a poll" : undefined}
          onAction={session.token ? () => router.push("/create") : undefined}
          secondary="Follow topics"
          onSecondary={() => router.push("/topics")}
          top={insets.top}
        />
      ) : (
        <PollCanvas
          poll={poll}
          busy={busy}
          actionError={actionError}
          onVote={vote}
          onSkip={skip}
          onNext={next}
          onMore={() => setMenu(true)}
          onTopic={onTopic}
          onDelete={poll.is_author ? () => setConfirmDelete(true) : undefined}
        />
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
      <ConfirmSheet
        visible={confirmDelete}
        title="Delete this poll?"
        body="It leaves For You. Votes already cast stay in the totals."
        confirmLabel="Delete poll"
        onConfirm={deletePoll}
        onClose={() => setConfirmDelete(false)}
      />
    </View>
  );
}

function FeedState({
  title,
  body,
  action,
  onAction,
  secondary,
  onSecondary,
  top,
}: {
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
  secondary?: string;
  onSecondary?: () => void;
  top: number;
}) {
  return (
    <View style={{ flex: 1 }}>
      <BrandHeader overlay showActions />
      <View
        style={{
          flex: 1,
          paddingHorizontal: space.s24,
          paddingTop: top + 88,
          justifyContent: "center",
          paddingBottom: space.s40,
        }}
      >
        <Text allowFontScaling maxFontSizeMultiplier={1.3} style={{ ...type.display, color: colors.text }}>
          {title}
        </Text>
        <Text
          allowFontScaling
          style={{ ...type.body, color: colors.muted, marginTop: space.s12, maxWidth: 320 }}
        >
          {body}
        </Text>
        {action && onAction ? (
          <RipplePressable
            accessibilityRole="button"
            accessibilityLabel={action}
            onPress={onAction}
            style={{
              marginTop: space.s28,
              height: 56,
              minHeight: minHit,
              borderRadius: radius.pill,
              backgroundColor: colors.accent,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text allowFontScaling style={{ color: colors.ink, fontFamily: fonts.bold, fontSize: 18 }}>
              {action}
            </Text>
          </RipplePressable>
        ) : null}
        {secondary && onSecondary ? (
          <RipplePressable
            accessibilityRole="button"
            accessibilityLabel={secondary}
            onPress={onSecondary}
            style={{
              marginTop: action ? space.s12 : space.s28,
              minHeight: minHit,
              alignItems: action ? "center" : "flex-start",
              justifyContent: "center",
            }}
          >
            <Text allowFontScaling style={{ ...type.body, color: colors.quiet }}>
              {secondary}
            </Text>
          </RipplePressable>
        ) : null}
      </View>
    </View>
  );
}
