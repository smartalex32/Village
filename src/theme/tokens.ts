import { Platform } from "react-native";

export const colors = {
  canvas: "#F4FAF8",
  surface: "#FFFFFF",
  surfaceMuted: "#EEF5F4",
  forest: "#0D5B4D",
  forestDark: "#083E36",
  mint: "#DDF4EA",
  blue: "#E4F0FF",
  blueText: "#235D9B",
  ink: "#12211F",
  muted: "#60716E",
  line: "#D9E3E1",
  amber: "#FFF2DE",
  amberText: "#8B4C18",
  danger: "#B9433B",
  dangerSoft: "#FDEAE7",
} as const;

export const spacing = { xs: 6, sm: 10, md: 16, lg: 24, xl: 32 } as const;
export const radius = { sm: 10, md: 16, lg: 24, pill: 999 } as const;

export const shadow = Platform.select({
  web: { boxShadow: "0 6px 14px rgba(20, 61, 53, 0.08)" },
  default: {
    shadowColor: "#143D35",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
});
