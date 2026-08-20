import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { api } from "../lib/api";
import { useSession } from "../lib/session";
import type { TopicNode } from "../lib/types";
import { colors, fonts, radius } from "../theme";

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
  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState(session.user?.first_name || "");
  const [handle, setHandle] = useState(session.user?.handle_set ? session.user.handle : "");
  const [dob, setDob] = useState("");
  const [city, setCity] = useState("");
  const [tree, setTree] = useState<TopicNode[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session.deviceId || !session.token || session.user?.onboarded_at) return;
    api.taxonomy(session.deviceId).then(setTree).catch(() => undefined);
  }, [session.deviceId, session.token, session.user?.onboarded_at]);

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
      <ScrollView contentContainerStyle={{ padding: 22, paddingTop: 56, paddingBottom: 40 }}>
        <Text style={{ color: colors.text, fontFamily: fonts.black, fontSize: 36, letterSpacing: -1.2 }}>
          {step === 0 ? "Your name" : step === 1 ? "Username" : step === 2 ? "Birthday" : step === 3 ? "City" : "Interests"}
        </Text>
        <Text style={{ color: colors.muted, fontFamily: fonts.medium, marginTop: 8, marginBottom: 18 }}>
          {step === 0
            ? "First name is enough."
            : step === 1
              ? "2–24 letters, numbers, underscore. dave, admin, official and slurs are blocked."
              : step === 2
                ? "You must be 13 or older. YYYY-MM-DD."
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
        {step === 2 ? (
          <TextInput
            value={dob}
            onChangeText={setDob}
            placeholder="2000-04-21"
            placeholderTextColor={colors.quiet}
            keyboardType="numbers-and-punctuation"
            style={field}
          />
        ) : null}
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
                <Pressable
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
                  <Text style={{ color: colors.text, fontFamily: fonts.bold, fontSize: 20 }}>{parent.name}</Text>
                </Pressable>
                {open === parent.id
                  ? parent.children.map((child) => (
                      <Pressable
                        key={child.id}
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
                      </Pressable>
                    ))
                  : null}
              </View>
            ))
          : null}
        {error ? <Text style={{ color: "#FF8B8B", marginTop: 8 }}>{error}</Text> : null}
        <Pressable
          onPress={() => {
            if (step < 4) {
              if (step === 0 && !firstName.trim()) return;
              if (step === 1 && handle.trim().length < 2) return;
              if (step === 2 && dob.trim().length < 8) return;
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
          <Text style={{ color: colors.ink, fontFamily: fonts.bold, fontSize: 16 }}>
            {step < 4 ? "Continue" : `Save · ${parents} topics`}
          </Text>
        </Pressable>
        {step > 0 ? (
          <Pressable onPress={() => setStep(step - 1)} style={{ marginTop: 16, alignItems: "center" }}>
            <Text style={{ color: colors.quiet, fontFamily: fonts.medium }}>Back</Text>
          </Pressable>
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
