import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { colors, fonts, radius } from "../theme";

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
      <View style={{ backgroundColor: colors.sheet, padding: 22, borderTopLeftRadius: 28, borderTopRightRadius: 28 }}>
        <Text style={{ color: colors.text, fontFamily: fonts.black, fontSize: 34, letterSpacing: -1.2 }}>
          Pick a username
        </Text>
        <Text style={{ color: colors.muted, fontFamily: fonts.medium, marginTop: 8, marginBottom: 16 }}>
          2–24 letters, numbers, underscore. dave, admin, official and slurs are blocked.
        </Text>
        <TextInput
          autoCapitalize="none"
          value={handle}
          onChangeText={setHandle}
          placeholder="yourname"
          placeholderTextColor={colors.quiet}
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
        {error ? <Text style={{ color: "#FF8B8B", marginTop: 8 }}>{error}</Text> : null}
        <Pressable
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
          <Text style={{ color: colors.ink, fontFamily: fonts.bold, fontSize: 16 }}>Save</Text>
        </Pressable>
      </View>
    </View>
  );
}
