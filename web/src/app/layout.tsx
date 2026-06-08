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
import { WebsiteSchema } from "@/components/StructuredData";
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
  const supabase = await createClient();
  // Use getUser() (server-validated) rather than getSession() (trusts client cookie
  // without re-validating the JWT). Then fetch the session only if the user is real,
  // so AuthProvider starts in the correct state immediately without a loading flash.
  const { data: { user } } = await supabase.auth.getUser();
  const session = user
    ? (await supabase.auth.getSession()).data.session
    : null;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <WebsiteSchema />
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AuthProvider initialSession={session}>
            <ErrorBoundary>
              <Header />
              <main className="flex-1">
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
