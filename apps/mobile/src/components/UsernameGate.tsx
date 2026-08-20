import { useState } from "react";
import { Text, TextInput } from "react-native";

import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { colors, fonts, radius } from "../theme";
import { RipplePressable } from "./RipplePressable";
import { Sheet } from "./Sheet";

export function UsernameGate() {
  const session = useSession();
  const [handle, setHandle] = useState("");
  const [error, setError] = useState("");
  if (!session.token || !session.user || session.user.handle_set) return null;

  const save = async () => {
    setError("");
    try {
      const user = await api.setHandle(handle.trim(), session.deviceId, session.token!);
      session.setUser(user);
    } catch (err) {
      const detail = (err as Error).message;
      setError(detail === "reserved_username" ? "That name is reserved." : "Pick a different username.");
    }
  };

  return (
    <Sheet>
      <Text
        allowFontScaling
        maxFontSizeMultiplier={1.3}
        style={{ color: colors.text, fontFamily: fonts.black, fontSize: 34, letterSpacing: -1.2 }}
      >
        Pick a username
      </Text>
      <Text allowFontScaling style={{ color: colors.muted, fontFamily: fonts.medium, marginTop: 8, marginBottom: 16 }}>
        2–24 letters, numbers, underscore. dave, admin, official and slurs are blocked.
      </Text>
      <TextInput
        autoCapitalize="none"
        value={handle}
        onChangeText={setHandle}
        placeholder="yourname"
        placeholderTextColor={colors.quiet}
        allowFontScaling
        style={{
          borderWidth: 1,
          borderColor: colors.hairline,
          borderRadius: radius.card,
          color: colors.text,
          fontFamily: fonts.bold,
          fontSize: 20,
          padding: 14,
        }}
      />
      {error ? (
        <Text allowFontScaling style={{ color: "#FF8B8B", marginTop: 8 }}>
          {error}
        </Text>
      ) : null}
      <RipplePressable
        accessibilityRole="button"
        accessibilityLabel="Save username"
        onPress={save}
        style={{
          marginTop: 16,
          height: 52,
          borderRadius: radius.pill,
          backgroundColor: colors.accent,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text allowFontScaling style={{ color: colors.ink, fontFamily: fonts.bold, fontSize: 16 }}>
          Save
        </Text>
      </RipplePressable>
    </Sheet>
  );
}
