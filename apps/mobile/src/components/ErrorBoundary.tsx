import { Component, type ErrorInfo, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { captureException } from "../lib/sentry";
import { colors, fonts, radius } from "../theme";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class RootErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    captureException(error, { componentStack: info.componentStack });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.canvas,
          padding: 24,
          justifyContent: "center",
        }}
      >
        <Text
          allowFontScaling
          style={{ color: colors.text, fontFamily: fonts.black, fontSize: 36, letterSpacing: -1.2 }}
        >
          Pollscale hit a snag.
        </Text>
        <Text
          allowFontScaling
          style={{ color: colors.muted, fontFamily: fonts.medium, fontSize: 16, marginTop: 10 }}
        >
          The crash was sent if reporting is on. You can retry without losing your account.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry"
          onPress={() => this.setState({ error: null })}
          android_ripple={{ color: "rgba(11,11,12,0.15)" }}
          style={{
            marginTop: 28,
            height: 56,
            borderRadius: radius.pill,
            backgroundColor: colors.accent,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text allowFontScaling style={{ color: colors.ink, fontFamily: fonts.bold, fontSize: 18 }}>
            Retry
          </Text>
        </Pressable>
      </View>
    );
  }
}
