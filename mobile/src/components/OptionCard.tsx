import { useEffect, useRef } from "react";
import {
  Animated,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { Option } from "../lib/types";
import { colors, fonts, radius } from "../theme";

export function OptionCard({
  option,
  photo,
  compact,
  results,
  winning,
  onPress,
}: {
  option: Option;
  photo: boolean;
  compact?: boolean;
  results?: boolean;
  winning?: boolean;
  onPress?: () => void;
}) {
  const width = useRef(new Animated.Value(0)).current;
  const percent = option.percent ?? 0;

  useEffect(() => {
    if (!results) return;
    width.setValue(0);
    Animated.spring(width, {
      toValue: Math.max(percent, 8),
      useNativeDriver: false,
      friction: 7,
      tension: 86,
    }).start();
  }, [results, percent, width]);

  const height = photo ? (compact ? 118 : 148) : compact ? 56 : 64;
  const borderColor = results && winning ? colors.accent : colors.hairline;

  return (
    <Pressable
      onPress={results ? undefined : onPress}
      style={[styles.card, { height, borderColor }]}
    >
      {option.image_url ? (
        <ImageBackground source={{ uri: option.image_url }} style={styles.fill} imageStyle={styles.image}>
          <View style={styles.scrim} />
          {results ? <ResultOverlay option={option} width={width} winning={!!winning} photo /> : (
            <Text style={styles.photoLabel}>{option.label}</Text>
          )}
        </ImageBackground>
      ) : results ? (
        <ResultOverlay option={option} width={width} winning={!!winning} />
      ) : (
        <View style={styles.center}>
          <Text style={styles.textLabel}>{option.label}</Text>
        </View>
      )}
    </Pressable>
  );
}

function ResultOverlay({
  option,
  width,
  winning,
  photo,
}: {
  option: Option;
  width: Animated.Value;
  winning: boolean;
  photo?: boolean;
}) {
  return (
    <View style={styles.fill}>
      {photo ? <Text style={styles.resultLabel}>{option.label}</Text> : null}
      <Animated.View
        style={[
          styles.bar,
          photo ? styles.photoBar : styles.textBar,
          {
            width: width.interpolate({
              inputRange: [0, 100],
              outputRange: ["0%", "100%"],
            }),
            backgroundColor: winning ? colors.accent : colors.barLose,
          },
        ]}
      >
        <Text style={styles.percent}>{option.percent ?? 0}%</Text>
        {!photo ? <Text style={styles.barLabel}>{option.label}</Text> : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    overflow: "hidden",
    backgroundColor: colors.canvas,
  },
  fill: { flex: 1 },
  image: { borderRadius: radius.card - 1 },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  textLabel: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 20,
    letterSpacing: -0.3,
    textAlign: "center",
  },
  photoLabel: {
    position: "absolute",
    left: 16,
    bottom: 14,
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 22,
    letterSpacing: -0.4,
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowRadius: 8,
  },
  resultLabel: {
    position: "absolute",
    left: 16,
    top: 14,
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 18,
    zIndex: 2,
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowRadius: 8,
  },
  bar: {
    position: "absolute",
    left: 0,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 16,
    gap: 10,
  },
  textBar: {
    top: 0,
    bottom: 0,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
  },
  photoBar: {
    bottom: 14,
    height: 52,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
  },
  percent: {
    color: colors.ink,
    fontFamily: fonts.black,
    fontSize: 28,
    letterSpacing: -0.8,
  },
  barLabel: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 16,
  },
});
