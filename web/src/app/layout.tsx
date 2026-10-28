// Validate environment variables at startup
import '@/lib/env';

import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Mono, Silkscreen, Caveat } from "next/font/google";
import "./globals.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/components/AuthProvider";
import { CookieBanner } from "@/components/CookieBanner";
import { WebsiteSchema } from "@/components/JsonLd";
import { Suspense } from "react";
import Link from "next/link";
import { PageTransition } from "@/components/PageTransition";
import { createClient } from "@/lib/supabase/server";
import { TerminalOverlay } from "@/components/TerminalOverlay";
import { FlashlightCursor } from "@/components/FlashlightCursor";
import { BootSequence } from "@/components/BootSequence";
import { WorkstationShell } from "@/components/WorkstationShell";
import { LeftRail, RightRail } from "@/components/DeskRails";

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
            <WorkstationShell
              rails={
                <>
                  <LeftRail />
                  <RightRail />
                </>
              }
              overlays={
                <>
                  <FlashlightCursor />
                  <TerminalOverlay />
                  <CookieBanner />
                  <BootSequence />
                </>
              }
            >
              <Suspense><PageTransition /></Suspense>
              <main id="main-content" className="min-h-full">
                {children}
              </main>
              <footer className="border-t border-line px-6 py-6 text-center font-mono text-xs text-muted">
                <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                  <Link href="/how-it-works" className="hover:text-ink">How It Works</Link>
                  <Link href="/support-roam" className="hover:text-gold">Support Roam</Link>
                  <Link href="/extensions" className="hover:text-ink">Extensions</Link>
                  <Link href="/android" className="hover:text-ink">Android</Link>
                  <Link href="/stats" className="hover:text-ink">Stats</Link>
                  <Link href="/changelog" className="hover:text-ink">Changelog</Link>
                  <Link href="/privacy" className="hover:text-ink">Privacy</Link>
                  <Link href="/terms" className="hover:text-ink">Terms</Link>
                  <a href="https://github.com/seven-lynx/Roam" target="_blank" rel="noopener noreferrer" className="hover:text-ink">GitHub</a>
                </nav>
              </footer>
            </WorkstationShell>
          </ErrorBoundary>
        </AuthProvider>
      </body>
    </html>
  );
}