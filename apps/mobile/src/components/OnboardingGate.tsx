import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { trackFunnel } from "../lib/analytics";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import type { TopicNode } from "../lib/types";
import { colors, fonts, radius } from "../theme";
import { DateOfBirthField } from "./DateOfBirthField";
import { RipplePressable } from "./RipplePressable";

function parentCount(tree: TopicNode[], selected: Set<string>) {
  let count = 0;
  for (const parent of tree) {
    const childHit = parent.children.some((child) => selected.has(child.id));
    if (selected.has(parent.id) || childHit) count += 1;
  }
  return count;
}

export function OnboardingGate() {
  const session = useSession();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState(session.user?.first_name || "");
  const [handle, setHandle] = useState(session.user?.handle_set ? session.user.handle : "");
  const [dob, setDob] = useState("");
  const [city, setCity] = useState("");
  const [tree, setTree] = useState<TopicNode[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (!session.deviceId || !session.token || session.user?.onboarded_at) return;
    api.taxonomy(session.deviceId).then(setTree).catch(() => undefined);
    if (!started.current) {
      started.current = true;
      trackFunnel("onboarding_started", { userId: session.user?.id, deviceId: session.deviceId });
    }
  }, [session.deviceId, session.token, session.user?.onboarded_at, session.user?.id]);

  const parents = useMemo(() => parentCount(tree, selected), [tree, selected]);

  if (!session.token || !session.user || session.user.onboarded_at) return null;

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async () => {
    setError("");
    try {
      const user = await api.onboard(
        {
          first_name: firstName.trim(),
          handle: handle.trim(),
          date_of_birth: dob.trim(),
          city: city.trim() || null,
          topic_ids: [...selected],
        },
        session.deviceId,
        session.token!,
      );
      session.setUser(user);
      trackFunnel("onboarding_interests", { userId: user.id, deviceId: session.deviceId });
      trackFunnel("onboarding_completed", { userId: user.id, deviceId: session.deviceId });
    } catch (err) {
      const detail = (err as Error).message;
      if (detail === "under_13") setError("You must be 13 or older.");
      else if (detail === "need_three_parent_topics") setError("Pick at least three topics.");
      else if (detail === "reserved_username") setError("That name is reserved.");
      else if (detail === "handle_taken") setError("That username is taken.");
      else setError("Check your name, username, and date of birth.");
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
        backgroundColor: colors.canvas,
      }}
    >
      <ScrollView contentContainerStyle={{ padding: 22, paddingTop: Math.max(insets.top, 24) + 24, paddingBottom: Math.max(insets.bottom, 24) + 16 }}>
        <Text allowFontScaling maxFontSizeMultiplier={1.3} style={{ color: colors.text, fontFamily: fonts.black, fontSize: 36, letterSpacing: -1.2 }}>
          {step === 0 ? "Your name" : step === 1 ? "Username" : step === 2 ? "Birthday" : step === 3 ? "City" : "Interests"}
        </Text>
        <Text allowFontScaling style={{ color: colors.muted, fontFamily: fonts.medium, marginTop: 8, marginBottom: 18 }}>
          {step === 0
            ? "First name is enough."
            : step === 1
              ? "2–24 letters, numbers, underscore. dave, admin, official and slurs are blocked."
              : step === 2
                ? "You must be 13 or older. Use the date picker."
                : step === 3
                  ? "Optional. Only boosts polls actually about that place."
                  : "Pick at least three parent topics. Open one to add subtopics."}
        </Text>
        {step === 0 ? (
          <TextInput
            value={firstName}
            onChangeText={setFirstName}
            placeholder="First name"
            placeholderTextColor={colors.quiet}
            style={field}
          />
        ) : null}
        {step === 1 ? (
          <TextInput
            autoCapitalize="none"
            value={handle}
            onChangeText={setHandle}
            placeholder="yourname"
            placeholderTextColor={colors.quiet}
            style={field}
          />
        ) : null}
        {step === 2 ? <DateOfBirthField value={dob} onChange={setDob} /> : null}
        {step === 3 ? (
          <TextInput
            value={city}
            onChangeText={setCity}
            placeholder="City (optional)"
            placeholderTextColor={colors.quiet}
            style={field}
          />
        ) : null}
        {step === 4
          ? tree.map((parent) => (
              <View key={parent.id} style={{ marginBottom: 12 }}>
                <RipplePressable
                  accessibilityRole="button"
                  accessibilityLabel={parent.name}
                  onPress={() => {
                    toggle(parent.id);
                    setOpen(open === parent.id ? null : parent.id);
                  }}
                  style={{
                    borderWidth: 1,
                    borderColor: selected.has(parent.id) || parent.children.some((c) => selected.has(c.id))
                      ? colors.accent
                      : colors.hairline,
                    borderRadius: radius.card,
                    padding: 16,
                  }}
                >
                  <Text allowFontScaling style={{ color: colors.text, fontFamily: fonts.bold, fontSize: 20 }}>{parent.name}</Text>
                </RipplePressable>
                {open === parent.id
                  ? parent.children.map((child) => (
                      <RipplePressable
                        key={child.id}
                        accessibilityRole="button"
                        accessibilityLabel={child.name}
                        onPress={() => toggle(child.id)}
                        style={{ paddingVertical: 10, paddingLeft: 16 }}
                      >
                        <Text
                          style={{
                            color: selected.has(child.id) ? colors.accent : colors.muted,
                            fontFamily: fonts.medium,
                            fontSize: 16,
                          }}
                        >
                          {child.name}
                        </Text>
                      </RipplePressable>
                    ))
                  : null}
              </View>
            ))
          : null}
        {error ? <Text allowFontScaling style={{ color: "#FF8B8B", marginTop: 8 }}>{error}</Text> : null}
        <RipplePressable
          accessibilityRole="button"
          accessibilityLabel={step < 4 ? "Continue" : "Save interests"}
          onPress={() => {
            if (step < 4) {
              if (step === 0 && !firstName.trim()) return;
              if (step === 1 && handle.trim().length < 2) return;
              if (step === 2 && dob.trim().length < 8) return;
              const who = { userId: session.user?.id, deviceId: session.deviceId };
              if (step === 0) trackFunnel("onboarding_name", who);
              if (step === 1) trackFunnel("onboarding_username", who);
              if (step === 2) trackFunnel("onboarding_dob", who);
              if (step === 3) trackFunnel("onboarding_city", who);
              setStep(step + 1);
              return;
            }
            if (parents < 3) {
              setError("Pick at least three topics.");
              return;
            }
            save();
          }}
          style={{
            marginTop: 20,
            height: 52,
            borderRadius: radius.pill,
            backgroundColor: colors.accent,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text allowFontScaling style={{ color: colors.ink, fontFamily: fonts.bold, fontSize: 16 }}>
            {step < 4 ? "Continue" : `Save · ${parents} topics`}
          </Text>
        </RipplePressable>
        {step > 0 ? (
          <RipplePressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => setStep(step - 1)}
            style={{ marginTop: 16, alignItems: "center" }}
          >
            <Text allowFontScaling style={{ color: colors.quiet, fontFamily: fonts.medium }}>Back</Text>
          </RipplePressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const field = {
  borderWidth: 1,
  borderColor: colors.hairline,
  borderRadius: radius.card,
  color: colors.text,
  fontFamily: fonts.bold,
  fontSize: 20,
  padding: 14,
};
