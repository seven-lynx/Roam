// Edge function: cron-secret-badges
// Scheduled to run daily. Checks date-based, time-based, and special-condition badges
// that cannot be evaluated during normal user actions.
//
// Deploy: npx supabase functions deploy cron-secret-badges
// Schedule: run once per day via Supabase cron (pg_cron or external trigger)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ── Helpers ──────────────────────────────────────────────────────────
function getDateInET(): Date {
  // Returns current date in America/New_York (ET)
  const now = new Date();
  const etOffset = -4; // EDT (Eastern Daylight Time, UTC-4)
  const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utcMs + (etOffset * 3600000));
}

function isHolidayMatch(date: Date, month: number, day: number): boolean {
  return date.getUTCMonth() === month && date.getUTCDate() === day;
}

function isWeekend(date: Date): boolean {
  const d = date.getUTCDay();
  return d === 0 || d === 6;
}

// ── Holiday badge mapping ────────────────────────────────────────────
const HOLIDAY_MAP: Record<string, { month: number; day: number }> = {
  "new-years-day":       { month: 0, day: 1 },
  "new-years-eve":       { month: 11, day: 31 },
  "valentines-day":      { month: 1, day: 14 },
  "st-patricks-day":     { month: 2, day: 17 },
  "april-fools":         { month: 3, day: 1 },
  "earth-day":           { month: 3, day: 22 },
  "may-the-fourth":      { month: 4, day: 4 },
  "cinco-de-mayo":       { month: 4, day: 5 },
  "independence-day":    { month: 6, day: 4 },
  "halloween":           { month: 9, day: 31 },
  "thanksgiving":        { month: 10, day: 22 }, // Approximate — 4th Thursday of November
  "christmas-day":       { month: 11, day: 25 },
  "pi-day":              { month: 2, day: 14 },
  "remembrance-day":     { month: 10, day: 11 },
  "youth-day":           { month: 5, day: 16 },
  "china-national-day":  { month: 9, day: 1 },
  "mexico-independence": { month: 8, day: 16 },
  "india-independence":  { month: 7, day: 15 },
  "dia-consciencia":     { month: 10, day: 20 },
  "talk-like-pirate":    { month: 8, day: 19 },
};

// ── Solstice/Equinox approximations (2026) ───────────────────────────
function isSolsticeOrEquinox(date: Date): boolean {
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  // 2026 dates: Mar 20 (spring equinox), Jun 21 (summer solstice), Sep 22 (fall equinox), Dec 21 (winter solstice)
  return (m === 2 && d === 20) || (m === 5 && d === 21) || (m === 8 && d === 22) || (m === 11 && d === 21);
}

function isLeapDay(date: Date): boolean {
  const year = date.getUTCFullYear();
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  return isLeap && date.getUTCMonth() === 1 && date.getUTCDate() === 29;
}

function isFriday13th(date: Date): boolean {
  return date.getUTCDay() === 5 && date.getUTCDate() === 13;
}

function isPalindromeDay(date: Date): boolean {
  // e.g., 2026-02-20 => 20260220 is not a palindrome; check dynamically
  const y = String(date.getUTCFullYear()).padStart(4, "0");
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const combined = y + m + d;
  return combined === combined.split("").reverse().join("");
}

function isFirstDayOfSeason(date: Date): boolean {
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  return (m === 2 && d === 20) || (m === 5 && d === 21) || (m === 8 && d === 22) || (m === 11 && d === 21);
}

