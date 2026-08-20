import { Text } from "react-native";

import { colors, fonts, minHit, space, type } from "../theme";
import { GroupedRow, GroupedSection } from "./GroupedList";
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
      <Text
        allowFontScaling
        maxFontSizeMultiplier={1.3}
        style={{ ...type.display, color: colors.text, marginBottom: space.s16 }}
      >
        More
      </Text>
      <GroupedSection>
        <GroupedRow label="Relevant" onPress={onRelevant} />
        <GroupedRow label="Not interested" onPress={onNotInterested} />
        <GroupedRow label="Report" onPress={onReport} last />
      </GroupedSection>
      <RipplePressable
        accessibilityRole="button"
        accessibilityLabel="Close poll menu"
        onPress={onClose}
        style={{ marginTop: space.s12, alignItems: "center", minHeight: minHit, justifyContent: "center" }}
      >
        <Text allowFontScaling style={{ color: colors.quiet, fontFamily: fonts.medium }}>
          Close
        </Text>
      </RipplePressable>
    </Sheet>
  );
}
