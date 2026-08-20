import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { colors, fonts, radius } from "../theme";

const REASONS = [
  ["spam", "Spam"],
  ["hate", "Hate"],
  ["terror", "Terror"],
  ["violence", "Graphic violence"],
  ["sexual", "Sexual / NSFW"],
  ["self_harm", "Self-harm"],
  ["illegal", "Illegal"],
  ["other", "Other"],
] as const;

export function ReportSheet({
  pollId,
  onClose,
}: {
  pollId: string;
  onClose: () => void;
}) {
  const session = useSession();
  const [done, setDone] = useState(false);

  const send = async (reason: string) => {
    await api.report(pollId, reason, session.deviceId, session.token);
    setDone(true);
  };

  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        top: 0,
        backgroundColor: "rgba(0,0,0,0.55)",
        justifyContent: "flex-end",
      }}
    >
      <View style={{ backgroundColor: colors.sheet, padding: 22, borderTopLeftRadius: 28, borderTopRightRadius: 28 }}>
        <Text style={{ color: colors.text, fontFamily: fonts.black, fontSize: 32 }}>Report</Text>
        {done ? (
          <Text style={{ color: colors.muted, marginVertical: 16 }}>Thanks. It’s in the queue.</Text>
        ) : (
          <View style={{ marginTop: 12, gap: 8 }}>
            {REASONS.map(([value, label]) => (
              <Pressable
                key={value}
                onPress={() => send(value)}
                style={{
                  borderWidth: 1,
                  borderColor: colors.hairline,
                  borderRadius: radius.card,
                  padding: 14,
                }}
              >
                <Text style={{ color: colors.text, fontFamily: fonts.bold }}>{label}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <Pressable onPress={onClose} style={{ alignItems: "center", padding: 16 }}>
          <Text style={{ color: colors.quiet, fontFamily: fonts.medium }}>Close</Text>
        </Pressable>
      </View>
    </View>
  );
}
