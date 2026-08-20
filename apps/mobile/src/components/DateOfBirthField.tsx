import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";

import { colors, fonts, radius } from "../theme";

function toIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromIsoDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return new Date(2000, 0, 1);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function DateOfBirthField({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(Platform.OS === "ios");
  const selected = value ? fromIsoDate(value) : new Date(2000, 0, 1);

  let Picker: typeof import("@react-native-community/datetimepicker").default | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Picker = require("@react-native-community/datetimepicker").default;
  } catch {
    Picker = null;
  }

  if (!Picker) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Date of birth"
        onPress={() => undefined}
        style={field}
      >
        <Text allowFontScaling style={{ color: value ? colors.text : colors.quiet, fontFamily: fonts.bold, fontSize: 20 }}>
          {value || "Birthday"}
        </Text>
      </Pressable>
    );
  }

  return (
    <View>
      {Platform.OS === "android" ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Date of birth"
          onPress={() => setOpen(true)}
          style={field}
        >
          <Text allowFontScaling style={{ color: value ? colors.text : colors.quiet, fontFamily: fonts.bold, fontSize: 20 }}>
            {value || "Choose birthday"}
          </Text>
        </Pressable>
      ) : null}
      {(open || Platform.OS === "ios") && (
        <Picker
          value={selected}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          maximumDate={new Date()}
          minimumDate={new Date(1900, 0, 1)}
          themeVariant="dark"
          onChange={(_, next) => {
            if (Platform.OS === "android") setOpen(false);
            if (next) onChange(toIsoDate(next));
          }}
        />
      )}
    </View>
  );
}

const field = {
  borderWidth: 1,
  borderColor: colors.hairline,
  borderRadius: radius.card,
  padding: 14,
};
