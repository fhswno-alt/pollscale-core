import { router } from "expo-router";
import { Text, View } from "react-native";

import { useSession } from "../lib/session";
import { colors, fonts } from "../theme";
import { GlassSurface } from "./GlassSurface";
import { LogoMark } from "./LogoMark";
import { RipplePressable } from "./RipplePressable";
import { TopicChip } from "./TopicChip";

export function BrandHeader({
  topicName,
  topicIcon,
  onTopic,
  showActions = false,
}: {
  topicName?: string;
  topicIcon?: string;
  onTopic?: () => void;
  showActions?: boolean;
}) {
  const session = useSession();
  return (
    <GlassSurface fallbackColor={colors.canvas} glassEffectStyle="clear">
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 20,
          paddingTop: 6,
          paddingBottom: 8,
        }}
      >
        <RipplePressable
          accessibilityRole="button"
          accessibilityLabel="You"
          onPress={() => session.token && router.push("/you")}
          style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
        >
          <LogoMark />
          <Text allowFontScaling style={{ color: colors.text, fontFamily: fonts.bold, fontSize: 18, letterSpacing: -0.3 }}>
            Pollscale
          </Text>
        </RipplePressable>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          {showActions && session.token ? (
            <RipplePressable
              accessibilityRole="button"
              accessibilityLabel="Post a poll"
              onPress={() => router.push("/create")}
              hitSlop={10}
            >
              <Text allowFontScaling style={{ color: colors.accent, fontFamily: fonts.bold, fontSize: 28, marginTop: -4 }}>+</Text>
            </RipplePressable>
          ) : null}
          {topicName ? <TopicChip name={topicName} icon={topicIcon} onPress={onTopic} /> : null}
        </View>
      </View>
    </GlassSurface>
  );
}
