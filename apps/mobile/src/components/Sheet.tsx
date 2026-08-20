import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, radius } from "../theme";
import { GlassSurface } from "./GlassSurface";

export function Sheet({
  children,
  onClose,
  dimmed = true,
}: {
  children: ReactNode;
  onClose?: () => void;
  dimmed?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {dimmed ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          onPress={onClose}
          style={styles.dim}
        />
      ) : (
        <View style={styles.dim} />
      )}
      <GlassSurface
        style={[
          styles.sheet,
          { paddingBottom: Math.max(insets.bottom, 20) },
        ]}
      >
        <View style={styles.grab} />
        {children}
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  dim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    overflow: "hidden",
    paddingHorizontal: 22,
    paddingTop: 12,
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