// ── Main ─────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      SERVICE_ROLE_KEY,
      { auth: { persistSession: false } },
    );

    const today = getDateInET();
    const todayISO = today.toISOString().slice(0, 10);

    console.log(`cron-secret-badges running for ${todayISO}`);

    // ── Determine which holiday badges match today ──────────────────
    const matchingBadges: string[] = [];

    // Check mapped holidays
    for (const [slug, { month, day }] of Object.entries(HOLIDAY_MAP)) {
      if (isHolidayMatch(today, month, day)) {
        matchingBadges.push(slug);
      }
    }

    // Special date-based badges
    if (isFriday13th(today)) matchingBadges.push("friday-13th");
    if (isLeapDay(today)) matchingBadges.push("leap-day");
    if (isSolsticeOrEquinox(today)) matchingBadges.push("solstice-seeker");
    if (isPalindromeDay(today)) matchingBadges.push("palindrome-day");
    if (isFirstDayOfSeason(today)) matchingBadges.push("first-day-of-season");

    // Floating holidays (same date range checks)
    if (today.getUTCMonth() === 3 && today.getUTCDate() >= 5 && today.getUTCDate() <= 11) {
      matchingBadges.push("easter"); // Approximate Easter range
    }
    if (today.getUTCMonth() === 8 && today.getUTCDate() >= 19 && today.getUTCDate() <= 27) {
      matchingBadges.push("oktoberfest"); // Approximate Oktoberfest mid-run
    }
    if (today.getUTCMonth() === 9 || today.getUTCMonth() === 10) {
      matchingBadges.push("diwali"); // Diwali floating (Oct/Nov)
    }
    if (today.getUTCMonth() === 2 && today.getUTCDate() >= 10 && today.getUTCDate() <= 25) {
      matchingBadges.push("ramadan"); // Ramadan range (March 2026)
    }
    if ((today.getUTCMonth() === 0 && today.getUTCDate() >= 21) || (today.getUTCMonth() === 1 && today.getUTCDate() <= 20)) {
      matchingBadges.push("lunar-new-year"); // Approximate Lunar New Year
    }
    if (today.getUTCMonth() === 8 && today.getUTCDate() >= 25 && today.getUTCDate() <= 27) {
      matchingBadges.push("rosh-hashanah"); // Approximate Rosh Hashanah
    }

    // Thanksgiving — 4th Thursday of November
    if (today.getUTCMonth() === 10 && today.getUTCDay() === 4) {
      const weekOfMonth = Math.ceil(today.getUTCDate() / 7);
      if (weekOfMonth === 4) matchingBadges.push("thanksgiving");
    }

    if (matchingBadges.length === 0) {
      console.log("No holiday badges match today.");
    } else {
      console.log(`Matching holiday badges: ${matchingBadges.join(", ")}`);

      // Fetch badge IDs
      const { data: badgeRows } = await sb.from("badges").select("id,slug,xp_reward").in("slug", matchingBadges);
      const badgeMap = new Map<string, { id: string; xp: number }>();
      for (const b of (badgeRows ?? [])) badgeMap.set(b.slug, { id: b.id, xp: b.xp_reward ?? 0 });

      // Fetch all users
      const { data: users } = await sb.from("profiles").select("id, username");
      console.log(`Checking ${users?.length ?? 0} users for holiday badges...`);

      let totalAwarded = 0;

      for (const user of (users ?? [])) {
        // Check which of the matching badges they don't already have
        const { data: existing } = await sb.from("user_badges").select("badge_id").eq("user_id", user.id).not("unlocked_at", "is", null);
        const unlocked = new Set((existing ?? []).map((e: any) => e.badge_id));

        const toAward: any[] = [];
        for (const [slug, badge] of badgeMap) {
          if (!unlocked.has(badge.id)) {
            toAward.push(badge);
          }
        }

        if (toAward.length > 0) {
          const rows = toAward.map((b: any) => ({
            user_id: user.id,
            badge_id: b.id,
            progress_current: 0,
            unlocked_at: new Date().toISOString(),
          }));

          const { error } = await sb.from("user_badges").upsert(rows, { onConflict: "user_id,badge_id" });
          if (!error) {
            const xp = toAward.reduce((s: number, b: any) => s + (b.xp_reward ?? 0), 0);
            if (xp > 0) {
              await sb.from("xp_log").insert({
                user_id: user.id,
                action: "badge_rewards",
                xp_awarded: xp,
                metadata: { source: "cron_secret", badge_count: toAward.length },
              });
              const { data: xpRows } = await sb.from("xp_log").select("xp_awarded").eq("user_id", user.id);
              const newXp = (xpRows ?? []).reduce((s: number, r: any) => s + r.xp_awarded, 0);
              await sb.from("profiles").update({
                xp_total: newXp,
                level: Math.floor(Math.sqrt(newXp / 100)) + 1,
              }).eq("id", user.id);
            }
            try { await sb.rpc("sync_profile_badge_count", { p_user_id: user.id }); } catch {}
          }
          totalAwarded += toAward.length;
        }
      }
      console.log(`Awarded ${totalAwarded} holiday badges total across ${users?.length ?? 0} users.`);
    }

    // ── Check special global badges (non-date) ──────────────────────
    // time-traveler: if user has roamed URLs from >3 different years
    // polyglot: saved URLs in >3 different languages
    // These require per-user queries — expensive for cron, so we skip for now.
    // They're handled by batch repair (repair-badges-v3.mjs) instead.

    // ── Eclipse hunter check ────────────────────────────────────────
    // Next solar eclipse: Aug 12, 2026
    if (today.getUTCMonth() === 7 && today.getUTCDate() === 12) {
      console.log("Solar eclipse today! Awarding eclipse-hunter badge.");
      const { data: eclipseBadge } = await sb.from("badges").select("id,xp_reward").eq("slug", "eclipse-hunter").single();
      if (eclipseBadge) {
        const { data: users } = await sb.from("profiles").select("id");
        for (const user of (users ?? [])) {
          const { data: existing } = await sb.from("user_badges").select("badge_id").eq("user_id", user.id).eq("badge_id", eclipseBadge.id).not("unlocked_at", "is", null);
          if (!existing?.length) {
            await sb.from("user_badges").upsert({
              user_id: user.id,
              badge_id: eclipseBadge.id,
              progress_current: 0,
              unlocked_at: new Date().toISOString(),
            }, { onConflict: "user_id,badge_id" });
            if (eclipseBadge.xp_reward) {
              await sb.from("xp_log").insert({
                user_id: user.id,
                action: "badge_rewards",
                xp_awarded: eclipseBadge.xp_reward,
                metadata: { source: "cron_eclipse" },
              });
            }
            try { await sb.rpc("sync_profile_badge_count", { p_user_id: user.id }); } catch {}
          }
        }
      }
    }

    return Response.json({ success: true, matching_badges: matchingBadges, date: todayISO }, { headers: corsHeaders });
  } catch (e: any) {
    console.error("cron-secret-badges error:", e.message);
    return Response.json({ error: e.message }, { status: 500, headers: corsHeaders });
  }
});