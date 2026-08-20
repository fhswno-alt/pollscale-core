import { Link } from "expo-router";
import { Text, View } from "react-native";

import { colors, fonts } from "../src/theme";

export default function NotFound() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas, padding: 24, justifyContent: "center" }}>
      <Text style={{ color: colors.text, fontFamily: fonts.black, fontSize: 36 }}>Lost.</Text>
      <Link href="/" style={{ marginTop: 16 }}>
        <Text style={{ color: colors.accent, fontFamily: fonts.bold, fontSize: 18 }}>Back to the poll</Text>
      </Link>
    </View>
  );
}
