import { useEffect, useState } from "react";
import { ImageBackground, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  type SharedValue,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { motion, useReduceMotion } from "../../lib/motion";
import type { Option, Poll } from "../../lib/types";
import { colors, fonts, minHit, radius, space, type } from "../../theme";
import { BrandHeader } from "../BrandHeader";
import { RipplePressable } from "../RipplePressable";

function formatVotes(n: number) {
  if (n >= 10000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K votes`;
  return `${n.toLocaleString()} votes`;
}

function isSplit(poll: Poll) {
  return poll.options.length === 2 && poll.options.every((option) => !!option.image_url);
}

export function PollCanvas({
  poll,
  busy,
  actionError,
  onVote,
  onSkip,
  onNext,
  onMore,
  onTopic,
  onDelete,
}: {
  poll: Poll;
  busy: boolean;
  actionError: string | null;
  onVote: (optionId: string) => void;
  onSkip: () => void;
  onNext: () => void;
  onMore: () => void;
  onTopic: () => void;
  onDelete?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const voted = !!poll.viewer_vote_option_id;
  const winning = voted ? Math.max(...poll.options.map((option) => option.percent ?? -1)) : -1;
  const split = isSplit(poll);
  const translateY = useSharedValue(0);
  const incoming = useSharedValue(1);
  const reduce = useSharedValue(reduceMotion);
  const locked = useSharedValue(busy);
  const pageId = useSharedValue("");

  useEffect(() => {
    reduce.value = reduceMotion;
    locked.value = busy;
  }, [busy, reduce, reduceMotion, locked]);

  useEffect(() => {
    pageId.value = poll.id;
  }, [pageId, poll.id]);

  useAnimatedReaction(
    () => pageId.value,
    (current, previous) => {
      if (!current || current === previous) return;
      translateY.value = 0;
      if (reduce.value) {
        incoming.value = 1;
        return;
      }
      incoming.value = 0;
      incoming.value = withTiming(1, { duration: motion.duration.in, easing: motion.easing });
    },
  );

  const advance = () => {
    if (busy) return;
    if (voted) onNext();
    else onSkip();
  };

  const swipe = Gesture.Pan()
    .enabled(!busy)
    .activeOffsetY([-20, 20])
    .failOffsetX([-36, 36])
    .onUpdate((event) => {
      if (locked.value) return;
      const next = Math.min(0, event.translationY) * 0.7;
      translateY.value = next;
    })
    .onEnd((event) => {
      if (locked.value) {
        translateY.value = 0;
        return;
      }
      const go = event.translationY < -72 || event.velocityY < -920;
      if (go) runOnJS(advance)();
      translateY.value = reduce.value ? 0 : withSpring(0, motion.spring);
    });

  const pageStyle = useAnimatedStyle(() => {
    if (reduce.value) {
      return { opacity: incoming.value, transform: [{ translateY: 0 }] };
    }
    return {
      opacity: incoming.value,
      transform: [{ translateY: (1 - incoming.value) * 52 + translateY.value }],
    };
  });

  return (
    <View style={styles.root}>
      <GestureDetector gesture={swipe}>
        <Animated.View style={[styles.page, pageStyle]}>
          {split ? (
            <SplitBody
              poll={poll}
              voted={voted}
              winning={winning}
              busy={busy}
              onVote={onVote}
              topInset={insets.top + 56}
              bottomInset={insets.bottom + 84}
            />
          ) : (
            <StackedBody
              poll={poll}
              voted={voted}
              winning={winning}
              busy={busy}
              onVote={onVote}
              topInset={insets.top + 56}
              bottomInset={insets.bottom + 84}
            />
          )}
        </Animated.View>
      </GestureDetector>

      <BrandHeader
        overlay
        topicName={poll.topic.name}
        topicIcon={poll.topic.icon}
        onTopic={onTopic}
        showActions
      />

      <View
        pointerEvents="box-none"
        style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.s12) + space.s8 }]}
      >
        {actionError ? (
          <Text allowFontScaling style={styles.error}>
            {actionError}
          </Text>
        ) : null}
        {voted && poll.total_votes != null ? (
          <Text allowFontScaling style={styles.votes}>
            {formatVotes(poll.total_votes)}
          </Text>
        ) : null}
        <View style={styles.footerRow}>
          <RipplePressable
            accessibilityRole="button"
            accessibilityLabel="More"
            hitSlop={12}
            onPress={onMore}
            style={styles.quietHit}
          >
            <Text allowFontScaling style={styles.quietLabel}>
              More
            </Text>
          </RipplePressable>
          {poll.is_author && onDelete ? (
            <RipplePressable
              accessibilityRole="button"
              accessibilityLabel="Delete poll"
              hitSlop={12}
              onPress={onDelete}
              style={styles.quietHit}
            >
              <Text allowFontScaling style={styles.quietLabel}>
                Delete
              </Text>
            </RipplePressable>
          ) : (
            <View />
          )}
          <RipplePressable
            accessibilityRole="button"
            accessibilityLabel={voted ? "Next poll" : "Skip this poll"}
            hitSlop={12}
            disabled={busy}
            onPress={voted ? onNext : onSkip}
            style={styles.quietHit}
          >
            <Text allowFontScaling style={styles.quietLabel}>
              {voted ? "Next" : "Skip"}
            </Text>
          </RipplePressable>
        </View>
      </View>
    </View>
  );
}

function SplitBody({
  poll,
  voted,
  winning,
  busy,
  onVote,
  topInset,
  bottomInset,
}: {
  poll: Poll;
  voted: boolean;
  winning: number;
  busy: boolean;
  onVote: (optionId: string) => void;
  topInset: number;
  bottomInset: number;
}) {
  return (
    <View style={styles.split}>
      {poll.options.map((option, index) => (
        <FeedOption
          key={option.id}
          option={option}
          results={voted}
          winning={voted && (option.percent ?? 0) === winning && winning >= 0}
          variant="split"
          edge={index === 0 ? "left" : "right"}
          padBottom={bottomInset}
          onPress={voted || busy ? undefined : () => onVote(option.id)}
        />
      ))}
      <View pointerEvents="none" style={[styles.splitQuestion, { paddingTop: topInset + space.s8 }]}>
        <View style={styles.splitScrim} />
        <Text allowFontScaling maxFontSizeMultiplier={1.25} style={styles.splitQuestionText}>
          {poll.question}
        </Text>
      </View>
    </View>
  );
}

function StackedBody({
  poll,
  voted,
  winning,
  busy,
  onVote,
  topInset,
  bottomInset,
}: {
  poll: Poll;
  voted: boolean;
  winning: number;
  busy: boolean;
  onVote: (optionId: string) => void;
  topInset: number;
  bottomInset: number;
}) {
  const photo = poll.options.some((option) => option.image_url);
  return (
    <View style={[styles.stacked, { paddingTop: topInset, paddingBottom: bottomInset }]}>
      <Text
        allowFontScaling
        maxFontSizeMultiplier={1.25}
        style={[styles.stackedQuestion, photo ? styles.stackedQuestionPhoto : null]}
      >
        {poll.question}
      </Text>
      <View style={styles.slabs}>
        {poll.options.map((option) => (
          <FeedOption
            key={option.id}
            option={option}
            results={voted}
            winning={voted && (option.percent ?? 0) === winning && winning >= 0}
            variant={option.image_url ? "photo" : "text"}
            onPress={voted || busy ? undefined : () => onVote(option.id)}
          />
        ))}
      </View>
    </View>
  );
}

function FeedOption({
  option,
  results,
  winning,
  variant,
  edge,
  padBottom,
  onPress,
}: {
  option: Option;
  results: boolean;
  winning: boolean;
  variant: "split" | "photo" | "text";
  edge?: "left" | "right";
  padBottom?: number;
  onPress?: () => void;
}) {
  const reduceMotion = useReduceMotion();
  const percent = option.percent ?? 0;
  const fill = useSharedValue(0);
  const counted = useSharedValue(reduceMotion && results ? percent : 0);

  useEffect(() => {
    if (!results) {
      fill.value = 0;
      counted.value = 0;
      return;
    }
    const target = Math.max(percent, 10) / 100;
    if (reduceMotion) {
      fill.value = target;
      counted.value = percent;
      return;
    }
    fill.value = 0;
    counted.value = 0;
    fill.value = withSpring(target, motion.spring);
    counted.value = withTiming(percent, { duration: motion.duration.hold, easing: motion.easing });
  }, [counted, fill, percent, reduceMotion, results]);

  const barStyle = useAnimatedStyle(() => {
    if (variant === "split") {
      return { height: `${fill.value * 100}%`, width: "100%" };
    }
    return { width: `${fill.value * 100}%`, height: "100%" };
  });

  const ink = results ? colors.ink : colors.text;

  return (
    <RipplePressable
      accessibilityRole="button"
      accessibilityLabel={results ? `${option.label}, ${percent} percent` : `Vote ${option.label}`}
      accessibilityState={{ disabled: !onPress }}
      onPress={onPress}
      style={[
        styles.option,
        variant === "split" && styles.optionSplit,
        variant === "split" && edge === "left" && styles.optionSplitLeft,
        variant === "text" && styles.optionText,
        variant === "photo" && styles.optionPhoto,
      ]}
    >
      {option.image_url ? (
        <ImageBackground source={{ uri: option.image_url }} style={styles.fill} imageStyle={styles.image}>
          <View style={styles.photoScrim} />
          {results ? <ResultFill barStyle={barStyle} winning={winning} vertical={variant === "split"} /> : null}
          <OptionCopy
            option={option}
            results={results}
            counted={counted}
            color={results ? colors.ink : colors.text}
            padBottom={padBottom}
            split={variant === "split"}
          />
        </ImageBackground>
      ) : (
        <View style={styles.fill}>
          {results ? <ResultFill barStyle={barStyle} winning={winning} /> : null}
          <OptionCopy option={option} results={results} counted={counted} color={ink} />
        </View>
      )}
    </RipplePressable>
  );
}

function ResultFill({
  barStyle,
  winning,
  vertical,
}: {
  barStyle: ReturnType<typeof useAnimatedStyle>;
  winning: boolean;
  vertical?: boolean;
}) {
  return (
    <Animated.View
      style={[
        styles.bar,
        vertical ? styles.barVertical : styles.barHorizontal,
        { backgroundColor: winning ? colors.accent : colors.barLose },
        barStyle as never,
      ]}
    />
  );
}

function OptionCopy({
  option,
  results,
  counted,
  color,
  padBottom,
  split,
}: {
  option: Option;
  results: boolean;
  counted: SharedValue<number>;
  color: string;
  padBottom?: number;
  split?: boolean;
}) {
  const [text, setText] = useState(`${option.percent ?? 0}%`);

  useAnimatedReaction(
    () => Math.round(counted.value),
    (next, prev) => {
      if (next !== prev) runOnJS(setText)(`${next}%`);
    },
  );

  return (
    <View
      style={[
        styles.copy,
        results || split ? styles.copyResults : styles.copyVote,
        padBottom ? { paddingBottom: padBottom } : null,
      ]}
      pointerEvents="none"
    >
      {results ? (
        <Text allowFontScaling maxFontSizeMultiplier={1.2} style={[styles.percent, { color }]}>
          {text}
        </Text>
      ) : null}
      <Text
        allowFontScaling
        maxFontSizeMultiplier={1.3}
        style={[styles.optionLabel, { color: results ? color : colors.text, textAlign: results ? "left" : "center" }]}
      >
        {option.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  page: {
    flex: 1,
  },
  split: {
    flex: 1,
    flexDirection: "row",
  },
  splitQuestion: {
    position: "absolute",
    left: 0,
    right: 0,
    paddingHorizontal: space.s20,
    paddingBottom: space.s20,
  },
  splitScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(11,11,12,0.42)",
  },
  splitQuestionText: {
    ...type.display,
    color: colors.text,
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowRadius: 12,
  },
  stacked: {
    flex: 1,
    paddingHorizontal: space.s20,
  },
  stackedQuestion: {
    ...type.display,
    color: colors.text,
    marginBottom: space.s20,
  },
  stackedQuestionPhoto: {
    fontSize: 34,
    lineHeight: 36,
  },
  slabs: {
    flex: 1,
    gap: space.s8,
  },
  option: {
    overflow: "hidden",
    backgroundColor: colors.chip,
    minHeight: minHit,
  },
  optionSplit: {
    flex: 1,
    borderRadius: 0,
  },
  optionSplitLeft: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.hairline,
  },
  optionText: {
    flex: 1,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  optionPhoto: {
    flex: 1,
    borderRadius: radius.card,
    minHeight: 96,
  },
  fill: {
    flex: 1,
  },
  image: {
    resizeMode: "cover",
  },
  photoScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  bar: {
    position: "absolute",
  },
  barHorizontal: {
    left: 0,
    top: 0,
    bottom: 0,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
  },
  barVertical: {
    left: 0,
    right: 0,
    bottom: 0,
  },
  copy: {
    ...StyleSheet.absoluteFill,
    paddingHorizontal: space.s16,
    paddingVertical: space.s16,
    gap: space.s4,
  },
  copyVote: {
    justifyContent: "center",
    alignItems: "center",
  },
  copyResults: {
    justifyContent: "flex-end",
    alignItems: "flex-start",
  },
  optionLabel: {
    fontFamily: fonts.bold,
    fontSize: 20,
    letterSpacing: -0.3,
  },
  percent: {
    ...type.percent,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.s20,
    gap: space.s4,
  },
  footerRow: {
    minHeight: minHit,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  quietHit: {
    minHeight: minHit,
    minWidth: minHit,
    justifyContent: "center",
  },
  quietLabel: {
    ...type.body,
    color: colors.quiet,
  },
  votes: {
    ...type.caption,
    color: colors.muted,
  },
  error: {
    ...type.caption,
    color: colors.danger,
  },
});
