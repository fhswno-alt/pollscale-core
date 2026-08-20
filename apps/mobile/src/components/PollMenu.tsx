import { Text } from "react-native";

import { colors, fonts, radius } from "../theme";
import { RipplePressable } from "./RipplePressable";
import { Sheet } from "./Sheet";

export function PollMenu({
  onRelevant,
  onNotInterested,
  onReport,
  onClose,
}: {
  onRelevant: () => void;
  onNotInterested: () => void;
  onReport: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet onClose={onClose}>
      <Row label="Relevant" onPress={onRelevant} />
      <Row label="Not interested" onPress={onNotInterested} />
      <Row label="Report" onPress={onReport} />
      <RipplePressable
        accessibilityRole="button"
        accessibilityLabel="Close poll menu"
        onPress={onClose}
        style={{ marginTop: 10, alignItems: "center", padding: 10 }}
      >
        <Text allowFontScaling style={{ color: colors.quiet, fontFamily: fonts.medium }}>
          Close
        </Text>
      </RipplePressable>
    </Sheet>
  );
}

function Row({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <RipplePressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        borderWidth: 1,
        borderColor: colors.hairline,
        borderRadius: radius.card,
        padding: 16,
        marginBottom: 8,
      }}
    >
      <Text allowFontScaling style={{ color: colors.text, fontFamily: fonts.bold, fontSize: 18 }}>
        {label}
      </Text>
    </RipplePressable>
  );
}
