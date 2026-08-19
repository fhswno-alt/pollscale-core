import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SignInSheet } from "../src/components/SignInSheet";
import { TopicChip } from "../src/components/TopicChip";
import { api } from "../src/lib/api";
import { useSession } from "../src/lib/session";
import type { Topic } from "../src/lib/types";
import { colors, fonts, radius } from "../src/theme";

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

  useEffect(() => {
    if (!session.deviceId) return;
    api.topics(session.deviceId, session.token).then((list) => {
      setTopics(list);
      setTopic((current) => current ?? list[0] ?? null);
    });
  }, [session.deviceId, session.token]);

  if (!session.token) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}>
        <SignInSheet visible dimmed={false} />
      </SafeAreaView>
    );
  }

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
      await api.createPoll(
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
            paddingHorizontal: 16,
            paddingVertical: 8,
          }}
        >
          <Pressable onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ color: colors.text, fontSize: 28, marginTop: -4 }}>‹</Text>
            <Text style={{ color: colors.text, fontFamily: fonts.medium, fontSize: 18 }}>New poll</Text>
          </Pressable>
          <Pressable
            onPress={post}
            disabled={!ready}
            style={{
              backgroundColor: ready ? colors.accent : "#3a3a20",
              paddingHorizontal: 18,
              height: 36,
              borderRadius: radius.pill,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: colors.ink, fontFamily: fonts.bold, fontSize: 15 }}>
              {posting ? "Posting" : "Post"}
            </Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <View
            style={{
              borderWidth: 1,
              borderColor: colors.hairline,
              borderRadius: radius.card,
              padding: 16,
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

          <View style={{ marginTop: 16, gap: 10 }}>
            {options.map((option, index) => (
              <View
                key={index}
                style={{
                  borderWidth: 1,
                  borderColor: colors.hairline,
                  borderRadius: radius.card,
                  minHeight: 72,
                  paddingHorizontal: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <Pressable onPress={() => pickImage(index)}>
                  {option.local || option.image_url ? (
                    <Image
                      source={{ uri: option.local || option.image_url || undefined }}
                      style={{ width: 48, height: 48, borderRadius: 10 }}
                    />
                  ) : (
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: colors.hairline,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ color: colors.quiet, fontSize: 20 }}>+</Text>
                    </View>
                  )}
                </Pressable>
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
                  }}
                />
              </View>
            ))}
            {options.length < 4 ? (
              <Pressable
                onPress={() => setOptions((current) => [...current, { label: "", image_url: null }])}
                style={{
                  borderWidth: 1,
                  borderStyle: "dashed",
                  borderColor: colors.hairline,
                  borderRadius: radius.card,
                  height: 72,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 8,
                }}
              >
                <Text style={{ color: colors.quiet, fontSize: 20 }}>+</Text>
                <Text style={{ color: colors.quiet, fontFamily: fonts.medium, fontSize: 16 }}>Add option</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 18, alignItems: "center" }}>
            <Pressable
              onPress={() => pickImage(0)}
              style={{
                borderWidth: 1,
                borderColor: colors.hairline,
                borderRadius: 12,
                paddingHorizontal: 12,
                height: 40,
                justifyContent: "center",
              }}
            >
              <Text style={{ color: colors.text, fontFamily: fonts.medium }}>Add photo</Text>
            </Pressable>
            <Pressable
              onPress={() => setPickTopic((value) => !value)}
              style={{
                borderWidth: 1,
                borderColor: colors.hairline,
                borderRadius: 12,
                paddingHorizontal: 12,
                height: 40,
                justifyContent: "center",
              }}
            >
              <Text style={{ color: colors.text, fontFamily: fonts.medium }}>Topic</Text>
            </Pressable>
            {topic ? <TopicChip name={topic.name} icon={topic.icon} accent /> : null}
          </View>
          {pickTopic ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
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
          <Text style={{ color: colors.quiet, fontFamily: fonts.regular, fontSize: 13, marginTop: 22 }}>
            2 to 4 options. Photos optional.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
