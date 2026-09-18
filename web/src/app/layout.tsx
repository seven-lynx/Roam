// Validate environment variables at startup
import '@/lib/env';

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/components/AuthProvider";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CookieBanner } from "@/components/CookieBanner";
import { WebsiteSchema } from "@/components/JsonLd";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { PageTransition } from "@/components/PageTransition";
import { createClient } from "@/lib/supabase/server";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Roam", template: "%s · Roam" },
  description: "Discover a random corner of the web. Roam is a StumbleUpon-style web discovery engine — browser extension, Android app, and web.",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Anti-FOUC script: prevent theme flash by setting dark class before paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var e=localStorage.getItem("theme");if(e==="dark"||(e!=="light"&&window.matchMedia("(prefers-color-scheme:dark)").matches))document.documentElement.classList.add("dark")}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <WebsiteSchema />
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AuthProvider initialSession={session}>
            <ErrorBoundary>
              {/* Skip to content link for keyboard users (WCAG 2.1 AA) */}
              <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2 focus:bg-white dark:focus:bg-zinc-900 focus:text-zinc-900 dark:focus:text-white focus:rounded-lg focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
              >
                Skip to content
              </a>
              <Header />
              <Suspense><PageTransition /></Suspense>
              <Breadcrumbs />
              <main id="main-content" className="flex-1">
                {children}
              </main>
              <Footer />
              <CookieBanner />
            </ErrorBoundary>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}