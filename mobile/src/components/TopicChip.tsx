import { Pressable, Text, View } from "react-native";

import { colors, fonts, radius } from "../theme";

const ICONS: Record<string, string> = {
  leaf: "🌿",
  food: "🍕",
  note: "♪",
  gov: "⚖",
  film: "🎬",
  bag: "✦",
};

export function TopicChip({
  name,
  icon,
  accent = false,
  onPress,
}: {
  name: string;
  icon?: string;
  accent?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: accent ? colors.accent : colors.hairline,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: colors.chip,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
      }}
    >
      {icon ? <Text style={{ fontSize: 12 }}>{ICONS[icon] ?? ""}</Text> : null}
      <Text
        style={{
          color: accent ? colors.accent : colors.muted,
          fontFamily: fonts.medium,
          fontSize: 13,
        }}
      >
        {name}
      </Text>
    </Pressable>
  );
}

export function TopicDot({ name }: { name: string }) {
  return (
    <View
      style={{
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: colors.hairline,
        paddingHorizontal: 12,
        paddingVertical: 6,
      }}
    >
      <Text style={{ color: colors.muted, fontFamily: fonts.medium, fontSize: 13 }}>{name}</Text>
    </View>
  );
}
