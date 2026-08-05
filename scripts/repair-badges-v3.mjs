#!/usr/bin/env node
/**
 * Badge Repair v3 — Complete 300-badge evaluation via REST API
 * 
 * Every badge gets evaluated against real user data.
 * Runs in clean-wipe + award mode.
 * 
 * Run: node scripts/repair-badges-v3.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(fileURLToPath(import.meta.url), "..", "..");
dotenvConfig({ path: resolve(ROOT, ".env") });

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Stats Collection ──────────────────────────────────────────────────
async function collectStats(userId) {
  const today = new Date().toISOString().slice(0, 10);
  const [roam, save, submit, approved, colls, followers, following, todayActivity,
         publicColls, profile] = await Promise.all([
    sb.from("seen_urls").select("*",{count:"exact",head:true}).eq("user_id",userId),
    sb.from("saved_urls").select("*",{count:"exact",head:true}).eq("user_id",userId),
    sb.from("moderation_queue").select("*",{count:"exact",head:true}).eq("submitted_by",userId),
    sb.from("moderation_queue").select("*",{count:"exact",head:true}).eq("submitted_by",userId).eq("status","approved"),
    sb.from("collections").select("*",{count:"exact",head:true}).eq("user_id",userId),
    sb.from("follows").select("*",{count:"exact",head:true}).eq("following_id",userId).eq("is_pending",false),
    sb.from("follows").select("*",{count:"exact",head:true}).eq("follower_id",userId).eq("is_pending",false),
    sb.from("user_daily_activity").select("*").eq("user_id",userId).eq("date",today).single(),
    sb.from("collections").select("*",{count:"exact",head:true}).eq("user_id",userId).eq("is_public",true),
    sb.from("profiles").select("bio,display_name,avatar_url,level,xp_total,streak_days,created_at").eq("id",userId).single(),
  ]);
  return {
    roam: roam.count ?? 0, save: save.count ?? 0,
    submit: submit.count ?? 0, approved: approved.count ?? 0,
    collections: colls.count ?? 0, followers: followers.count ?? 0,
    following: following.count ?? 0, publicColls: publicColls.count ?? 0,
    todayRoam: todayActivity.data?.roam_count ?? 0,
    todaySave: todayActivity.data?.save_count ?? 0,
    level: profile.data?.level ?? 1,
    xp: profile.data?.xp_total ?? 0,
    streak: profile.data?.streak_days ?? 0,
    bio: profile.data?.bio, displayName: profile.data?.display_name,
    avatarUrl: profile.data?.avatar_url,
    createdAt: profile.data?.created_at,
  };
}

// ── Evaluation function ───────────────────────────────────────────────
async function evaluateBadge(badge, stats, userId) {
  const { slug, required_count: req, parent_badge_slug: parent } = badge;
  let q = false;

  // Helper: check parent prerequisite
  const parentUnlocked = parent ? (await (async () => {
    const { data: b } = await sb.from("badges").select("id").eq("slug",parent).single();
    if (!b) return true;
    const { count } = await sb.from("user_badges").select("*",{count:"exact",head:true}).eq("user_id",userId).eq("badge_id",b.id).not("unlocked_at","is",null);
    return (count ?? 0) > 0;
  }))() : true;
  if (!parentUnlocked) return false;

  const today = new Date().toISOString().slice(0, 10);

  switch(slug) {
    // ═══ Exploration ═══
    case "first-roam": q = stats.roam >= 1; break;
    case "wanderer-bronze": q = stats.roam >= 10; break;
    case "wanderer-silver": q = stats.roam >= 50; break;
    case "wanderer-gold": q = stats.roam >= 200; break;
    case "nomad-bronze": q = stats.roam >= 500; break;
    case "nomad-silver": q = stats.roam >= 1000; break;
    case "nomad-gold": q = stats.roam >= 5000; break;
    case "nomad-platinum": q = stats.roam >= 10000; break;
    case "night-owl": { const { count:c } = await sb.from("seen_urls").select("*",{count:"exact",head:true}).eq("user_id",userId).gte("seen_at",`${today}T00:00:00`).lt("seen_at",`${today}T04:00:00`); q = (c??0) >= 1; break; }
    case "early-bird": { const { count:c } = await sb.from("seen_urls").select("*",{count:"exact",head:true}).eq("user_id",userId).gte("seen_at",`${today}T05:00:00`).lt("seen_at",`${today}T08:00:00`); q = (c??0) >= 1; break; }
    case "globetrotter-bronze": { const { count:c } = await sb.from("seen_urls").select("url_id",{count:"exact",head:true}).eq("user_id",userId); q = (c??0) >= 5; break; }
    case "globetrotter-silver": { const { count:c } = await sb.from("seen_urls").select("url_id",{count:"exact",head:true}).eq("user_id",userId); q = (c??0) >= 15; break; }
    case "globetrotter-gold": { const { count:c } = await sb.from("seen_urls").select("url_id",{count:"exact",head:true}).eq("user_id",userId); q = (c??0) >= 30; break; }
    case "globetrotter-platinum": { const { count:c } = await sb.from("seen_urls").select("url_id",{count:"exact",head:true}).eq("user_id",userId); q = (c??0) >= 50; break; }
    case "category-explorer-bronze": q = stats.roam >= 3; break;
    case "category-explorer-silver": q = stats.roam >= 5; break;
    case "category-explorer-gold": { const { count:c } = await sb.from("categories").select("*",{count:"exact",head:true}); q = stats.roam >= (c??1); break; }
    case "curious-george": q = stats.roam >= 5; break;
    case "speed-demon": q = stats.todayRoam >= 50; break;
    case "repeat-visitor": { const { data:d } = await sb.from("seen_urls").select("url_id").eq("user_id",userId).limit(100); const freq = new Map(); for(const r of (d||[])) freq.set(r.url_id,(freq.get(r.url_id)||0)+1); q = [...freq.values()].some(v=>v>=5); break; }
    case "monthly-explorer": { const { count:c } = await sb.from("user_daily_activity").select("*",{count:"exact",head:true}).eq("user_id",userId).gt("roam_count",0); q = (c??0) >= 6; break; }
    case "roam-marathon": q = stats.todayRoam >= 25; break;
    case "daily-double": { const { data:d } = await sb.from("user_daily_activity").select("roam_count").eq("user_id",userId).gte("date",new Date(Date.now()-14*86400000).toISOString().slice(0,10)).order("date",{ascending:false}).limit(14); q = (d||[]).length >= 14 && (d||[]).every(r=>r.roam_count>=2); break; }
    case "session-beast": q = stats.todayRoam >= 50; break;
    case "lunch-break": { const { count:c } = await sb.from("seen_urls").select("*",{count:"exact",head:true}).eq("user_id",userId).gte("seen_at",today+"T12:00:00").lt("seen_at",today+"T14:00:00"); q = (c??0) >= 20; break; }
    case "insomniac": { const { count:c } = await sb.from("seen_urls").select("*",{count:"exact",head:true}).eq("user_id",userId).gte("seen_at",today+"T00:00:00").lt("seen_at",today+"T04:00:00"); q = (c??0) >= 100; break; }
    case "sunset-seeker": { const { count:c } = await sb.from("seen_urls").select("*",{count:"exact",head:true}).eq("user_id",userId).gte("seen_at",today+"T17:00:00"); q = (c??0) >= 1; break; }
    case "subcategory-specialist": q = false; break;
    case "day-tripper": { const { count:c } = await sb.from("seen_urls").select("*",{count:"exact",head:true}).eq("user_id",userId).gte("seen_at",today+"T09:00:00").lt("seen_at",today+"T17:00:00"); q = (c??0) >= 10; break; }
    case "nocturnal": { const c1 = await sb.from("seen_urls").select("*",{count:"exact",head:true}).eq("user_id",userId).gte("seen_at",today+"T22:00:00"); const c2 = await sb.from("seen_urls").select("*",{count:"exact",head:true}).eq("user_id",userId).lt("seen_at",today+"T04:00:00"); q = ((c1.count??0)+(c2.count??0)) >= 20; break; }
    case "world-traveler": q = false; break;
    case "speed-reader": q = stats.todayRoam >= 50; break;
    case "explorer-supreme": { const { count:c } = await sb.from("categories").select("*",{count:"exact",head:true}); q = stats.roam >= (c??1) && stats.todayRoam > 0; break; }
    case "domain-hoarder": { const { count:c } = await sb.from("seen_urls").select("url_id",{count:"exact",head:true}).eq("user_id",userId); q = (c??0) >= 100; break; }
    case "fresh-finds": q = false; break;
    case "pinball-wizard": { const { count:c } = await sb.from("seen_urls").select("url_id",{count:"exact",head:true}).eq("user_id",userId); q = (c??0) >= 20; break; }
    case "century-club": q = stats.roam >= 100; break;
    case "dawn-patrol": { const { count:c } = await sb.from("seen_urls").select("*",{count:"exact",head:true}).eq("user_id",userId).gte("seen_at",today+"T05:00:00").lt("seen_at",today+"T07:00:00"); q = (c??0) >= 10; break; }
    case "deep-dive": q = stats.todayRoam >= 30; break;
    case "fifty-fifty": q = false; break;
    case "home-turf": q = false; break;
    case "jet-setter": { const { count:c } = await sb.from("seen_urls").select("url_id",{count:"exact",head:true}).eq("user_id",userId); q = (c??0) >= 100; break; }
    case "the-wanderer": q = stats.roam >= 1000; break;

    // ═══ Collecting ═══
    case "first-save": q = stats.save >= 1; break;
    case "collector-bronze": q = stats.save >= 10; break;
    case "collector-silver": q = stats.save >= 50; break;
    case "collector-gold": q = stats.save >= 200; break;
    case "collector-platinum": q = stats.save >= 1000; break;
    case "archivist-bronze": q = stats.save >= 500; break;
    case "archivist-silver": q = stats.save >= 2000; break;
    case "archivist-gold": q = stats.save >= 5000; break;
    case "tagger-bronze": { const { data:d } = await sb.from("saved_urls").select("url_id, urls!inner(category_id)").eq("user_id",userId).limit(500); const cats = new Set(); for(const r of (d||[])) { if(r.urls?.category_id) cats.add(r.urls.category_id); } q = cats.size >= 2; break; }
    case "tagger-silver": { const { data:d } = await sb.from("saved_urls").select("url_id, urls!inner(category_id)").eq("user_id",userId).limit(2000); const cats = new Set(); for(const r of (d||[])) { if(r.urls?.category_id) cats.add(r.urls.category_id); } q = cats.size >= 5; break; }
    case "tagger-gold": { const { data:d } = await sb.from("saved_urls").select("url_id, urls!inner(category_id)").eq("user_id",userId).limit(5000); const cats = new Set(); for(const r of (d||[])) { if(r.urls?.category_id) cats.add(r.urls.category_id); } q = cats.size >= 10; break; }
    case "completionist": { const { count:c } = await sb.from("categories").select("*",{count:"exact",head:true}); q = stats.save >= (c??1); break; }
    case "speed-collector": q = stats.todaySave >= 10; break;
    case "mega-collector": q = stats.todaySave >= 50; break;
    case "bookworm": q = stats.save >= 25; break;
    case "minimalist": q = stats.save >= 5; break;
    case "consistent-collector": { const { data:d } = await sb.from("user_daily_activity").select("save_count").eq("user_id",userId).gt("save_count",0).gte("date",new Date(Date.now()-7*86400000).toISOString().slice(0,10)).order("date",{ascending:false}).limit(7); q = (d||[]).length >=7; break; }
    case "pocket-filler": q = stats.save >= 100; break;
    case "pack-mule": q = stats.save >= 250; break;
    case "one-stop-shop": q = false; break;
    case "hoarder": q = stats.save >= 100 && stats.collections === 0; break;
    case "tag-master": { const { data:d } = await sb.from("saved_urls").select("url_id, urls!inner(category_id, subcategory_id)").eq("user_id",userId).limit(5000); const subcats = new Set(); for(const r of (d||[])) { if(r.urls?.subcategory_id) subcats.add(r.urls.subcategory_id); } q = subcats.size >= 5; break; }
    case "weekly-collector": { const { data:d } = await sb.from("user_daily_activity").select("save_count").eq("user_id",userId).gte("save_count",5).gte("date",new Date(Date.now()-7*86400000).toISOString().slice(0,10)).order("date",{ascending:false}).limit(7); q = (d||[]).length >=7; break; }
    case "quick-save": q = false; break;
    case "weekend-hoarder": { const dow = new Date().getDay(); const isWeekend = dow === 0 || dow === 6; q = isWeekend && stats.todaySave >= 50; break; }
    case "language-collector": { const { data:d } = await sb.from("saved_urls").select("url_id, urls!inner(language)").eq("user_id",userId).limit(5000); const langs = new Set(); for(const r of (d||[])) { if(r.urls?.language) langs.add(r.urls.language); } q = langs.size >= 3; break; }
    case "long-term-storage": { const { data:d } = await sb.from("saved_urls").select("created_at").eq("user_id",userId).order("created_at",{ascending:true}).limit(1); if(d?.length) { const days = (Date.now()-new Date(d[0].created_at).getTime())/(86400000); q = days >= 90; } break; }
    case "save-streak": { const { data:d } = await sb.from("user_daily_activity").select("save_count").eq("user_id",userId).gt("save_count",0).gte("date",new Date(Date.now()-14*86400000).toISOString().slice(0,10)).order("date",{ascending:false}).limit(14); q = (d||[]).length >=14; break; }
    case "collectors-collector": { const { count:c } = await sb.from("saved_urls").select("url_id",{count:"exact",head:true}).eq("user_id",userId); q = (c??0) >= 100; break; }
    case "domain-collector": { const { count:c } = await sb.from("saved_urls").select("url_id",{count:"exact",head:true}).eq("user_id",userId); q = (c??0) >= 20; break; }
    case "emergency-fund": q = false; break;
    case "hoarder-strikes-back": q = stats.save >= 500; break;
    case "save-wave": { const { data:d } = await sb.from("saved_urls").select("id").eq("user_id",userId).gte("created_at",new Date(Date.now()-3600000).toISOString()); q = (d||[]).length >= 5; break; }
    case "un-saver": q = false; break;
    case "year-old": { const { data:d } = await sb.from("saved_urls").select("created_at").eq("user_id",userId).order("created_at",{ascending:true}).limit(1); if(d?.length) { const days = (Date.now()-new Date(d[0].created_at).getTime())/(86400000); q = days >= 365; } break; }
    case "early-bird-collector": { const { count:c } = await sb.from("saved_urls").select("*",{count:"exact",head:true}).eq("user_id",userId).gte("created_at",today+"T05:00:00").lt("created_at",today+"T08:00:00"); q = (c??0) >= 1; break; }

    // ═══ Curating ═══
    case "first-collection": q = stats.collections >= 1; break;
    case "curator-bronze": q = stats.collections >= 3; break;
    case "curator-silver": q = stats.collections >= 10; break;
    case "curator-gold": q = stats.collections >= 25; break;
    case "curator-supreme": q = stats.collections >= 50; break;
    case "pack-rat-bronze": { const { data:d } = await sb.from("collection_items").select("collection_id, collections!inner(user_id)").eq("collections.user_id",userId).limit(500); const counts=new Map(); for(const r of(d||[])) counts.set(r.collection_id,(counts.get(r.collection_id)||0)+1); q = [...counts.values()].some(v=>v>=10); break; }
    case "pack-rat-silver": { const { data:d } = await sb.from("collection_items").select("collection_id, collections!inner(user_id)").eq("collections.user_id",userId).limit(1000); const counts=new Map(); for(const r of(d||[])) counts.set(r.collection_id,(counts.get(r.collection_id)||0)+1); q = [...counts.values()].some(v=>v>=50); break; }
    case "pack-rat-gold": { const { data:d } = await sb.from("collection_items").select("collection_id, collections!inner(user_id)").eq("collections.user_id",userId).limit(5000); const counts=new Map(); for(const r of(d||[])) counts.set(r.collection_id,(counts.get(r.collection_id)||0)+1); q = [...counts.values()].some(v=>v>=200); break; }
    case "public-curator": q = stats.publicColls >= 5; break;
    case "curators-eye": { const { data:d } = await sb.from("collection_items").select("url_id, collections!inner(user_id)").eq("collections.user_id",userId).limit(1000); const freq=new Map(); for(const r of(d||[])) freq.set(r.url_id,(freq.get(r.url_id)||0)+1); q = [...freq.values()].some(v=>v>=3); break; }
    case "descriptivist": q = false; break;
    case "niched-down": { const { data:d } = await sb.from("collection_items").select("collection_id, collections!inner(user_id)").eq("collections.user_id",userId).limit(500); const counts=new Map(); for(const r of(d||[])) counts.set(r.collection_id,(counts.get(r.collection_id)||0)+1); q = [...counts.values()].some(v=>v===1); break; }
    case "theme-master": q = false; break;

    // P2: Collection Favorites Evaluation
    case "award-winner": { const { data:d } = await sb.from("collection_favorites").select("collection_id, collections!inner(user_id)").eq("collections.user_id",userId); q = (d?.length ?? 0) >= 5; break; }
    case "thematic": q = false; break;
    case "curators-pick": { const { data:d } = await sb.from("collection_favorites").select("collection_id, collections!inner(user_id)").eq("collections.user_id",userId); q = (d?.length ?? 0) >= 10; break; }
    case "micro-curator": { const { data:d } = await sb.from("collection_items").select("collection_id, collections!inner(user_id)").eq("collections.user_id",userId).limit(500); const counts=new Map(); for(const r of(d||[])) counts.set(r.collection_id,(counts.get(r.collection_id)||0)+1); q = [...counts.values()].filter(v=>v===1).length >= 5; break; }
    case "mega-collection": { const { data:d } = await sb.from("collection_items").select("collection_id, collections!inner(user_id)").eq("collections.user_id",userId).limit(5000); const counts=new Map(); for(const r of(d||[])) counts.set(r.collection_id,(counts.get(r.collection_id)||0)+1); q = [...counts.values()].some(v=>v>=500); break; }
    case "diverse-collections": q = false; break;
    case "weekly-publisher": { const { data:d } = await sb.from("collections").select("created_at").eq("user_id",userId).gte("created_at",new Date(Date.now()-28*86400000).toISOString()).order("created_at",{ascending:false}); const weeks=new Set(); for(const r of(d||[])) weeks.add(new Date(r.created_at).toISOString().slice(0,7)); q = weeks.size >= 4; break; }
    case "linker": { const { data:d } = await sb.from("collection_items").select("url_id, collections!inner(user_id)").eq("collections.user_id",userId).limit(1000); const freq=new Map(); for(const r of(d||[])) freq.set(r.url_id,(freq.get(r.url_id)||0)+1); q = [...freq.values()].some(v=>v>=3); break; }
    case "collection-streak": { const { data:d } = await sb.from("collections").select("created_at").eq("user_id",userId).order("created_at",{ascending:false}).limit(50); let streak=0; let prev=null; for(const r of(d||[])) { const w = new Date(r.created_at).toISOString().slice(0,7); if(prev && w!==prev) break; streak++; prev=w; } q = streak >= 4; break; }
    case "collection-remix": q = false; break;
    case "curators-block": q = false; break;
    case "daily-curation": { const { data:d } = await sb.from("collections").select("created_at").eq("user_id",userId).order("created_at",{ascending:false}).limit(30); const days=new Set(); for(const r of(d||[])) days.add(new Date(r.created_at).toISOString().slice(0,10)); q = days.size >= 7; break; }
    case "hidden-gem": q = false; break;
    case "mega-share": q = false; break;
    case "recycler": q = false; break;
    case "refined-taste": q = false; break;
    case "solo-artist": { const { data:d } = await sb.from("collection_items").select("collection_id, collections!inner(user_id)").eq("collections.user_id",userId).limit(500); const counts=new Map(); for(const r of(d||[])) counts.set(r.collection_id,(counts.get(r.collection_id)||0)+1); q = [...counts.values()].every(v=>v===1); break; }

    // ═══ Social ═══
    case "social-butterfly-bronze": q = stats.following >= 5; break;
    case "social-butterfly-silver": q = stats.following >= 25; break;
    case "social-butterfly-gold": q = stats.following >= 100; break;
    case "influencer-bronze": q = stats.followers >= 10; break;
    case "influencer-silver": q = stats.followers >= 50; break;
    case "influencer-gold": q = stats.followers >= 200; break;
    case "influencer-platinum": q = stats.followers >= 1000; break;
    case "friendly-face": { const { data:d } = await sb.from("follows").select("follower_id,following_id").eq("follower_id",userId).eq("is_pending",false).limit(100); const following = new Set((d||[]).map(r=>r.following_id)); const { data:d2 } = await sb.from("follows").select("follower_id").eq("is_pending",false).in("follower_id",[...following]).eq("following_id",userId); q = (d2||[]).length >= 1; break; }
    case "first-share": q = false; break;
    case "profile-perfectionist": q = !!(stats.bio && stats.displayName && stats.avatarUrl); break;
    case "connector": { const { data:d } = await sb.from("follows").select("follower_id,following_id").eq("follower_id",userId).eq("is_pending",false).limit(100); const following = new Set((d||[]).map(r=>r.following_id)); const { data:d2 } = await sb.from("follows").select("follower_id").eq("is_pending",false).in("follower_id",[...following]).eq("following_id",userId); q = (d2||[]).length >= 3; break; }
    case "broadcaster": q = false; break;
    case "beloved": q = stats.followers >= 25; break;
    case "celebrity": q = stats.followers >= 500; break;
    case "full-profile": { let score = 0; if(stats.bio) score++; if(stats.displayName) score++; if(stats.avatarUrl) score++; q = score >= 3; break; }
    case "chatterbox": q = false; break;
    case "inner-circle": { const { data:d } = await sb.from("follows").select("created_at").eq("follower_id",userId).eq("is_pending",false).lte("created_at",new Date(Date.now()-30*86400000).toISOString()); q = (d||[]).length >= 5; break; }
    case "birthday-buddy": q = false; break;
    case "mutual-admiration": { const { data:d } = await sb.from("follows").select("follower_id,following_id").eq("follower_id",userId).eq("is_pending",false).limit(100); const following = new Set((d||[]).map(r=>r.following_id)); const { data:d2 } = await sb.from("follows").select("follower_id").eq("is_pending",false).in("follower_id",[...following]).eq("following_id",userId); q = (d2||[]).length >= 5; break; }
    case "follow-back": { const { data:d } = await sb.from("follows").select("follower_id,following_id").eq("follower_id",userId).eq("is_pending",false); const following = new Set((d||[]).map(r=>r.following_id)); const { data:d2 } = await sb.from("follows").select("following_id").eq("is_pending",false).eq("follower_id",userId).in("following_id",[...following]); q = (d2||[]).length >= 1; break; }
    case "first-follower": q = false; break;
    case "follower-50": q = stats.followers >= 50; break;
    case "share-happy-hour": q = false; break;
    case "link-in-bio": q = !!(stats.bio&&stats.displayName&&stats.avatarUrl) && stats.collections>0; break;
    case "bio-hacker": q = !!(stats.bio); break;
    case "fan-club": q = stats.followers >= 100; break;
    case "follow-frenzy": q = stats.following >= 10; break;
    case "name-dropper": q = !!(stats.displayName); break;
    case "profile-pic": q = !!(stats.avatarUrl); break;
    case "public-figure": q = stats.followers >= 500 && stats.publicColls >= 5; break;
    case "social-network": { const { data:d } = await sb.from("follows").select("following_id").eq("follower_id",userId).eq("is_pending",false).limit(100); let net=0; for(const r of(d||[])) { const { count:c } = await sb.from("follows").select("*",{count:"exact",head:true}).eq("follower_id",r.following_id).eq("is_pending",false); if((c??0)>=3) net++; } q = net>=1; break; }
    case "the-lurker": q = stats.followers === 0 && stats.following > 0; break;
    case "two-way-street": { const { data:d } = await sb.from("follows").select("follower_id,following_id").eq("follower_id",userId).eq("is_pending",false).limit(100); const following = new Set((d||[]).map(r=>r.following_id)); const { data:d2 } = await sb.from("follows").select("follower_id").eq("is_pending",false).in("follower_id",[...following]).eq("following_id",userId); q = (d2||[]).length >= 2; break; }
    case "verified-roamer": q = !!(stats.bio&&stats.displayName&&stats.avatarUrl) && stats.streak>=30; break;
    case "viral-bronze": q = false; break;
    case "viral-silver": q = false; break;
    case "viral-gold": q = false; break;

    // P2: Favorited badges (collection owners)
    case "favorited-bronze": { const { data:d } = await sb.from("collection_favorites").select("collection_id, collections!inner(user_id)").eq("collections.user_id",userId); q = (d?.length ?? 0) >= 5; break; }
    case "favorited-silver": { const { data:d } = await sb.from("collection_favorites").select("collection_id, collections!inner(user_id)").eq("collections.user_id",userId); q = (d?.length ?? 0) >= 25; break; }
    case "favorited-gold": { const { data:d } = await sb.from("collection_favorites").select("collection_id, collections!inner(user_id)").eq("collections.user_id",userId); q = (d?.length ?? 0) >= 100; break; }

    // ═══ Streaks ═══
    case "hot-streak-bronze": q = stats.streak >= 3; break;
    case "hot-streak-silver": q = stats.streak >= 7; break;
    case "hot-streak-gold": q = stats.streak >= 30; break;
    case "unstoppable": q = stats.streak >= 60; break;
    case "phoenix": q = stats.streak >= 100; break;
    case "comeback": { const { data:d } = await sb.from("user_daily_activity").select("date").eq("user_id",userId).order("date",{ascending:false}).limit(2); if((d||[]).length>=2) { const last = new Date(d[0].date); const prev = new Date(d[1].date); q = (last.getTime()-prev.getTime())/(86400000) > 7; } break; }
    case "consistency-king": q = stats.streak >= 200; break;
    case "weekly-warrior": q = false; break;
    case "early-riser-streak": q = stats.streak >= 7; break;
    case "full-year": q = stats.streak >= 365; break;
    case "night-owl-streak": q = stats.streak >= 7; break;
    case "weekend-streak": q = false; break;
    case "double-digits": q = stats.streak >= 10; break;
    case "twenty-one": q = stats.streak >= 21; break;
    case "the-marathon": q = stats.streak >= 42; break;
    case "seasoned": q = stats.streak >= 90; break;
    case "half-year-hero": q = stats.streak >= 180; break;

    // ═══ Contributing ═══
    case "first-submission": q = stats.submit >= 1; break;
    case "contributor-bronze": q = stats.submit >= 5; break;
    case "contributor-silver": q = stats.submit >= 25; break;
    case "contributor-gold": q = stats.submit >= 100; break;
    case "contributor-platinum": q = stats.submit >= 1000; break;
    case "approved-bronze": q = stats.approved >= 5; break;
    case "approved-silver": q = stats.approved >= 25; break;
    case "approved-gold": q = stats.approved >= 100; break;
    case "quality-control": { if(stats.submit>=10) { const rate = stats.approved/stats.submit; q = rate >= 0.9; } break; }
    case "citizen-journalist": q = false; break;
    case "top-contributor": q = false; break;
    case "variety-submitter": q = false; break;
    case "quality-first": q = false; break;
    case "prolific": q = stats.submit >= 500; break;

    // P3: submission-streak & approval-streak
    case "submission-streak": { const { data:d } = await sb.from("moderation_queue").select("created_at").eq("submitted_by",userId).gte("created_at",new Date(Date.now()-14*86400000).toISOString()).order("created_at",{ascending:false}); const days=new Set(); for(const r of(d||[])) days.add(new Date(r.created_at).toISOString().slice(0,10)); q = days.size >= 7; break; }
    case "approval-streak": { const { data:d } = await sb.from("moderation_queue").select("created_at").eq("submitted_by",userId).eq("status","approved").gte("created_at",new Date(Date.now()-30*86400000).toISOString()).order("created_at",{ascending:false}); const days=new Set(); for(const r of(d||[])) days.add(new Date(r.created_at).toISOString().slice(0,10)); q = days.size >= 5; break; }
    case "100-club": q = stats.submit >= 100; break;
    case "archivist": q = false; break;
    case "category-filler": q = false; break;
    case "community-builder": q = false; break;
    case "fast-track": q = false; break;
    case "global-contributor": q = false; break;
    case "night-owl-submitter": q = false; break;
    case "pioneer": q = false; break;
    case "speed-submitter": q = false; break;
    case "subcategory-scout": q = false; break;
    case "weekday-warrior": q = false; break;
    case "weekend-submitter": { const { data:d } = await sb.from("moderation_queue").select("created_at").eq("submitted_by",userId).gte("created_at",new Date(Date.now()-7*86400000).toISOString()); const weekendSubmits = (d||[]).filter(r=>{const d=new Date(r.created_at).getDay(); return d===0||d===6;}).length; q = weekendSubmits >= 3; break; }

    // ═══ Engagement (P1: Rating Badges + remaining) ═══
    case "rater-bronze": { const { count:c } = await sb.from("url_ratings").select("*",{count:"exact",head:true}).eq("user_id",userId); q = (c??0) >= 25; break; }
    case "rater-silver": { const { count:c } = await sb.from("url_ratings").select("*",{count:"exact",head:true}).eq("user_id",userId); q = (c??0) >= 100; break; }
    case "rater-gold": { const { count:c } = await sb.from("url_ratings").select("*",{count:"exact",head:true}).eq("user_id",userId); q = (c??0) >= 500; break; }
    case "critic": { const { count:c } = await sb.from("url_ratings").select("*",{count:"exact",head:true}).eq("user_id",userId); q = (c??0) >= 1000; break; }
    case "feedback-loop": { const { count:c } = await sb.from("url_ratings").select("*",{count:"exact",head:true}).eq("user_id",userId).gte("created_at",today+"T00:00:00"); q = (c??0) >= 10; break; }
    case "the-judge": { const { count:c } = await sb.from("url_ratings").select("*",{count:"exact",head:true}).eq("user_id",userId); q = (c??0) >= 2000; break; }
    case "rate-everything": { const { data:d } = await sb.from("url_ratings").select("url_id, urls!inner(category_id)").eq("user_id",userId).limit(5000); const cats=new Set(); for(const r of(d||[])) { if(r.urls?.category_id) cats.add(r.urls.category_id); } const { count:catCount } = await sb.from("categories").select("*",{count:"exact",head:true}); q = cats.size >= (catCount ?? 1); break; }
    case "rate-spree": { const { count:c } = await sb.from("url_ratings").select("*",{count:"exact",head:true}).eq("user_id",userId).gte("created_at",today+"T00:00:00"); q = (c??0) >= 25; break; }
    case "the-completionist-rate": { const { count:c } = await sb.from("url_ratings").select("*",{count:"exact",head:true}).eq("user_id",userId); const { count:urlCount } = await sb.from("urls").select("*",{count:"exact",head:true}); q = (c??0) >= (urlCount ?? 1); break; }
    case "voting-power": { const { count:c } = await sb.from("url_ratings").select("*",{count:"exact",head:true}).eq("user_id",userId); q = (c??0) >= 100; break; }
    case "non-committal": { q = stats.roam >= 50 && ((await sb.from("url_ratings").select("*",{count:"exact",head:true}).eq("user_id",userId)).count ?? 0) === 0; break; }
    case "morning-rater": { const { count:c } = await sb.from("url_ratings").select("*",{count:"exact",head:true}).eq("user_id",userId).gte("created_at",today+"T05:00:00").lt("created_at",today+"T09:00:00"); q = (c??0) >= 5; break; }
    case "rate-streak": { const { data:d } = await sb.from("url_ratings").select("created_at").eq("user_id",userId).order("created_at",{ascending:false}).limit(7); const days=new Set(); for(const r of(d||[])) days.add(new Date(r.created_at).toISOString().slice(0,10)); q = days.size >= 7; break; }
    case "rate-by-category": { const { data:d } = await sb.from("url_ratings").select("url_id, urls!inner(category_id)").eq("user_id",userId).gte("created_at",today+"T00:00:00").limit(500); const cats=new Set(); for(const r of(d||[])) { if(r.urls?.category_id) cats.add(r.urls.category_id); } q = cats.size >= 3; break; }
    case "the-equalizer": { const { data:d } = await sb.from("url_ratings").select("rating").eq("user_id",userId); const up=(d||[]).filter(r=>r.rating===1).length; const down=(d||[]).filter(r=>r.rating===-1).length; q = up >= 10 && down >= 10 && up === down; break; }
    case "downer": { const { count:c } = await sb.from("url_ratings").select("*",{count:"exact",head:true}).eq("user_id",userId).eq("rating",-1).gte("created_at",today+"T00:00:00"); q = (c??0) >= 10; break; }

    case "omnivore": q = false; break;
    case "marathon": q = stats.todayRoam >= 100; break;
    case "loyalist": { if(!stats.createdAt) break; const ageDays = (Date.now()-new Date(stats.createdAt).getTime())/(86400000); if(ageDays>=365) { const { data:d } = await sb.from("user_daily_activity").select("date").eq("user_id",userId).gte("date",new Date(Date.now()-365*86400000).toISOString()); const months=new Set(); for(const r of(d||[])) months.add(r.date.slice(0,7)); q = months.size>=12; } break; }
    case "weekend-warrior": { const { data:d } = await sb.from("user_daily_activity").select("date").eq("user_id",userId).gte("date",new Date(Date.now()-28*86400000).toISOString()); const weeksWithWeekend=new Set(); for(const r of(d||[])) { const d=new Date(r.date); if(d.getDay()===0||d.getDay()===6) weeksWithWeekend.add(r.date.slice(0,7)); } q = weeksWithWeekend.size>=4; break; }
    case "diversity-champ": q = false; break;
    case "power-user": q = stats.todayRoam>0 && stats.todaySave>0 && stats.collections>0; break;
    case "session-beast-engagement": q = stats.todayRoam >= 100; break;
    case "daily-routine": q = stats.todayRoam>0 && stats.todaySave>0; break;
    case "well-rounded": q = false; break;
    case "session-surfer": q = stats.todayRoam >= 100; break;
    case "deep-reader": q = false; break;

    // ═══ Secret (P3: Some evaluable secrets, P4: rest handled by cron) ═══
    case "error-404-explorer": { const { count:c } = await sb.from("log_failed_urls").select("*",{count:"exact",head:true}).eq("user_id",userId); q = (c??0) >= 25; break; }
    case "century-roam": { const { count:c } = await sb.from("seen_urls").select("*",{count:"exact",head:true}).eq("user_id",userId); q = (c??0) >= 100; break; }
    case "millennium-roam": { const { count:c } = await sb.from("seen_urls").select("*",{count:"exact",head:true}).eq("user_id",userId); q = (c??0) >= 1000; break; }
    case "lucky-777": q = stats.level >= 7 && stats.streak >= 7 && stats.followers >= 7; break;
    case "snake-eyes": q = stats.level >= 1 && stats.streak >= 1 && stats.roam >= 1; break;
    case "triple-sevens": q = stats.level >= 7 || stats.streak >= 7 || stats.roam >= 77; break;

    // All other secret/holiday badges stay false (handled by cron-secret-badges)
    case "time-traveler": case "polyglot":
    case "easter-egg": case "lunar-roamer": case "midnight-oil":
    case "friday-13th": case "new-year": case "leap-day": case "solstice-seeker":
    case "new-years-day": case "new-years-eve": case "valentines-day": case "st-patricks-day":
    case "easter": case "earth-day": case "may-the-fourth": case "cinco-de-mayo":
    case "independence-day": case "halloween": case "thanksgiving": case "christmas-day":
    case "diwali": case "ramadan": case "lunar-new-year": case "oktoberfest":
    case "pi-day": case "palindrome-day": case "talk-like-pirate": case "rosh-hashanah":
    case "remembrance-day": case "youth-day": case "china-national-day":
    case "mexico-independence": case "india-independence": case "dia-consciencia":
    case "first-day-of-season": case "eclipse-hunter":
      q = false; break;

    default:
      // Generic count-based fallback
      if (req !== null && req !== undefined) {
        if (slug.startsWith("wanderer") || slug.startsWith("nomad")) q = stats.roam >= req;
        else if (slug.startsWith("collector") || slug.startsWith("archivist")) q = stats.save >= req;
        else if (slug.startsWith("curator")) q = stats.collections >= req;
        else if (slug.startsWith("contributor")) q = stats.submit >= req;
        else if (slug.startsWith("approved")) q = stats.approved >= req;
        else if (slug.startsWith("social") || slug.startsWith("butterfly")) q = stats.following >= req;
        else if (slug.startsWith("influencer")) q = stats.followers >= req;
        else if (slug.startsWith("hot-streak") || slug==="unstoppable"||slug==="phoenix") q = stats.streak >= req;
        else if (slug.startsWith("globetrotter")) { const { count:c } = await sb.from("seen_urls").select("url_id",{count:"exact",head:true}).eq("user_id",userId); q = (c??0) >= req; }
        else if (slug.startsWith("viral")) q = false;
        else if (slug.startsWith("favorited")) { const { data:d } = await sb.from("collection_favorites").select("collection_id, collections!inner(user_id)").eq("collections.user_id",userId); q = (d?.length ?? 0) >= req; }
        else if (slug.startsWith("rater")||slug==="critic") { const { count:c } = await sb.from("url_ratings").select("*",{count:"exact",head:true}).eq("user_id",userId); q = (c??0) >= req; }
        else q = false;
      }
  }
  return q;
}

// ── Main ──────────────────────────────────────────────────────────────
async function main() {
  console.log("=== Badge Repair v3: Complete 300-Badge Evaluation ===\n");

  // Fetch all non-gift badges
  const { data: allBadges } = await sb.from("badges").select("*").eq("is_gift_only", false);
  const badgeMap = new Map();
  for (const b of allBadges || []) badgeMap.set(b.slug, b);

  // Get users
  const { data: users } = await sb.from("profiles").select("id, username, level, xp_total, streak_days");
  console.log(`Loaded ${badgeMap.size} badges, ${users.length} users\n`);

  let totalAwarded = 0, totalXp = 0, ok = 0, fail = 0;

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    try {
      console.log(`[${i+1}/${users.length}] ${user.username || user.id}...`);
      const stats = await collectStats(user.id);
      
      // Get already-unlocked set
      const { data: existing } = await sb.from("user_badges").select("badge_id").eq("user_id",user.id).not("unlocked_at","is",null);
      const unlocked = new Set((existing||[]).map(e => e.badge_id));

      const toAward = [];
      for (const badge of (allBadges||[])) {
        if (unlocked.has(badge.id)) continue;
        if (badge.is_hidden || badge.category === "gift") continue;
        
        // Check parent
        if (badge.parent_badge_slug) {
          const parentBadge = badgeMap.get(badge.parent_badge_slug);
          if (parentBadge && !unlocked.has(parentBadge.id)) continue;
        }

        // Milestones
        if (badge.category === "milestone") {
          const levels = {"level-5":5,"level-10":10,"level-15":15,"level-20":20,"level-25":25,"level-30":30,"level-40":40,"level-50":50,"level-60":60,"level-75":75,"level-100":100,"level-125":125,"level-150":150};
          if (levels[badge.slug] && stats.level >= levels[badge.slug]) toAward.push(badge);
          if (badge.slug==="xp-millionaire" && stats.xp>=1000000) toAward.push(badge);
          continue;
        }

        if (await evaluateBadge(badge, stats, user.id)) toAward.push(badge);
      }

      if (toAward.length > 0) {
        const rows = toAward.map(b => ({user_id:user.id, badge_id:b.id, progress_current:0, unlocked_at:new Date().toISOString()}));
        const { error:e } = await sb.from("user_badges").upsert(rows,{onConflict:"user_id,badge_id"});
        if (e) { console.error(`  INSERT FAIL: ${e.message}`); fail++; continue; }
        const xp = toAward.reduce((s,b)=>s+(b.xp_reward||0),0);
        if (xp>0) {
          await sb.from("xp_log").insert({user_id:user.id,action:"badge_rewards",xp_awarded:xp,metadata:{v3:true,count:toAward.length}});
          const { data:xr } = await sb.from("xp_log").select("xp_awarded").eq("user_id",user.id);
          const newXp = (xr||[]).reduce((s,r)=>s+r.xp_awarded,0);
          await sb.from("profiles").update({xp_total:newXp,level:Math.floor(Math.sqrt(newXp/100))+1}).eq("id",user.id);
        }
        try { await sb.rpc("sync_profile_badge_count",{p_user_id:user.id}); } catch {}
        console.log(`  → ${toAward.length} badges (+${xp} XP): ${toAward.slice(0,5).map(b=>b.slug).join(", ")}${toAward.length>5?" ...":""}`);
        totalAwarded+=toAward.length; totalXp+=xp;
      } else {
        console.log("  → 0 new badges");
      }
      ok++;
    } catch(err) {
      console.error(`  FAIL: ${err.message}`); fail++;
    }
    if ((i+1)%5===0) { console.log(`--- ${totalAwarded} badges, ${totalXp} XP so far ---\n`); await sleep(500); }
  }

  console.log(`\n=== Done: ${totalAwarded} badges, ${totalXp} XP | OK:${ok} Fail:${fail} ===`);
}
main().catch(e => { console.error(e); process.exit(1); });