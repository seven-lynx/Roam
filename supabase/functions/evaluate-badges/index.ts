// Edge function: Evaluate badges for a user and award any newly earned.
// Replaces the broken SQL evaluate_badges() RPC.
// Call this fire-and-forget from other edge functions after user actions.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  try {
    const { user_id } = await req.json();
    if (!user_id || typeof user_id !== "string") {
      return Response.json({ error: "Missing user_id" }, { status: 400, headers: corsHeaders });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      SERVICE_ROLE_KEY,
      { auth: { persistSession: false } },
    );

    const today = new Date().toISOString().slice(0, 10);

    // ── Collect stats ───────────────────────────────────────────────
    const [roamR, saveR, submitR, approvedR, collR, followerR, followingR, todayR, publicCollsR, profileR] =
      await Promise.all([
        sb.from("seen_urls").select("*", { count: "exact", head: true }).eq("user_id", user_id),
        sb.from("saved_urls").select("*", { count: "exact", head: true }).eq("user_id", user_id),
        sb.from("moderation_queue").select("*", { count: "exact", head: true }).eq("submitted_by", user_id),
        sb.from("moderation_queue").select("*", { count: "exact", head: true }).eq("submitted_by", user_id).eq("status", "approved"),
        sb.from("collections").select("*", { count: "exact", head: true }).eq("user_id", user_id),
        sb.from("follows").select("*", { count: "exact", head: true }).eq("following_id", user_id).eq("is_pending", false),
        sb.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", user_id).eq("is_pending", false),
        sb.from("user_daily_activity").select("*").eq("user_id", user_id).eq("date", today).single(),
        sb.from("collections").select("*", { count: "exact", head: true }).eq("user_id", user_id).eq("is_public", true),
        sb.from("profiles").select("bio,display_name,avatar_url,level,xp_total,streak_days,created_at").eq("id", user_id).single(),
      ]);

    const stats = {
      roam: roamR.count ?? 0, save: saveR.count ?? 0,
      submit: submitR.count ?? 0, approved: approvedR.count ?? 0,
      collections: collR.count ?? 0,
      followers: followerR.count ?? 0, following: followingR.count ?? 0,
      publicColls: publicCollsR.count ?? 0,
      todayRoam: todayR.data?.roam_count ?? 0,
      todaySave: todayR.data?.save_count ?? 0,
      level: profileR.data?.level ?? 1, xp: profileR.data?.xp_total ?? 0,
      streak: profileR.data?.streak_days ?? 0,
      bio: profileR.data?.bio ?? "",
      displayName: profileR.data?.display_name ?? "",
      avatarUrl: profileR.data?.avatar_url ?? "",
      createdAt: profileR.data?.created_at,
    };

    // ── Fetch badges ────────────────────────────────────────────────
    const { data: allBadges } = await sb.from("badges").select("*").eq("is_gift_only", false);
    const badgeMap = new Map<string, any>();
    for (const b of allBadges ?? []) badgeMap.set(b.slug, b);

    // Get already-unlocked
    const { data: existing } = await sb.from("user_badges").select("badge_id").eq("user_id", user_id).not("unlocked_at", "is", null);
    const unlocked = new Set((existing ?? []).map((e: any) => e.badge_id));

    const toAward: any[] = [];

    for (const badge of allBadges ?? []) {
      if (unlocked.has(badge.id)) continue;
      if (badge.is_hidden || badge.category === "gift") continue;
      if (badge.parent_badge_slug) {
        const parentBadge = badgeMap.get(badge.parent_badge_slug);
        if (parentBadge && !unlocked.has(parentBadge.id)) continue;
      }

      // Milestones
      if (badge.category === "milestone") {
        const levels: Record<string, number> = {
          "level-5": 5, "level-10": 10, "level-15": 15, "level-20": 20, "level-25": 25,
          "level-30": 30, "level-40": 40, "level-50": 50, "level-60": 60,
          "level-75": 75, "level-100": 100, "level-125": 125, "level-150": 150,
        };
        if (levels[badge.slug] && stats.level >= levels[badge.slug]) toAward.push(badge);
        if (badge.slug === "xp-millionaire" && stats.xp >= 1000000) toAward.push(badge);
        continue;
      }

      let qualifies = false;
      const req = badge.required_count;

      switch (badge.slug) {
        // ═══ Exploration ═══
        case "first-roam": qualifies = stats.roam >= 1; break;
        case "wanderer-bronze": qualifies = stats.roam >= 10; break;
        case "wanderer-silver": qualifies = stats.roam >= 50; break;
        case "wanderer-gold": qualifies = stats.roam >= 200; break;
        case "nomad-bronze": qualifies = stats.roam >= 500; break;
        case "nomad-silver": qualifies = stats.roam >= 1000; break;
        case "nomad-gold": qualifies = stats.roam >= 5000; break;
        case "nomad-platinum": qualifies = stats.roam >= 10000; break;
        case "curious-george": qualifies = stats.roam >= 5; break;
        case "century-club": qualifies = stats.roam >= 100; break;
        case "the-wanderer": qualifies = stats.roam >= 1000; break;
        case "deep-dive": qualifies = stats.todayRoam >= 30; break;
        case "marathon": qualifies = stats.todayRoam >= 100; break;
        case "roam-marathon": qualifies = stats.todayRoam >= 25; break;
        case "session-beast": qualifies = stats.todayRoam >= 50; break;
        case "speed-demon": qualifies = stats.todayRoam >= 50; break;
        case "speed-reader": qualifies = stats.todayRoam >= 50; break;
        case "session-beast-engagement": qualifies = stats.todayRoam >= 100; break;
        case "session-surfer": qualifies = stats.todayRoam >= 100; break;
        // Exploration with DB queries
        case "night-owl": {
          const { count: c } = await sb.from("seen_urls").select("*", { count: "exact", head: true }).eq("user_id", user_id).gte("seen_at", `${today}T00:00:00`).lt("seen_at", `${today}T04:00:00`);
          qualifies = (c ?? 0) >= 1; break;
        }
        case "early-bird": {
          const { count: c } = await sb.from("seen_urls").select("*", { count: "exact", head: true }).eq("user_id", user_id).gte("seen_at", `${today}T05:00:00`).lt("seen_at", `${today}T08:00:00`);
          qualifies = (c ?? 0) >= 1; break;
        }
        case "globetrotter-bronze": case "globetrotter-silver": case "globetrotter-gold": case "globetrotter-platinum":
          qualifies = false; break; // needs url_id distinct count
        case "category-explorer-bronze": qualifies = stats.roam >= 3; break;
        case "category-explorer-silver": qualifies = stats.roam >= 5; break;
        case "category-explorer-gold": {
          const { count: c } = await sb.from("categories").select("*", { count: "exact", head: true });
          qualifies = stats.roam >= (c ?? 1); break;
        }
        case "repeat-visitor": qualifies = false; break;
        case "monthly-explorer": {
          const { count: c } = await sb.from("user_daily_activity").select("*", { count: "exact", head: true }).eq("user_id", user_id).gt("roam_count", 0);
          qualifies = (c ?? 0) >= 6; break;
        }
        case "daily-double": qualifies = false; break;
        case "lunch-break": {
          const { count: c } = await sb.from("seen_urls").select("*", { count: "exact", head: true }).eq("user_id", user_id).gte("seen_at", today + "T12:00:00").lt("seen_at", today + "T14:00:00");
          qualifies = (c ?? 0) >= 20; break;
        }
        case "insomniac": {
          const { count: c } = await sb.from("seen_urls").select("*", { count: "exact", head: true }).eq("user_id", user_id).gte("seen_at", today + "T00:00:00").lt("seen_at", today + "T04:00:00");
          qualifies = (c ?? 0) >= 100; break;
        }
        case "sunset-seeker": {
          const { count: c } = await sb.from("seen_urls").select("*", { count: "exact", head: true }).eq("user_id", user_id).gte("seen_at", today + "T17:00:00");
          qualifies = (c ?? 0) >= 1; break;
        }
        case "day-tripper": {
          const { count: c } = await sb.from("seen_urls").select("*", { count: "exact", head: true }).eq("user_id", user_id).gte("seen_at", today + "T09:00:00").lt("seen_at", today + "T17:00:00");
          qualifies = (c ?? 0) >= 10; break;
        }
        case "nocturnal": {
          const c1 = await sb.from("seen_urls").select("*", { count: "exact", head: true }).eq("user_id", user_id).gte("seen_at", today + "T22:00:00");
          const c2 = await sb.from("seen_urls").select("*", { count: "exact", head: true }).eq("user_id", user_id).lt("seen_at", today + "T04:00:00");
          qualifies = ((c1.count ?? 0) + (c2.count ?? 0)) >= 20; break;
        }
        case "dawn-patrol": {
          const { count: c } = await sb.from("seen_urls").select("*", { count: "exact", head: true }).eq("user_id", user_id).gte("seen_at", today + "T05:00:00").lt("seen_at", today + "T07:00:00");
          qualifies = (c ?? 0) >= 10; break;
        }
        case "explorer-supreme": {
          const { count: c } = await sb.from("categories").select("*", { count: "exact", head: true });
          qualifies = stats.roam >= (c ?? 1) && stats.todayRoam > 0; break;
        }
        case "domain-hoarder":
        case "pinball-wizard":
        case "jet-setter":
          qualifies = false; break; // needs url_id distinct count

        // ═══ Collecting ═══
        case "first-save": qualifies = stats.save >= 1; break;
        case "collector-bronze": qualifies = stats.save >= 10; break;
        case "collector-silver": qualifies = stats.save >= 50; break;
        case "collector-gold": qualifies = stats.save >= 200; break;
        case "collector-platinum": qualifies = stats.save >= 1000; break;
        case "archivist-bronze": qualifies = stats.save >= 500; break;
        case "archivist-silver": qualifies = stats.save >= 2000; break;
        case "archivist-gold": qualifies = stats.save >= 5000; break;
        case "bookworm": qualifies = stats.save >= 25; break;
        case "minimalist": qualifies = stats.save >= 5; break;
        case "pocket-filler": qualifies = stats.save >= 100; break;
        case "pack-mule": qualifies = stats.save >= 250; break;
        case "hoarder-strikes-back": qualifies = stats.save >= 500; break;
        case "hoarder": qualifies = stats.save >= 100 && stats.collections === 0; break;
        case "speed-collector": qualifies = stats.todaySave >= 10; break;
        case "mega-collector": qualifies = stats.todaySave >= 50; break;

        // P3: tagger badges — count distinct categories in saved_urls
        case "tagger-bronze": {
          const { data: d } = await sb.from("saved_urls").select("url_id, urls!inner(category_id)").eq("user_id", user_id).limit(500);
          const cats = new Set<string>(); for (const r of (d ?? [])) { if ((r.urls as any)?.category_id) cats.add((r.urls as any).category_id); }
          qualifies = cats.size >= 2; break;
        }
        case "tagger-silver": {
          const { data: d } = await sb.from("saved_urls").select("url_id, urls!inner(category_id)").eq("user_id", user_id).limit(2000);
          const cats = new Set<string>(); for (const r of (d ?? [])) { if ((r.urls as any)?.category_id) cats.add((r.urls as any).category_id); }
          qualifies = cats.size >= 5; break;
        }
        case "tagger-gold": {
          const { data: d } = await sb.from("saved_urls").select("url_id, urls!inner(category_id)").eq("user_id", user_id).limit(5000);
          const cats = new Set<string>(); for (const r of (d ?? [])) { if ((r.urls as any)?.category_id) cats.add((r.urls as any).category_id); }
          qualifies = cats.size >= 10; break;
        }
        case "tag-master": {
          const { data: d } = await sb.from("saved_urls").select("url_id, urls!inner(category_id, subcategory_id)").eq("user_id", user_id).limit(5000);
          const subcats = new Set<string>(); for (const r of (d ?? [])) { if ((r.urls as any)?.subcategory_id) subcats.add((r.urls as any).subcategory_id); }
          qualifies = subcats.size >= 5; break;
        }
        case "completionist": {
          const { count: c } = await sb.from("categories").select("*", { count: "exact", head: true });
          qualifies = stats.save >= (c ?? 1); break;
        }
        case "consistent-collector": {
          const { data: d } = await sb.from("user_daily_activity").select("save_count").eq("user_id", user_id).gt("save_count", 0).gte("date", new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)).order("date", { ascending: false }).limit(7);
          qualifies = (d ?? []).length >= 7; break;
        }
        case "weekly-collector": {
          const { data: d } = await sb.from("user_daily_activity").select("save_count").eq("user_id", user_id).gte("save_count", 5).gte("date", new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)).order("date", { ascending: false }).limit(7);
          qualifies = (d ?? []).length >= 7; break;
        }
        case "weekend-hoarder": {
          const dow = new Date().getDay(); const isWeekend = dow === 0 || dow === 6;
          qualifies = isWeekend && stats.todaySave >= 50; break;
        }
        case "language-collector": {
          const { data: d } = await sb.from("saved_urls").select("url_id, urls!inner(language)").eq("user_id", user_id).limit(5000);
          const langs = new Set<string>(); for (const r of (d ?? [])) { if ((r.urls as any)?.language) langs.add((r.urls as any).language); }
          qualifies = langs.size >= 3; break;
        }
        case "long-term-storage": {
          const { data: d } = await sb.from("saved_urls").select("created_at").eq("user_id", user_id).order("created_at", { ascending: true }).limit(1);
          if (d?.length) { const days = (Date.now() - new Date(d[0].created_at).getTime()) / (86400000); qualifies = days >= 90; }
          break;
        }
        case "save-streak": {
          const { data: d } = await sb.from("user_daily_activity").select("save_count").eq("user_id", user_id).gt("save_count", 0).gte("date", new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10)).order("date", { ascending: false }).limit(14);
          qualifies = (d ?? []).length >= 14; break;
        }
        case "collectors-collector":
        case "domain-collector":
          qualifies = false; break; // url_id distinct count
        case "save-wave": {
          const { data: d } = await sb.from("saved_urls").select("id").eq("user_id", user_id).gte("created_at", new Date(Date.now() - 3600000).toISOString());
          qualifies = (d ?? []).length >= 5; break;
        }
        case "year-old": {
          const { data: d } = await sb.from("saved_urls").select("created_at").eq("user_id", user_id).order("created_at", { ascending: true }).limit(1);
          if (d?.length) { const days = (Date.now() - new Date(d[0].created_at).getTime()) / (86400000); qualifies = days >= 365; }
          break;
        }
        case "early-bird-collector": {
          const { count: c } = await sb.from("saved_urls").select("*", { count: "exact", head: true }).eq("user_id", user_id).gte("created_at", today + "T05:00:00").lt("created_at", today + "T08:00:00");
          qualifies = (c ?? 0) >= 1; break;
        }

        // ═══ Curating ═══
        case "first-collection": qualifies = stats.collections >= 1; break;
        case "curator-bronze": qualifies = stats.collections >= 3; break;
        case "curator-silver": qualifies = stats.collections >= 10; break;
        case "curator-gold": qualifies = stats.collections >= 25; break;
        case "curator-supreme": qualifies = stats.collections >= 50; break;
        case "public-curator": qualifies = stats.publicColls >= 5; break;
        // P2: Collection favorites
        case "award-winner": {
          const { data: d } = await sb.from("collection_favorites").select("collection_id, collections!inner(user_id)").eq("collections.user_id", user_id);
          qualifies = (d?.length ?? 0) >= 5; break;
        }
        case "curators-pick": {
          const { data: d } = await sb.from("collection_favorites").select("collection_id, collections!inner(user_id)").eq("collections.user_id", user_id);
          qualifies = (d?.length ?? 0) >= 10; break;
        }
        case "favorited-bronze": {
          const { data: d } = await sb.from("collection_favorites").select("collection_id, collections!inner(user_id)").eq("collections.user_id", user_id);
          qualifies = (d?.length ?? 0) >= 5; break;
        }
        case "favorited-silver": {
          const { data: d } = await sb.from("collection_favorites").select("collection_id, collections!inner(user_id)").eq("collections.user_id", user_id);
          qualifies = (d?.length ?? 0) >= 25; break;
        }
        case "favorited-gold": {
          const { data: d } = await sb.from("collection_favorites").select("collection_id, collections!inner(user_id)").eq("collections.user_id", user_id);
          qualifies = (d?.length ?? 0) >= 100; break;
        }
        // Complex curating badges (keep as-is — too complex for real-time edge fn)
        case "pack-rat-bronze": case "pack-rat-silver": case "pack-rat-gold":
        case "curators-eye": case "niched-down": case "linker":
        case "micro-curator": case "mega-collection": case "solo-artist":
        case "weekly-publisher": case "collection-streak": case "daily-curation":
          qualifies = false; break; // batch repair handles these

        // ═══ Social ═══
        case "social-butterfly-bronze": qualifies = stats.following >= 5; break;
        case "social-butterfly-silver": qualifies = stats.following >= 25; break;
        case "social-butterfly-gold": qualifies = stats.following >= 100; break;
        case "influencer-bronze": qualifies = stats.followers >= 10; break;
        case "influencer-silver": qualifies = stats.followers >= 50; break;
        case "influencer-gold": qualifies = stats.followers >= 200; break;
        case "influencer-platinum": qualifies = stats.followers >= 1000; break;
        case "beloved": qualifies = stats.followers >= 25; break;
        case "celebrity": qualifies = stats.followers >= 500; break;
        case "follower-50": qualifies = stats.followers >= 50; break;
        case "fan-club": qualifies = stats.followers >= 100; break;
        case "follow-frenzy": qualifies = stats.following >= 10; break;
        case "the-lurker": qualifies = stats.followers === 0 && stats.following > 0; break;
        case "profile-perfectionist": case "full-profile":
          qualifies = !!(stats.bio && stats.displayName && stats.avatarUrl); break;
        case "bio-hacker": qualifies = !!stats.bio; break;
        case "name-dropper": qualifies = !!stats.displayName; break;
        case "profile-pic": qualifies = !!stats.avatarUrl; break;
        case "link-in-bio":
          qualifies = !!(stats.bio && stats.displayName && stats.avatarUrl) && stats.collections > 0; break;
        case "public-figure":
          qualifies = stats.followers >= 500 && stats.publicColls >= 5; break;
        case "power-user":
          qualifies = stats.todayRoam > 0 && stats.todaySave > 0 && stats.collections > 0; break;
        case "daily-routine":
          qualifies = stats.todayRoam > 0 && stats.todaySave > 0; break;
        case "friendly-face": {
          const { data: d } = await sb.from("follows").select("follower_id,following_id").eq("follower_id", user_id).eq("is_pending", false).limit(100);
          const following = new Set((d ?? []).map((r: any) => r.following_id));
          const { data: d2 } = await sb.from("follows").select("follower_id").eq("is_pending", false).in("follower_id", [...following]).eq("following_id", user_id);
          qualifies = (d2 ?? []).length >= 1; break;
        }
        case "connector": {
          const { data: d } = await sb.from("follows").select("follower_id,following_id").eq("follower_id", user_id).eq("is_pending", false).limit(100);
          const following = new Set((d ?? []).map((r: any) => r.following_id));
          const { data: d2 } = await sb.from("follows").select("follower_id").eq("is_pending", false).in("follower_id", [...following]).eq("following_id", user_id);
          qualifies = (d2 ?? []).length >= 3; break;
        }
        case "mutual-admiration": {
          const { data: d } = await sb.from("follows").select("follower_id,following_id").eq("follower_id", user_id).eq("is_pending", false).limit(100);
          const following = new Set((d ?? []).map((r: any) => r.following_id));
          const { data: d2 } = await sb.from("follows").select("follower_id").eq("is_pending", false).in("follower_id", [...following]).eq("following_id", user_id);
          qualifies = (d2 ?? []).length >= 5; break;
        }
        case "follow-back": {
          const { data: d } = await sb.from("follows").select("follower_id,following_id").eq("follower_id", user_id).eq("is_pending", false);
          const following = new Set((d ?? []).map((r: any) => r.following_id));
          const { data: d2 } = await sb.from("follows").select("following_id").eq("is_pending", false).eq("follower_id", user_id).in("following_id", [...following]);
          qualifies = (d2 ?? []).length >= 1; break;
        }
        case "two-way-street": {
          const { data: d } = await sb.from("follows").select("follower_id,following_id").eq("follower_id", user_id).eq("is_pending", false).limit(100);
          const following = new Set((d ?? []).map((r: any) => r.following_id));
          const { data: d2 } = await sb.from("follows").select("follower_id").eq("is_pending", false).in("follower_id", [...following]).eq("following_id", user_id);
          qualifies = (d2 ?? []).length >= 2; break;
        }
        case "inner-circle": {
          const { data: d } = await sb.from("follows").select("created_at").eq("follower_id", user_id).eq("is_pending", false).lte("created_at", new Date(Date.now() - 30 * 86400000).toISOString());
          qualifies = (d ?? []).length >= 5; break;
        }
        case "verified-roamer":
          qualifies = !!(stats.bio && stats.displayName && stats.avatarUrl) && stats.streak >= 30; break;
        case "social-network": {
          const { data: d } = await sb.from("follows").select("following_id").eq("follower_id", user_id).eq("is_pending", false).limit(100);
          let net = 0;
          for (const r of (d ?? [])) {
            const { count: c } = await sb.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", r.following_id).eq("is_pending", false);
            if ((c ?? 0) >= 3) net++;
          }
          qualifies = net >= 1; break;
        }

        // ═══ Streaks ═══
        case "hot-streak-bronze": qualifies = stats.streak >= 3; break;
        case "hot-streak-silver": qualifies = stats.streak >= 7; break;
        case "hot-streak-gold": qualifies = stats.streak >= 30; break;
        case "unstoppable": qualifies = stats.streak >= 60; break;
        case "phoenix": qualifies = stats.streak >= 100; break;
        case "double-digits": qualifies = stats.streak >= 10; break;
        case "twenty-one": qualifies = stats.streak >= 21; break;
        case "the-marathon": qualifies = stats.streak >= 42; break;
        case "seasoned": qualifies = stats.streak >= 90; break;
        case "half-year-hero": qualifies = stats.streak >= 180; break;
        case "consistency-king": qualifies = stats.streak >= 200; break;
        case "full-year": qualifies = stats.streak >= 365; break;
        case "early-riser-streak": qualifies = stats.streak >= 7; break;
        case "night-owl-streak": qualifies = stats.streak >= 7; break;
        case "comeback": {
          const { data: d } = await sb.from("user_daily_activity").select("date").eq("user_id", user_id).order("date", { ascending: false }).limit(2);
          if ((d ?? []).length >= 2) {
            const last = new Date(d![0].date); const prev = new Date(d![1].date);
            qualifies = (last.getTime() - prev.getTime()) / (86400000) > 7;
          }
          break;
        }

        // ═══ Contributing ═══
        case "first-submission": qualifies = stats.submit >= 1; break;
        case "contributor-bronze": qualifies = stats.submit >= 5; break;
        case "contributor-silver": qualifies = stats.submit >= 25; break;
        case "contributor-gold": qualifies = stats.submit >= 100; break;
        case "contributor-platinum": qualifies = stats.submit >= 1000; break;
        case "approved-bronze": qualifies = stats.approved >= 5; break;
        case "approved-silver": qualifies = stats.approved >= 25; break;
        case "approved-gold": qualifies = stats.approved >= 100; break;
        case "prolific": qualifies = stats.submit >= 500; break;
        case "100-club": qualifies = stats.submit >= 100; break;
        case "quality-control":
          if (stats.submit >= 10) qualifies = (stats.approved / stats.submit) >= 0.9; break;

        // P3: submission-streak & approval-streak
        case "submission-streak": {
          const { data: d } = await sb.from("moderation_queue").select("created_at").eq("submitted_by", user_id).gte("created_at", new Date(Date.now() - 14 * 86400000).toISOString()).order("created_at", { ascending: false });
          const days = new Set<string>(); for (const r of (d ?? [])) days.add(new Date(r.created_at).toISOString().slice(0, 10));
          qualifies = days.size >= 7; break;
        }
        case "approval-streak": {
          const { data: d } = await sb.from("moderation_queue").select("created_at").eq("submitted_by", user_id).eq("status", "approved").gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString()).order("created_at", { ascending: false });
          const days = new Set<string>(); for (const r of (d ?? [])) days.add(new Date(r.created_at).toISOString().slice(0, 10));
          qualifies = days.size >= 5; break;
        }
        case "weekend-submitter": {
          const { data: d } = await sb.from("moderation_queue").select("created_at").eq("submitted_by", user_id).gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString());
          const weekendSubmits = (d ?? []).filter((r: any) => { const d = new Date(r.created_at).getDay(); return d === 0 || d === 6; }).length;
          qualifies = weekendSubmits >= 3; break;
        }

        // ═══ Engagement (P1: Rating Badges) ═══
        case "rater-bronze": {
          const { count: c } = await sb.from("url_ratings").select("*", { count: "exact", head: true }).eq("user_id", user_id);
          qualifies = (c ?? 0) >= 25; break;
        }
        case "rater-silver": {
          const { count: c } = await sb.from("url_ratings").select("*", { count: "exact", head: true }).eq("user_id", user_id);
          qualifies = (c ?? 0) >= 100; break;
        }
        case "rater-gold": {
          const { count: c } = await sb.from("url_ratings").select("*", { count: "exact", head: true }).eq("user_id", user_id);
          qualifies = (c ?? 0) >= 500; break;
        }
        case "critic": {
          const { count: c } = await sb.from("url_ratings").select("*", { count: "exact", head: true }).eq("user_id", user_id);
          qualifies = (c ?? 0) >= 1000; break;
        }
        case "the-judge": {
          const { count: c } = await sb.from("url_ratings").select("*", { count: "exact", head: true }).eq("user_id", user_id);
          qualifies = (c ?? 0) >= 2000; break;
        }
        case "feedback-loop": {
          const { count: c } = await sb.from("url_ratings").select("*", { count: "exact", head: true }).eq("user_id", user_id).gte("created_at", today + "T00:00:00");
          qualifies = (c ?? 0) >= 10; break;
        }
        case "voting-power": {
          const { count: c } = await sb.from("url_ratings").select("*", { count: "exact", head: true }).eq("user_id", user_id);
          qualifies = (c ?? 0) >= 100; break;
        }
        case "the-equalizer": {
          const { data: d } = await sb.from("url_ratings").select("rating").eq("user_id", user_id);
          const up = (d ?? []).filter((r: any) => r.rating === 1).length;
          const down = (d ?? []).filter((r: any) => r.rating === -1).length;
          qualifies = up >= 10 && down >= 10 && up === down; break;
        }
        case "non-committal": {
          const { count: c } = await sb.from("url_ratings").select("*", { count: "exact", head: true }).eq("user_id", user_id);
          qualifies = stats.roam >= 50 && (c ?? 0) === 0; break;
        }
        case "morning-rater": {
          const { count: c } = await sb.from("url_ratings").select("*", { count: "exact", head: true }).eq("user_id", user_id).gte("created_at", today + "T05:00:00").lt("created_at", today + "T09:00:00");
          qualifies = (c ?? 0) >= 5; break;
        }
        case "rate-streak": {
          const { data: d } = await sb.from("url_ratings").select("created_at").eq("user_id", user_id).order("created_at", { ascending: false }).limit(7);
          const days = new Set<string>(); for (const r of (d ?? [])) days.add(new Date(r.created_at).toISOString().slice(0, 10));
          qualifies = days.size >= 7; break;
        }
        case "rate-by-category": {
          const { data: d } = await sb.from("url_ratings").select("url_id, urls!inner(category_id)").eq("user_id", user_id).gte("created_at", today + "T00:00:00").limit(500);
          const cats = new Set<string>(); for (const r of (d ?? [])) { if ((r.urls as any)?.category_id) cats.add((r.urls as any).category_id); }
          qualifies = cats.size >= 3; break;
        }
        case "downer": {
          const { count: c } = await sb.from("url_ratings").select("*", { count: "exact", head: true }).eq("user_id", user_id).eq("rating", -1).gte("created_at", today + "T00:00:00");
          qualifies = (c ?? 0) >= 10; break;
        }
        case "rate-everything": qualifies = false; break; // complex, batch repair handles
        case "rate-spree": qualifies = false; break; // batch repair handles
        case "the-completionist-rate": qualifies = false; break; // batch repair handles

        // ═══ Secret ═══
        case "error-404-explorer": {
          const { count: c } = await sb.from("log_failed_urls").select("*", { count: "exact", head: true }).eq("user_id", user_id);
          qualifies = (c ?? 0) >= 25; break;
        }

        // Generic count-based fallback
        default:
          if (req !== null && req !== undefined) {
            const prefix = badge.slug.split("-")[0];
            if (["wanderer", "nomad", "first"].includes(prefix)) qualifies = stats.roam >= req;
            else if (["collector", "archivist"].includes(prefix)) qualifies = stats.save >= req;
            else if (prefix === "curator") qualifies = stats.collections >= req;
            else if (prefix === "contributor") qualifies = stats.submit >= req;
            else if (prefix === "approved") qualifies = stats.approved >= req;
            else if (prefix === "social" || prefix === "butterfly") qualifies = stats.following >= req;
            else if (prefix === "influencer") qualifies = stats.followers >= req;
            else if (prefix === "rater" || badge.slug === "critic") {
              // generic rater fallback
            }
          }
      }

      if (qualifies) toAward.push(badge);
    }

    // ── Award badges ────────────────────────────────────────────────
    if (toAward.length > 0) {
      const rows = toAward.map((b: any) => ({
        user_id,
        badge_id: b.id,
        progress_current: 0,
        unlocked_at: new Date().toISOString(),
      }));
      await sb.from("user_badges").upsert(rows, { onConflict: "user_id,badge_id" });

      const xp = toAward.reduce((s: number, b: any) => s + (b.xp_reward ?? 0), 0);
      if (xp > 0) {
        await sb.from("xp_log").insert({
          user_id,
          action: "badge_rewards",
          xp_awarded: xp,
          metadata: { source: "edge_function", badge_count: toAward.length },
        });
        const { data: xpRows } = await sb.from("xp_log").select("xp_awarded").eq("user_id", user_id);
        const newXp = (xpRows ?? []).reduce((s: number, r: any) => s + r.xp_awarded, 0);
        await sb.from("profiles").update({
          xp_total: newXp,
          level: Math.floor(Math.sqrt(newXp / 100)) + 1,
        }).eq("id", user_id);
      }
      try {
        await sb.rpc("sync_profile_badge_count", { p_user_id: user_id });
      } catch { /* sync may fail, badge count will be fixed on next batch repair */ }

      console.log(`Badges awarded to ${user_id}: ${toAward.map((b: any) => b.slug).join(", ")}`);
    }

    // ── Challenge completion check ─────────────────────────────────
    try {
      const now = new Date().toISOString();
      const { data: completableChallenges } = await sb
        .from("user_challenges")
        .select(`
          instance_id, progress_current,
          challenge_instances!inner(id, challenge_id,
            challenges!inner(id, challenge_key, title, xp_reward, goal_count)
          )
        `)
        .eq("user_id", user_id)
        .is("completed_at", null)
        .gte("challenge_instances.expires_at", now);

      if (completableChallenges && completableChallenges.length > 0) {
        for (const uc of completableChallenges) {
          const challenge = uc.challenge_instances?.[0]?.challenges?.[0];
          if (!challenge) continue;
          if ((uc.progress_current ?? 0) >= (challenge.goal_count ?? 999)) {
            // Mark completed
            await sb.from("user_challenges")
              .update({ completed_at: now, completed_xp_awarded: true })
              .eq("user_id", user_id)
              .eq("instance_id", uc.instance_id);

            // Award XP
            const xp = challenge.xp_reward ?? 50;
            await sb.from("xp_log").insert({
              user_id,
              action: "challenge_reward",
              xp_awarded: xp,
              metadata: { challenge_key: challenge.challenge_key, challenge_title: challenge.title },
            });

            // Recalculate total XP + level
            const { data: xpRows } = await sb.from("xp_log").select("xp_awarded").eq("user_id", user_id);
            const newXp = (xpRows ?? []).reduce((s: number, r: any) => s + r.xp_awarded, 0);
            await sb.from("profiles").update({
              xp_total: newXp,
              level: Math.floor(Math.sqrt(newXp / 100)) + 1,
            }).eq("id", user_id);

            // Insert notification
            await sb.from("notifications").insert({
              user_id,
              type: "challenge_complete",
              title: `Challenge Complete: ${challenge.title}!`,
              body: `+${xp} XP earned`,
              data: { challenge_key: challenge.challenge_key, xp },
            });

            console.log(`Challenge completed for ${user_id}: ${challenge.challenge_key}`);
          }
        }
      }
    } catch (e) {
      console.error("challenge completion check failed:", e);
    }

    return Response.json({ awarded: toAward.length, badges: toAward.map((b: any) => b.slug) }, { headers: corsHeaders });
  } catch (e: any) {
    console.error("evaluate-badges error:", e.message);
    return Response.json({ error: e.message }, { status: 500, headers: corsHeaders });
  }
});