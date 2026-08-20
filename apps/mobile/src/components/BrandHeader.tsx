import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { useSession } from "../lib/session";
import { colors, fonts } from "../theme";
import { LogoMark } from "./LogoMark";
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
      <Pressable
        onPress={() => session.token && router.push("/you")}
        style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
      >
        <LogoMark />
        <Text style={{ color: colors.text, fontFamily: fonts.bold, fontSize: 18, letterSpacing: -0.3 }}>
          Pollscale
        </Text>
      </Pressable>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        {showActions && session.token ? (
          <Pressable onPress={() => router.push("/create")} hitSlop={10}>
            <Text style={{ color: colors.accent, fontFamily: fonts.bold, fontSize: 28, marginTop: -4 }}>+</Text>
          </Pressable>
        ) : null}
        {topicName ? <TopicChip name={topicName} icon={topicIcon} onPress={onTopic} /> : null}
      </View>
    </View>
  );
}
