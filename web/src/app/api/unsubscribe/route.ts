// GET /api/unsubscribe?token=<signed-token>
// Verifies the HMAC token and disables email_notifications for the user.
//
// The token format is: base64(userId.timestamp.hexSignature)
// Signed with HMAC-SHA256 using SUPABASE_SERVICE_ROLE_KEY as secret.
//
// Redirects the user to /settings after processing (success or already
// unsubscribed) or shows an error page for invalid tokens.

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(
      new URL("/settings?error=missing-token", request.url),
    );
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.redirect(
      new URL("/settings?error=server-misconfiguration", request.url),
    );
  }

  try {
    // Decode token: base64(userId.timestamp.signatureHex)
    const decoded = atob(token);
    const parts = decoded.split(".");
    if (parts.length !== 3) throw new Error("Invalid token format");

    const [userId, timestampStr, sigHex] = parts;
    const timestamp = parseInt(timestampStr, 10);

    // Token expires after 90 days
    if (Date.now() - timestamp > 90 * 24 * 60 * 60 * 1000) {
      return NextResponse.redirect(
        new URL("/settings?error=token-expired", request.url),
      );
    }

    // Verify HMAC signature
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(serviceKey),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    const expectedSig = hexToBytes(sigHex);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      expectedSig.buffer as ArrayBuffer,
      encoder.encode(`${userId}.${timestamp}`),
    );

    if (!valid) throw new Error("Invalid signature");

    // Toggle off email_notifications
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) throw new Error("Missing SUPABASE_URL");

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error } = await admin
      .from("user_settings")
      .upsert(
        { user_id: userId, email_notifications: false },
        { onConflict: "user_id" },
      );

    if (error) {
      console.error("[unsubscribe] Failed to update settings:", error.message);
      return NextResponse.redirect(
        new URL("/settings?error=update-failed", request.url),
      );
    }

    return NextResponse.redirect(
      new URL("/settings?unsubscribed=true", request.url),
    );
  } catch (err) {
    console.error("[unsubscribe] Token verification failed:", err);
    return NextResponse.redirect(
      new URL("/settings?error=invalid-token", request.url),
    );
  }
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}