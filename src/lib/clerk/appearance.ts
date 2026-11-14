import type { ClerkProvider } from "@clerk/nextjs";
import type { ComponentProps } from "react";

type Appearance = NonNullable<ComponentProps<typeof ClerkProvider>["appearance"]>;

export const clerkAppearance: Appearance = {
  variables: {
    colorPrimary: "#191816",
    colorBackground: "#FFFFFF",
    colorForeground: "#191816",
    colorMutedForeground: "#73716F",
    colorBorder: "#D5D4D1",
    borderRadius: "0.625rem",
    fontFamily: "Inter, sans-serif",
  },
};
