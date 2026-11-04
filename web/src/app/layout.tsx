// Validate environment variables at startup
import '@/lib/env';

import type { Metadata, Viewport } from "next";
import { Space_Grotesk, IBM_Plex_Mono, Silkscreen, Caveat } from "next/font/google";
import "./globals.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/components/AuthProvider";
import { WebsiteSchema } from "@/components/JsonLd";
import { createClient } from "@/lib/supabase/server";
import { EmbedGate } from "@/components/EmbedGate";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const silkscreen = Silkscreen({
  variable: "--font-silkscreen",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["500", "700"],
});

export const metadata: Metadata = {
  title: { default: "Roam · Scan the forgotten web", template: "%s · Roam" },
  description: "Roam is a wanderer's workstation for scanning the forgotten web. One press pulls up a random corner of the internet, rated by real people. Browser extension, Android app, and web.",
  icons: {
    icon: [
      { url: "/icon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#07100f",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let session = null;
  try {
    const supabase = await createClient();
    // Use getUser() (server-validated) rather than getSession() (trusts client cookie
    // without re-validating the JWT). Then fetch the session only if the user is real,
    // so AuthProvider starts in the correct state immediately without a loading flash.
    const { data: { user } } = await supabase.auth.getUser();
    session = user
      ? (await supabase.auth.getSession()).data.session
      : null;
  } catch {
    // Supabase unavailable — render without auth state
  }

  return (
    <html
      lang="en"
      className={`dark ${spaceGrotesk.variable} ${ibmPlexMono.variable} ${silkscreen.variable} ${caveat.variable} h-full antialiased`}
    >
      <body className="h-full">
        <WebsiteSchema />
        <AuthProvider initialSession={session}>
          <ErrorBoundary>
            {/* Skip to content link for keyboard users (WCAG 2.1 AA) */}
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2 focus:bg-oxide focus:text-bone focus:border focus:border-line"
            >
              Skip to content
            </a>
            <EmbedGate>{children}</EmbedGate>
          </ErrorBoundary>
        </AuthProvider>
      </body>
    </html>
  );
}