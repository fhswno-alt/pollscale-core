export const colors = {
  canvas: "#0B0B0C",
  text: "#F3F1E8",
  muted: "#8B8B8F",
  quiet: "#6E6E73",
  hairline: "rgba(243,241,232,0.16)",
  hairlineStrong: "rgba(243,241,232,0.28)",
  accent: "#E8FF3D",
  barLose: "#E8E4D8",
  ink: "#0B0B0C",
  sheet: "#141416",
  chip: "#1A1A1C",
  danger: "#FF8B8B",
};

export const radius = {
  card: 16,
  pill: 999,
  sheet: 28,
};

export const fonts = {
  black: "Archivo_800ExtraBold",
  bold: "Archivo_700Bold",
  medium: "Archivo_500Medium",
  regular: "Archivo_400Regular",
};

/** 4/8 spacing scale. */
export const space = {
  s4: 4,
  s8: 8,
  s12: 12,
  s16: 16,
  s20: 20,
  s24: 24,
  s28: 28,
  s32: 32,
  s40: 40,
  s48: 48,
} as const;

export const type = {
  display: {
    fontFamily: fonts.black,
    fontSize: 40,
    lineHeight: 42,
    letterSpacing: -1.4,
  },
  title: {
    fontFamily: fonts.black,
    fontSize: 28,
    lineHeight: 30,
    letterSpacing: -0.8,
  },
  body: {
    fontFamily: fonts.medium,
    fontSize: 16,
    lineHeight: 22,
  },
  caption: {
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  percent: {
    fontFamily: fonts.black,
    fontSize: 32,
    lineHeight: 34,
    letterSpacing: -1,
  },
} as const;

export const minHit = 44;
