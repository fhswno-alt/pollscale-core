import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";

type Props = PressableProps & { style?: StyleProp<ViewStyle> };

export const ANDROID_RIPPLE = { color: "rgba(232,255,61,0.22)" };

export function RipplePressable({ style, children, android_ripple, ...props }: Props) {
  return (
    <Pressable
      android_ripple={android_ripple ?? ANDROID_RIPPLE}
      style={({ pressed }) => [style, pressed ? { opacity: 0.88 } : null]}
      {...props}
    >
      {children}
    </Pressable>
  );
}
