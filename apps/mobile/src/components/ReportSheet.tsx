import { useState } from "react";
import { Text, View } from "react-native";

import { errorMessage, reportError } from "../lib/errors";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { colors, fonts, radius } from "../theme";
import { RipplePressable } from "./RipplePressable";
import { Sheet } from "./Sheet";

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
  const [error, setError] = useState("");

  const send = async (reason: string) => {
    setError("");
    try {
      await api.report(pollId, reason, session.deviceId, session.token);
      setDone(true);
    } catch (err) {
      reportError(err, { context: "report_poll", reason });
      setError(errorMessage(err, "Couldn’t send that report."));
    }
  };

  return (
    <Sheet onClose={onClose}>
      <Text allowFontScaling maxFontSizeMultiplier={1.3} style={{ color: colors.text, fontFamily: fonts.black, fontSize: 32 }}>
        Report
      </Text>
      {done ? (
        <Text allowFontScaling style={{ color: colors.muted, marginVertical: 16 }}>
          Thanks. It’s in the queue.
        </Text>
      ) : (
        <View style={{ marginTop: 12, gap: 8 }}>
          {REASONS.map(([value, label]) => (
            <RipplePressable
              key={value}
              accessibilityRole="button"
              accessibilityLabel={`Report as ${label}`}
              onPress={() => send(value)}
              style={{
                borderWidth: 1,
                borderColor: colors.hairline,
                borderRadius: radius.card,
                padding: 14,
              }}
            >
              <Text allowFontScaling style={{ color: colors.text, fontFamily: fonts.bold }}>
                {label}
              </Text>
            </RipplePressable>
          ))}
        </View>
      )}
      {error ? (
        <Text allowFontScaling style={{ color: "#FF8B8B", marginTop: 10 }}>
          {error}
        </Text>
      ) : null}
      <RipplePressable
        accessibilityRole="button"
        accessibilityLabel="Close report sheet"
        onPress={onClose}
        style={{ alignItems: "center", padding: 16 }}
      >
        <Text allowFontScaling style={{ color: colors.quiet, fontFamily: fonts.medium }}>
          Close
        </Text>
      </RipplePressable>
    </Sheet>
  );
}
