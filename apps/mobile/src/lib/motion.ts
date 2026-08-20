import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";
import { Easing } from "react-native-reanimated";

export const motion = {
  duration: {
    snap: 280,
    in: 360,
    hold: 420,
  },
  spring: {
    damping: 30,
    stiffness: 170,
    mass: 0.95,
    overshootClamping: true,
  },
  sheetSpring: {
    damping: 26,
    stiffness: 210,
    mass: 0.88,
    overshootClamping: true,
  },
  easing: Easing.out(Easing.cubic),
};

export function useReduceMotion() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduceMotion(Boolean(value));
      })
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => {
      setReduceMotion(Boolean(value));
    });
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);

  return reduceMotion;
}
