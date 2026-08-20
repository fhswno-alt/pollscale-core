import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "../src/lib/api";
import { useSession } from "../src/lib/session";
import type { TopicNode } from "../src/lib/types";
import { colors, fonts, radius } from "../src/theme";

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
      <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 40 }}>
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: colors.muted, fontFamily: fonts.medium, marginBottom: 12 }}>Back</Text>
        </Pressable>
        <Text style={{ color: colors.text, fontFamily: fonts.black, fontSize: 36, letterSpacing: -1.2 }}>
          Interests
        </Text>
        <Text style={{ color: colors.muted, fontFamily: fonts.medium, marginTop: 8, marginBottom: 18 }}>
          At least three parent topics. Subtopics are optional.
        </Text>
        {tree.map((parent) => (
          <View key={parent.id} style={{ marginBottom: 12 }}>
            <Pressable
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
                padding: 16,
              }}
            >
              <Text style={{ color: colors.text, fontFamily: fonts.bold, fontSize: 20 }}>{parent.name}</Text>
            </Pressable>
            {open === parent.id
              ? parent.children.map((child) => (
                  <Pressable key={child.id} onPress={() => toggle(child.id)} style={{ paddingVertical: 10, paddingLeft: 16 }}>
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
        ))}
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
      </ScrollView>
    </SafeAreaView>
  );
}
