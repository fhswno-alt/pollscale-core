import { Text } from "react-native";

import { colors, fonts, minHit, radius, space, type } from "../theme";
import { RipplePressable } from "./RipplePressable";
import { Sheet } from "./Sheet";

export function ConfirmSheet({
  visible,
  title,
  body,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text allowFontScaling maxFontSizeMultiplier={1.3} style={{ ...type.display, color: colors.text }}>
        {title}
      </Text>
      <Text
        allowFontScaling
        style={{ ...type.body, color: colors.muted, marginTop: space.s8, marginBottom: space.s24 }}
      >
        {body}
      </Text>
      <RipplePressable
        accessibilityRole="button"
        accessibilityLabel={confirmLabel}
        onPress={onConfirm}
        style={{
          minHeight: minHit,
          height: 56,
          borderRadius: radius.pill,
          backgroundColor: colors.barLose,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text allowFontScaling style={{ color: colors.ink, fontFamily: fonts.bold, fontSize: 17 }}>
          {confirmLabel}
        </Text>
      </RipplePressable>
      <RipplePressable
        accessibilityRole="button"
        accessibilityLabel="Cancel"
        onPress={onClose}
        style={{ minHeight: minHit, alignItems: "center", justifyContent: "center", marginTop: space.s8 }}
      >
        <Text allowFontScaling style={{ ...type.body, color: colors.quiet }}>
          Cancel
        </Text>
      </RipplePressable>
    </Sheet>
  );
}
