import { Pressable, Text, View } from "react-native";

import { colors, fonts, radius } from "../theme";

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
    <View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        top: 0,
        backgroundColor: "rgba(0,0,0,0.62)",
        justifyContent: "flex-end",
      }}
    >
      <Pressable style={{ flex: 1 }} onPress={onClose} />
      <View style={{ backgroundColor: colors.sheet, padding: 22, borderTopLeftRadius: 28, borderTopRightRadius: 28 }}>
        <Row label="Relevant" onPress={onRelevant} />
        <Row label="Not interested" onPress={onNotInterested} />
        <Row label="Report" onPress={onReport} />
        <Pressable onPress={onClose} style={{ marginTop: 10, alignItems: "center", padding: 10 }}>
          <Text style={{ color: colors.quiet, fontFamily: fonts.medium }}>Close</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Row({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        borderWidth: 1,
        borderColor: colors.hairline,
        borderRadius: radius.card,
        padding: 16,
        marginBottom: 8,
      }}
    >
      <Text style={{ color: colors.text, fontFamily: fonts.bold, fontSize: 18 }}>{label}</Text>
    </Pressable>
  );
}
