import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { plPL } from "@clerk/localizations";
import { clerkAppearance } from "@/lib/clerk/appearance";
import "@fontsource-variable/inter";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource/geist-mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rhytm",
  description: "Rhytm - organizer życia",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pl" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <ClerkProvider localization={plPL} appearance={clerkAppearance}>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
