import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SignInSheet } from "../src/components/SignInSheet";
import { TopicChip } from "../src/components/TopicChip";
import { RipplePressable } from "../src/components/RipplePressable";
import { api } from "../src/lib/api";
import { useSession } from "../src/lib/session";
import type { Topic, TopicNode } from "../src/lib/types";
import { colors, fonts, minHit, radius, space, type } from "../src/theme";

type DraftOption = { label: string; image_url: string | null; local?: string };

export default function CreateScreen() {
  const session = useSession();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<DraftOption[]>([
    { label: "", image_url: null },
    { label: "", image_url: null },
  ]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [pickTopic, setPickTopic] = useState(false);
  const [posting, setPosting] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!session.deviceId) return;
    api.taxonomy(session.deviceId).then((nodes: TopicNode[]) => {
      const list: Topic[] = nodes.flatMap((parent) => [
        parent,
        ...parent.children.map((child) => ({ ...child, following: false })),
      ]);
      setTopics(list);
      setTopic((current) => current ?? list.find((item) => item.parent_id) ?? list[0] ?? null);
    });
  }, [session.deviceId, session.token]);

  if (!session.token) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}>
        <SignInSheet visible dimmed={false} />
      </SafeAreaView>
    );
  }

  const versus = options.length === 2;
  const ready =
    question.trim().length >= 4 &&
    options.filter((item) => item.label.trim()).length >= 2 &&
    !!topic &&
    !posting;

  const pickImage = async (index: number) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    const uri = result.assets[0].uri;
    const uploaded = await api.upload(uri, session.deviceId, session.token!);
    setOptions((current) =>
      current.map((item, i) =>
        i === index ? { ...item, image_url: uploaded.url, local: uri } : item,
      ),
    );
  };

  const post = async () => {
    if (!ready || !topic) return;
    setPosting(true);
    try {
      const created = await api.createPoll(
        {
          question: question.trim(),
          topic_id: topic.id,
          options: options
            .filter((item) => item.label.trim())
            .map((item) => ({ label: item.label.trim(), image_url: item.image_url })),
        },
        session.deviceId,
        session.token!,
      );
      if (created.status === "pending_review") {
        setNotice(created.review_message || "We need a human to look at this. We’ll let you know.");
        return;
      }
      router.replace("/");
    } finally {
      setPosting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: space.s16,
            paddingVertical: space.s8,
          }}
        >
          <RipplePressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => router.back()}
            style={{ flexDirection: "row", alignItems: "center", gap: space.s8, minHeight: minHit }}
          >
            <Text style={{ color: colors.text, fontSize: 28, marginTop: -4 }}>‹</Text>
            <Text style={{ color: colors.text, fontFamily: fonts.medium, fontSize: 18 }}>New poll</Text>
          </RipplePressable>
          <RipplePressable
            accessibilityRole="button"
            accessibilityLabel="Post poll"
            onPress={post}
            disabled={!ready}
            style={{
              backgroundColor: ready ? colors.accent : "#3a3a20",
              paddingHorizontal: space.s20,
              height: 44,
              minHeight: minHit,
              borderRadius: radius.pill,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: colors.ink, fontFamily: fonts.bold, fontSize: 15 }}>
              {posting ? "Posting" : "Post"}
            </Text>
          </RipplePressable>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: space.s20, paddingBottom: space.s40 }}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={{
              borderWidth: 1,
              borderColor: colors.hairline,
              borderRadius: radius.card,
              padding: space.s16,
              minHeight: 120,
            }}
          >
            <TextInput
              value={question}
              onChangeText={setQuestion}
              placeholder="Ask something people will actually pick."
              placeholderTextColor={colors.quiet}
              multiline
              style={{
                color: colors.text,
                fontFamily: fonts.black,
                fontSize: 28,
                lineHeight: 32,
                letterSpacing: -0.8,
              }}
            />
          </View>

          {versus ? (
            <View style={{ marginTop: space.s20 }}>
              <Text allowFontScaling style={{ ...type.caption, color: colors.muted, marginBottom: space.s8 }}>
                A vs B
              </Text>
              <View style={{ flexDirection: "row", gap: space.s8 }}>
                {options.map((option, index) => (
                  <VersusWell
                    key={index}
                    option={option}
                    index={index}
                    onPick={() => pickImage(index)}
                    onChangeLabel={(label) =>
                      setOptions((current) => current.map((item, i) => (i === index ? { ...item, label } : item)))
                    }
                  />
                ))}
              </View>
            </View>
          ) : (
            <View style={{ marginTop: space.s20, gap: space.s8 }}>
              {options.map((option, index) => (
                <View
                  key={index}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.hairline,
                    borderRadius: radius.card,
                    minHeight: 80,
                    paddingHorizontal: space.s12,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: space.s12,
                  }}
                >
                  <RipplePressable onPress={() => pickImage(index)} accessibilityLabel={`Add photo ${index + 1}`}>
                    <PhotoWell uri={option.local || option.image_url} size={64} />
                  </RipplePressable>
                  <TextInput
                    value={option.label}
                    onChangeText={(label) =>
                      setOptions((current) => current.map((item, i) => (i === index ? { ...item, label } : item)))
                    }
                    placeholder={`Option ${index + 1}`}
                    placeholderTextColor={colors.quiet}
                    style={{
                      flex: 1,
                      color: colors.text,
                      fontFamily: fonts.bold,
                      fontSize: 18,
                      minHeight: minHit,
                    }}
                  />
                </View>
              ))}
            </View>
          )}

          {options.length < 4 ? (
            <RipplePressable
              accessibilityRole="button"
              accessibilityLabel="Add option"
              onPress={() => setOptions((current) => [...current, { label: "", image_url: null }])}
              style={{
                marginTop: space.s8,
                borderWidth: 1,
                borderStyle: "dashed",
                borderColor: colors.hairline,
                borderRadius: radius.card,
                height: 56,
                minHeight: minHit,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: space.s8,
              }}
            >
              <Text style={{ color: colors.quiet, fontSize: 20 }}>+</Text>
              <Text style={{ color: colors.quiet, fontFamily: fonts.medium, fontSize: 16 }}>Add option</Text>
            </RipplePressable>
          ) : null}

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.s8, marginTop: space.s20, alignItems: "center" }}>
            <RipplePressable
              accessibilityRole="button"
              accessibilityLabel="Topic"
              onPress={() => setPickTopic((value) => !value)}
              style={{
                borderWidth: 1,
                borderColor: colors.hairline,
                borderRadius: 12,
                paddingHorizontal: space.s12,
                height: 40,
                minHeight: 40,
                justifyContent: "center",
              }}
            >
              <Text style={{ color: colors.text, fontFamily: fonts.medium }}>Topic</Text>
            </RipplePressable>
            {topic ? <TopicChip name={topic.name} icon={topic.icon} accent /> : null}
          </View>
          {pickTopic ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.s8, marginTop: space.s12 }}>
              {topics.map((item) => (
                <TopicChip
                  key={item.id}
                  name={item.name}
                  icon={item.icon}
                  accent={topic?.id === item.id}
                  onPress={() => {
                    setTopic(item);
                    setPickTopic(false);
                  }}
                />
              ))}
            </View>
          ) : null}
          <Text style={{ ...type.caption, color: colors.quiet, marginTop: space.s24 }}>
            Two photo wells make the A vs B split on For You. Add more for a stacked poll.
          </Text>
          {notice ? (
            <Text style={{ color: colors.accent, fontFamily: fonts.medium, marginTop: space.s16 }}>{notice}</Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function VersusWell({
  option,
  index,
  onPick,
  onChangeLabel,
}: {
  option: DraftOption;
  index: number;
  onPick: () => void;
  onChangeLabel: (label: string) => void;
}) {
  return (
    <View
      style={{
        flex: 1,
        borderWidth: 1,
        borderColor: colors.hairline,
        borderRadius: radius.card,
        overflow: "hidden",
        backgroundColor: colors.sheet,
      }}
    >
      <RipplePressable accessibilityRole="button" accessibilityLabel={`Photo ${index === 0 ? "A" : "B"}`} onPress={onPick}>
        {option.local || option.image_url ? (
          <Image
            source={{ uri: option.local || option.image_url || undefined }}
            style={{ width: "100%", height: 168 }}
          />
        ) : (
          <View
            style={{
              height: 168,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.chip,
            }}
          >
            <Text style={{ color: colors.quiet, fontFamily: fonts.bold, fontSize: 18 }}>
              {index === 0 ? "A" : "B"}
            </Text>
            <Text style={{ color: colors.quiet, fontFamily: fonts.medium, marginTop: space.s4 }}>Add photo</Text>
          </View>
        )}
      </RipplePressable>
      <TextInput
        value={option.label}
        onChangeText={onChangeLabel}
        placeholder={index === 0 ? "Option A" : "Option B"}
        placeholderTextColor={colors.quiet}
        style={{
          color: colors.text,
          fontFamily: fonts.bold,
          fontSize: 16,
          paddingHorizontal: space.s12,
          paddingVertical: space.s12,
          minHeight: minHit,
        }}
      />
    </View>
  );
}

function PhotoWell({ uri, size }: { uri?: string | null; size: number }) {
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: 12 }} />;
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.hairline,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.chip,
      }}
    >
      <Text style={{ color: colors.quiet, fontSize: 20 }}>+</Text>
    </View>
  );
}
