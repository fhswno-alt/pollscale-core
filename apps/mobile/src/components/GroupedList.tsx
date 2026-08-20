import type { ReactNode } from "react";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { colors, fonts, minHit, radius, space, type } from "../theme";
import { RipplePressable } from "./RipplePressable";

export function ScreenBack({ onPress }: { onPress?: () => void }) {
  return (
    <RipplePressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      hitSlop={12}
      onPress={onPress ?? (() => router.back())}
      style={styles.back}
    >
      <Text allowFontScaling style={styles.backMark}>
        ‹
      </Text>
    </RipplePressable>
  );
}

export function ScreenTitle({ children }: { children: string }) {
  return (
    <Text allowFontScaling maxFontSizeMultiplier={1.3} style={styles.title}>
      {children}
    </Text>
  );
}

export function GroupedSection({ children }: { children: ReactNode }) {
  return <View style={styles.section}>{children}</View>;
}

export function GroupedRow({
  label,
  detail,
  onPress,
  last = false,
  destructive = false,
  children,
}: {
  label: string;
  detail?: string;
  onPress?: () => void;
  last?: boolean;
  destructive?: boolean;
  children?: ReactNode;
}) {
  return (
    <RipplePressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={label}
      onPress={onPress}
      disabled={!onPress}
      style={[styles.row, last ? null : styles.rowLine]}
    >
      <View style={styles.rowText}>
        <Text
          allowFontScaling
          style={[styles.rowLabel, destructive ? styles.rowDanger : null]}
        >
          {label}
        </Text>
        {detail ? (
          <Text allowFontScaling style={styles.rowDetail}>
            {detail}
          </Text>
        ) : null}
      </View>
      {children}
      {onPress && !children ? (
        <Text allowFontScaling style={styles.chevron}>
          ›
        </Text>
      ) : null}
    </RipplePressable>
  );
}

const styles = StyleSheet.create({
  back: {
    minHeight: minHit,
    minWidth: minHit,
    justifyContent: "center",
    paddingHorizontal: space.s16,
  },
  backMark: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 30,
    marginTop: -2,
  },
  title: {
    ...type.display,
    color: colors.text,
    paddingHorizontal: space.s20,
  },
  section: {
    backgroundColor: colors.sheet,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    overflow: "hidden",
  },
  row: {
    minHeight: 52,
    paddingHorizontal: space.s16,
    paddingVertical: space.s12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.s12,
  },
  rowLine: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontFamily: fonts.bold,
    fontSize: 17,
    color: colors.text,
  },
  rowDanger: {
    color: colors.danger,
  },
  rowDetail: {
    ...type.caption,
    color: colors.muted,
  },
  chevron: {
    color: colors.quiet,
    fontSize: 22,
    lineHeight: 24,
  },
});
