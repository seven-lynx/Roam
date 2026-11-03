// Shared gamification helpers: award fixed XP through award_xp and re-evaluate
// badges, both best-effort (fire-and-forget). Every primary action funnels
// through the single unified Roam XP path — no inline xp_log writes.

// deno-lint-ignore-file no-explicit-any

/** Best-effort: award fixed XP for `action` (value looked up in xp_actions). */
export async function awardXpBestEffort(
  sb: any,
  userId: string,
  action: string,
  metadata?: Record<string, unknown>,
  idempotencyKey?: string | null,
): Promise<void> {
  try {
    await sb.rpc("award_xp", {
      p_user_id: userId,
      p_action: action,
      p_metadata: metadata ?? {},
      p_idempotency_key: idempotencyKey ?? null,
    });
  } catch (e) {
    console.warn(`[gamification] award_xp(${action}) failed:`, (e as Error)?.message);
  }
}

/** Best-effort: fire the canonical badge evaluator for a user. */
export async function evaluateBadgesBestEffort(sb: any, userId: string): Promise<void> {
  try {
    await sb.functions.invoke("evaluate-badges", { body: { user_id: userId } });
  } catch {
    /* best effort */
  }
}

/** Award fixed XP for an action, then re-evaluate badges. Both best-effort. */
export async function awardXpAndEvaluate(
  sb: any,
  userId: string,
  action: string,
  metadata?: Record<string, unknown>,
  idempotencyKey?: string | null,
): Promise<void> {
  await awardXpBestEffort(sb, userId, action, metadata, idempotencyKey);
  await evaluateBadgesBestEffort(sb, userId);
}
