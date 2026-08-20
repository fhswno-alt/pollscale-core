import { router } from "expo-router";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSession } from "../lib/session";
import { colors, fonts, minHit, space } from "../theme";
import { GlassSurface } from "./GlassSurface";
import { LogoMark } from "./LogoMark";
import { RipplePressable } from "./RipplePressable";
import { TopicChip } from "./TopicChip";

export function BrandHeader({
  topicName,
  topicIcon,
  onTopic,
  showActions = false,
  overlay = false,
}: {
  topicName?: string;
  topicIcon?: string;
  onTopic?: () => void;
  showActions?: boolean;
  overlay?: boolean;
}) {
  const session = useSession();
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="box-none"
      style={
        overlay
          ? { position: "absolute", left: 0, right: 0, top: 0, zIndex: 5 }
          : undefined
      }
    >
      <GlassSurface fallbackColor={colors.canvas} glassEffectStyle="clear">
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: space.s20,
            paddingTop: overlay ? insets.top + space.s4 : space.s4,
            paddingBottom: space.s8,
          }}
        >
          <RipplePressable
            accessibilityRole="button"
            accessibilityLabel="You"
            onPress={() => session.token && router.push("/you")}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: space.s8,
              minHeight: minHit,
            }}
          >
            <LogoMark />
            <Text
              allowFontScaling
              style={{ color: colors.text, fontFamily: fonts.bold, fontSize: 18, letterSpacing: -0.3 }}
            >
              Pollscale
            </Text>
          </RipplePressable>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.s8 }}>
            {showActions && session.token ? (
              <RipplePressable
                accessibilityRole="button"
                accessibilityLabel="Post a poll"
                onPress={() => router.push("/create")}
                hitSlop={10}
                style={{ minHeight: minHit, minWidth: minHit, alignItems: "center", justifyContent: "center" }}
              >
                <Text
                  allowFontScaling
                  style={{ color: colors.accent, fontFamily: fonts.bold, fontSize: 28, marginTop: -4 }}
                >
                  +
                </Text>
              </RipplePressable>
            ) : null}
            {topicName ? <TopicChip name={topicName} icon={topicIcon} onPress={onTopic} /> : null}
          </View>
        </View>
      </GlassSurface>
    </View>
  );
}
