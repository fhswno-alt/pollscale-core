import { useEffect, useState } from "react";
import { ScrollView, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { GroupedRow, GroupedSection, ScreenBack, ScreenTitle } from "../src/components/GroupedList";
import { RipplePressable } from "../src/components/RipplePressable";
import { SignInSheet } from "../src/components/SignInSheet";
import { api } from "../src/lib/api";
import { useSession } from "../src/lib/session";
import type { Person } from "../src/lib/types";
import { colors, fonts, minHit, space, type } from "../src/theme";

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
      <ScreenBack />
      <ScreenTitle>People</ScreenTitle>
      <ScrollView contentContainerStyle={{ padding: space.s20, gap: space.s20 }}>
        {people.length === 0 ? (
          <Text allowFontScaling style={{ ...type.body, color: colors.muted }}>
            Nobody here yet.
          </Text>
        ) : (
          <GroupedSection>
            {people.map((person, index) => (
              <GroupedRow
                key={person.id}
                label={person.display_name}
                detail={`@${person.handle}`}
                last={index === people.length - 1}
              >
                <RipplePressable
                  accessibilityRole="button"
                  accessibilityLabel={person.following ? "Following" : "Follow"}
                  onPress={() => toggle(person)}
                  style={{ minHeight: minHit, justifyContent: "center" }}
                >
                  <Text
                    allowFontScaling
                    style={{
                      color: person.following ? colors.accent : colors.text,
                      fontFamily: fonts.bold,
                    }}
                  >
                    {person.following ? "Following" : "Follow"}
                  </Text>
                </RipplePressable>
                {session.token ? (
                  <RipplePressable
                    accessibilityRole="button"
                    accessibilityLabel="Hide"
                    onPress={async () => {
                      await api.blockPerson(person.id, session.deviceId, session.token!);
                      setPeople((current) => current.filter((item) => item.id !== person.id));
                    }}
                    style={{ minHeight: minHit, justifyContent: "center" }}
                  >
                    <Text allowFontScaling style={{ color: colors.quiet, fontFamily: fonts.medium }}>
                      Hide
                    </Text>
                  </RipplePressable>
                ) : null}
              </GroupedRow>
            ))}
          </GroupedSection>
        )}
      </ScrollView>
      <SignInSheet visible={sheet && !session.token} dimmed />
    </SafeAreaView>
  );
}
