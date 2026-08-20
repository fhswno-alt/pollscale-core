import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SignInSheet } from "../src/components/SignInSheet";
import { api } from "../src/lib/api";
import { useSession } from "../src/lib/session";
import type { Person } from "../src/lib/types";
import { colors, fonts, radius } from "../src/theme";

export default function PeopleScreen() {
  const session = useSession();
  const [people, setPeople] = useState<Person[]>([]);
  const [sheet, setSheet] = useState(false);

  const load = () => {
    if (!session.deviceId) return;
    api.people(session.deviceId, session.token).then(setPeople);
  };

  useEffect(load, [session.deviceId, session.token]);

  const toggle = async (person: Person) => {
    if (!session.token) {
      setSheet(true);
      return;
    }
    const updated = await api.followPerson(person.id, session.deviceId, session.token, !person.following);
    setPeople((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Pressable onPress={() => router.back()} style={{ paddingHorizontal: 18, paddingVertical: 10 }}>
        <Text style={{ color: colors.text, fontSize: 28 }}>‹</Text>
      </Pressable>
      <Text
        style={{
          color: colors.text,
          fontFamily: fonts.black,
          fontSize: 40,
          letterSpacing: -1.4,
          paddingHorizontal: 22,
        }}
      >
        People
      </Text>
      <ScrollView contentContainerStyle={{ padding: 22, gap: 10 }}>
        {people.map((person) => (
          <View
            key={person.id}
            style={{
              borderWidth: 1,
              borderColor: colors.hairline,
              borderRadius: radius.card,
              padding: 18,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View>
              <Text style={{ color: colors.text, fontFamily: fonts.bold, fontSize: 18 }}>
                {person.display_name}
              </Text>
              <Text style={{ color: colors.muted, fontFamily: fonts.medium, marginTop: 2 }}>
                @{person.handle}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end", gap: 8 }}>
              <Pressable onPress={() => toggle(person)}>
                <Text
                  style={{
                    color: person.following ? colors.accent : colors.text,
                    fontFamily: fonts.bold,
                  }}
                >
                  {person.following ? "Following" : "Follow"}
                </Text>
              </Pressable>
              {session.token ? (
                <Pressable
                  onPress={async () => {
                    await api.blockPerson(person.id, session.deviceId, session.token!);
                    setPeople((current) => current.filter((item) => item.id !== person.id));
                  }}
                >
                  <Text style={{ color: colors.quiet, fontFamily: fonts.medium }}>Hide</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ))}
      </ScrollView>
      <SignInSheet visible={sheet && !session.token} dimmed />
    </SafeAreaView>
  );
}
