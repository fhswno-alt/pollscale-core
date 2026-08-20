import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenBack, ScreenTitle } from "../src/components/GroupedList";
import { RipplePressable } from "../src/components/RipplePressable";
import { api } from "../src/lib/api";
import { useSession } from "../src/lib/session";
import type { TopicNode } from "../src/lib/types";
import { colors, fonts, minHit, radius, space, type } from "../src/theme";

function parentCount(tree: TopicNode[], selected: Set<string>) {
  let count = 0;
  for (const parent of tree) {
    if (selected.has(parent.id) || parent.children.some((child) => selected.has(child.id))) count += 1;
  }
  return count;
}

export default function InterestsScreen() {
  const session = useSession();
  const [tree, setTree] = useState<TopicNode[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session.deviceId) return;
    api.taxonomy(session.deviceId).then((nodes) => {
      setTree(nodes);
      setSelected(new Set((session.user?.interests || []).map((item) => item.id)));
    });
  }, [session.deviceId, session.user?.interests]);

  const parents = useMemo(() => parentCount(tree, selected), [tree, selected]);

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async () => {
    if (!session.token) return;
    if (parents < 3) {
      setError("Pick at least three topics.");
      return;
    }
    const user = await api.setInterests([...selected], session.deviceId, session.token);
    session.setUser(user);
    router.back();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScrollView contentContainerStyle={{ paddingBottom: space.s40 }}>
        <ScreenBack />
        <ScreenTitle>Interests</ScreenTitle>
        <Text
          allowFontScaling
          style={{ ...type.body, color: colors.muted, paddingHorizontal: space.s20, marginTop: space.s8, marginBottom: space.s20 }}
        >
          At least three parent topics. Subtopics are optional.
        </Text>
        <View style={{ paddingHorizontal: space.s20 }}>
          {tree.map((parent) => (
            <View key={parent.id} style={{ marginBottom: space.s12 }}>
              <RipplePressable
                accessibilityRole="button"
                accessibilityLabel={parent.name}
                onPress={() => {
                  toggle(parent.id);
                  setOpen(open === parent.id ? null : parent.id);
                }}
                style={{
                  borderWidth: 1,
                  borderColor:
                    selected.has(parent.id) || parent.children.some((child) => selected.has(child.id))
                      ? colors.accent
                      : colors.hairline,
                  borderRadius: radius.card,
                  padding: space.s16,
                  minHeight: minHit,
                  justifyContent: "center",
                }}
              >
                <Text allowFontScaling style={{ color: colors.text, fontFamily: fonts.bold, fontSize: 20 }}>
                  {parent.name}
                </Text>
              </RipplePressable>
              {open === parent.id
                ? parent.children.map((child) => (
                    <RipplePressable
                      key={child.id}
                      accessibilityRole="button"
                      accessibilityLabel={child.name}
                      onPress={() => toggle(child.id)}
                      style={{ paddingVertical: space.s12, paddingLeft: space.s16, minHeight: minHit, justifyContent: "center" }}
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
          ))}
          {error ? (
            <Text allowFontScaling style={{ color: colors.danger, marginTop: space.s8 }}>
              {error}
            </Text>
          ) : null}
          <RipplePressable
            accessibilityRole="button"
            accessibilityLabel="Save interests"
            onPress={save}
            style={{
              marginTop: space.s16,
              height: 56,
              minHeight: minHit,
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
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
