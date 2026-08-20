import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { motion, useReduceMotion } from "../lib/motion";
import { colors, radius, space } from "../theme";
import { GlassSurface } from "./GlassSurface";

export function Sheet({
  children,
  onClose,
  dimmed = true,
  visible = true,
}: {
  children: ReactNode;
  onClose?: () => void;
  dimmed?: boolean;
  visible?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(0);
  const [shown, setShown] = useState(visible);

  useEffect(() => {
    if (visible) {
      setShown(true);
      progress.value = reduceMotion ? 1 : withSpring(1, motion.sheetSpring);
      return;
    }
    if (!shown) return;
    const hide = () => setShown(false);
    if (reduceMotion) {
      progress.value = 0;
      hide();
      return;
    }
    progress.value = withTiming(0, { duration: motion.duration.snap }, (finished) => {
      if (finished) runOnJS(hide)();
    });
  }, [visible, reduceMotion, shown, progress]);

  const dimStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 48 }],
  }));

  if (!shown) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {dimmed ? (
        <Animated.View style={[styles.dim, dimStyle]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            onPress={onClose}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : (
        <Animated.View style={[styles.dim, dimStyle]} pointerEvents="none" />
      )}
      <Animated.View style={[styles.sheetWrap, sheetStyle]}>
        <GlassSurface
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, space.s20) },
          ]}
        >
          <View style={styles.grab} />
          {children}
        </GlassSurface>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  dim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheetWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    overflow: "hidden",
    paddingHorizontal: 22,
    paddingTop: space.s12,
  },
  grab: {
    alignSelf: "center",
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
    marginBottom: 22,
  },
});
