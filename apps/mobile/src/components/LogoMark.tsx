import { View } from "react-native";

import { colors } from "../theme";

export function LogoMark({ size = 18 }: { size?: number }) {
  const w = size * 0.22;
  const gap = size * 0.1;
  return (
    <View style={{ width: size, height: size, flexDirection: "row", alignItems: "flex-end", gap }}>
      <View style={{ width: w, height: size * 0.45, backgroundColor: colors.accent, borderRadius: 2 }} />
      <View style={{ width: w, height: size * 0.7, backgroundColor: colors.accent, borderRadius: 2 }} />
      <View style={{ width: w, height: size, backgroundColor: colors.accent, borderRadius: 2 }} />
    </View>
  );
}
