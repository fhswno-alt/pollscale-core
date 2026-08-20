import { useEffect, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Platform,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { colors } from "../theme";

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  fallbackColor?: string;
  glassEffectStyle?: "clear" | "regular";
};

type GlassViewProps = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  glassEffectStyle?: "clear" | "regular";
  tintColor?: string;
};

type GlassModule = {
  GlassView: (props: GlassViewProps) => ReactNode;
  isGlassEffectAPIAvailable: () => boolean;
};

function loadGlass(): GlassModule | null {
  if (Platform.OS !== "ios") return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-glass-effect") as GlassModule;
  } catch {
    return null;
  }
}

export function GlassSurface({
  children,
  style,
  fallbackColor = colors.sheet,
  glassEffectStyle = "regular",
}: Props) {
  const [reduceTransparency, setReduceTransparency] = useState(false);
  const glass = loadGlass();
  const available = Boolean(glass?.isGlassEffectAPIAvailable?.());

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceTransparencyEnabled?.()
      .then((value) => {
        if (mounted) setReduceTransparency(Boolean(value));
      })
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener?.(
      "reduceTransparencyChanged",
      (value) => setReduceTransparency(Boolean(value)),
    );
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);

  if (!available || reduceTransparency || !glass?.GlassView) {
    return <View style={[style, { backgroundColor: fallbackColor }]}>{children}</View>;
  }

  const NativeGlass = glass.GlassView;
  return (
    <NativeGlass style={style} glassEffectStyle={glassEffectStyle} tintColor={colors.canvas}>
      {children}
    </NativeGlass>
  );
}
