// popup.ts — Roam extension popup entry point

import '../lib/sentry'; // must be first — initialises Sentry if SENTRY_DSN is set
import { Sentry } from '../lib/sentry';
import { sendToBackground } from '../lib/messages';
import { BUILD_VERSION, isStaleWorker } from '../lib/version';
import { UNKNOWN_MESSAGE_ERROR } from '../lib/dispatch-report';
import type { StateData, RoamData, RoamExhaustion, CheckUrlData, Collection, CategoryItem, ProfileData, SubcategoryItem, SavedUrlItem, ChallengeData, BadgeData, NotificationItem, ProfileStatsData, UserSettingsData, FollowUser, ActivityItem, MyProfileData } from '../lib/messages';
import { FALLBACK_CATEGORIES, LANGUAGES, DEFAULT_LANGUAGE } from '../lib/constants';
import { notificationLink, notificationText, recentCelebration } from '../lib/notifications';
import { activityLink, activityText, relativeTime } from '../lib/social';
import { validatePassword } from '../lib/validate';
import { describeExhaustion } from '../lib/exhaustion';
import {
  applyTheme,
  resolveFx,
  resolveTheme,
  DEFAULT_UI_FX,
  DEFAULT_UI_THEME,
  FLICKER_KEY,
  FX_KEY,
  STATIC_KEY,
  THEME_KEY,
} from '../lib/ui-theme';
import type { UiFx, UiTheme } from '../lib/ui-theme';

// ── Global error capture ───────────────────────────────────────────────────
window.addEventListener('unhandledrejection', (event) => {
  Sentry.captureException(
    event.reason ?? new Error('Unhandled promise rejection'),
    { tags: { context: 'popup-unhandledrejection' } }
  );
});
window.addEventListener('error', (event) => {
  Sentry.captureException(
    event.error ?? new Error(event.message || 'Unknown popup error'),
    { tags: { context: 'popup-error' } }
  );
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function el<T extends HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Element #${id} not found`);
  return e as T;
}

type AppState = 'signedout' | 'auth' | 'email-auth' | 'categories' | 'error' | 'noresults' | 'main' | 'feedback' | 'saved' | 'notifications' | 'history' | 'challenges' | 'badges' | 'collections' | 'community' | 'profile';

const ALL_STATES: AppState[] = ['signedout', 'auth', 'email-auth', 'categories', 'error', 'noresults', 'main', 'feedback', 'saved', 'notifications', 'history', 'challenges', 'badges', 'collections', 'community', 'profile'];

// ROAM-OS status-bar labels — short and upper-case, the way the OS shell reads.
const STATE_TITLES: Record<AppState, string> = {
  signedout: 'NO SESSION',
  auth: 'SIGN IN',
  'email-auth': 'SIGN IN',
  categories: 'CATEGORIES',
  error: 'SIGNAL LOST',
  noresults: 'END OF LINE',
  main: 'DISCOVER',
  feedback: 'FEEDBACK',
  saved: 'SAVED',
  notifications: 'NOTIFICATIONS',
  history: 'HISTORY',
  challenges: 'CHALLENGES',
  badges: 'BADGES',
  collections: 'COLLECTIONS',
  community: 'COMMUNITY',
  profile: 'YOU',
};

function showState(name: AppState) {
  for (const s of ALL_STATES) {
    el(`state-${s}`).hidden = s !== name;
  }
  // The OS bar names the screen you're on, as the web shell does.
  const title = document.getElementById('os-title');
  if (title) title.textContent = STATE_TITLES[name];
}

/**
 * The noresults panel, explained (issue #120). A dry feed has three different
 * causes and only the empty-pool one is fixed by adding categories, so the copy
 * swaps and the button hides when the advice would not help. Without a reason -
 * an older server - the shipped copy stands.
 */
function showNoResults(exhaustion: RoamExhaustion | null) {
  const copy = describeExhaustion(exhaustion);
  const panel = document.getElementById('state-noresults');
  const msg = panel?.querySelector('.error-msg');
  const sub = panel?.querySelector('.error-sub');
  if (msg) msg.textContent = copy.title;
  if (sub) sub.textContent = copy.sub;
  el<HTMLButtonElement>('btn-add-categories').hidden = !copy.showCategories;
  showState('noresults');
}

// ── Appearance (ROAM-OS theme + CRT layers) ───────────────────────────────────
// Popup-only. The overlay in popup.html is the only place these effects paint —
// nothing here reaches the page the user is browsing.
let uiTheme: UiTheme = DEFAULT_UI_THEME;
let uiFx: UiFx = DEFAULT_UI_FX;

function paintAppearance(): void {
  applyTheme(uiTheme, uiFx, document.documentElement);
  el<HTMLInputElement>('toggle-roam-os').checked = uiTheme === 'roam_os';
  el<HTMLInputElement>('toggle-crt').checked = uiFx.effects;
  el<HTMLInputElement>('toggle-crt-static').checked = uiFx.crtStatic;
  el<HTMLInputElement>('toggle-crt-flicker').checked = uiFx.flicker;
  // The animated layers hang off the master switch: dim and disable them rather
  // than letting them sit in a state that paints nothing.
  const masterOff = !uiFx.effects;
  for (const id of ['toggle-crt-static', 'toggle-crt-flicker']) {
    el<HTMLInputElement>(id).disabled = masterOff;
    el(id).closest('.panel-row')?.classList.toggle('panel-row--muted', masterOff);
  }
}

async function initAppearance(): Promise<void> {
  try {
    // popup.html already ships data-theme="roam-os", so this read can only
    // downgrade to Classic — the one case that repaints after first paint.
    const stored = await chrome.storage.local.get([THEME_KEY, FX_KEY, STATIC_KEY, FLICKER_KEY]);
    uiTheme = resolveTheme(stored[THEME_KEY]);
    uiFx = resolveFx(stored);
  } catch { /* keep the defaults */ }
  paintAppearance();

  el('toggle-roam-os').addEventListener('change', () => {
    uiTheme = el<HTMLInputElement>('toggle-roam-os').checked ? 'roam_os' : 'classic';
    paintAppearance();
    void chrome.storage.local.set({ [THEME_KEY]: uiTheme });
  });
  el('toggle-crt').addEventListener('change', () => {
    uiFx = { ...uiFx, effects: el<HTMLInputElement>('toggle-crt').checked };
    paintAppearance();
    void chrome.storage.local.set({ [FX_KEY]: uiFx.effects });
  });
  el('toggle-crt-static').addEventListener('change', () => {
    uiFx = { ...uiFx, crtStatic: el<HTMLInputElement>('toggle-crt-static').checked };
    paintAppearance();
    void chrome.storage.local.set({ [STATIC_KEY]: uiFx.crtStatic });
  });
  el('toggle-crt-flicker').addEventListener('change', () => {
    uiFx = { ...uiFx, flicker: el<HTMLInputElement>('toggle-crt-flicker').checked };
    paintAppearance();
    void chrome.storage.local.set({ [FLICKER_KEY]: uiFx.flicker });
  });

  el('btn-os-close').addEventListener('click', () => window.close());
}

function flashButton(id: string, type: 'up' | 'down'): Promise<void> {
  return new Promise<void>(resolve => {
    const btn = el(id);
    const cls = type === 'up' ? 'btn-icon--flash-up' : 'btn-icon--flash-down';
    btn.classList.add(cls);
    btn.addEventListener('animationend', () => { btn.classList.remove(cls); resolve(); }, { once: true });
  });
}

function showPanel(name: 'submit' | 'config' | null) {
  el('panel-submit').hidden = name !== 'submit';
  el('panel-config').hidden = name !== 'config';
  el<HTMLButtonElement>('btn-config').setAttribute(
    'aria-expanded',
    name === 'config' ? 'true' : 'false'
  );
}

function showToast(message: string) {
  const t = el('toast');
  t.textContent = message;
  t.hidden = false;
  // Re-trigger animation
  t.classList.remove('toast');
  void t.offsetWidth;
  t.classList.add('toast');
  setTimeout(() => { t.hidden = true; }, 2000);
}

/**
 * Warns when the worker answering this popup came from an older build. The popup
 * document reloads from disk on every open; an MV3 service worker can outlive a
 * rebuild and keep answering from the previous bundle, which is how a stale worker
 * used to turn into a generic "something went wrong" with no explanation (issue #105).
 */
function reportVersionSkew(workerVersion: string | undefined): void {
  if (!isStaleWorker(workerVersion)) return;
  Sentry.captureMessage(
    `[popup] worker ${workerVersion ?? 'pre-handshake'} answered popup ${BUILD_VERSION}`,
    { level: 'warning', tags: { context: 'version-skew' }, extra: { workerVersion, popupVersion: BUILD_VERSION } }
  );
  showToast(UNKNOWN_MESSAGE_ERROR);
}

/** Decrements the unread-count chip after a single notification is read/deleted. */
function decrementUnreadChip() {
  const chip = el('notif-count-chip');
  const remaining = Number(chip.textContent || '0');
  if (remaining > 1) {
    chip.textContent = String(remaining - 1);
  } else {
    chip.hidden = true;
  }
}

function showError(message: string, operation?: string) {
  const prefix = operation ? `[${operation}] ` : '';
  const span = document.querySelector<HTMLElement>('#state-error .error-msg');
  if (span) span.textContent = prefix + message;
  Sentry.captureMessage(`popup error [${operation || 'unknown'}]: ${message}`, {
    level: 'warning',
    tags: { context: 'showError' },
    extra: { operation: operation || 'unknown' },
  });
  showState('error');
}

function showDropdown(
  anchor: HTMLElement,
  items: { label: string; onPick: () => void; className?: string }[],
  footer?: HTMLElement
): void {
  const menu = document.createElement('div');
  menu.style.cssText = `
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    z-index: 1000;
    max-height: 240px;
    overflow-y: auto;
  `;
  items.forEach(({ label, onPick, className }) => {
    const option = document.createElement('button');
    option.style.cssText = `
      width: 100%;
      padding: 8px 10px;
      border: none;
      background: transparent;
      color: var(--text);
      text-align: left;
      cursor: pointer;
      font-size: 13px;
    `;
    if (className) option.className = className;
    option.textContent = label;
    option.addEventListener('click', () => { menu.remove(); onPick(); });
    option.addEventListener('mouseover', () => { option.style.background = 'var(--bg-hover)'; });
    option.addEventListener('mouseout', () => { option.style.background = 'transparent'; });
    menu.appendChild(option);
  });
  if (footer) {
    const divider = document.createElement('div');
    divider.style.cssText = 'height: 1px; background: var(--border); margin: 4px 0;';
    menu.appendChild(divider);
    menu.appendChild(footer);
  }
  const rect = anchor.getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.top = `${rect.bottom + 4}px`;
  menu.style.left = `${rect.left}px`;
  menu.style.width = `${rect.width}px`;
  document.body.appendChild(menu);
  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target as Node) && e.target !== anchor) menu.remove();
  }, { once: true });
}

// Context for categories screen
let categoriesContext: 'firsttime' | 'settings' = 'firsttime';
let loadedCategories: CategoryItem[] = [];
let loadedSubcategories: SubcategoryItem[] = [];
let currentInterestMode: 'pillars' | 'topics' = 'pillars';

// Focus mode
let focusModeEnabled = false;
let focusCategoryId: string | null = null;
let focusSubcategoryId: string | null = null;
let focusSubcategoryName: string | null = null;

function setStatus(text: string): void {
  const bar = el('status-bar');
  bar.textContent = text;
  bar.hidden = false;
}

async function refreshStatus(): Promise<void> {
  let modeLabel: string;
  if (focusModeEnabled) {
    const catName = loadedCategories.find(c => c.id === focusCategoryId)?.name ?? 'Focus';
    modeLabel = focusSubcategoryName ? `🎯 ${catName} · ${focusSubcategoryName}` : `🎯 ${catName}`;
  } else {
    modeLabel = '🔍 Discover';
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url ?? '';
  if (!url) { setStatus(modeLabel); return; }
  const check = await sendToBackground<CheckUrlData>({ type: 'CHECK_URL', url });
  if (!check.ok || !check.data.category_id) { setStatus(modeLabel); return; }
  const cat = loadedCategories.find(c => c.id === check.data.category_id);
  if (!cat) { setStatus(modeLabel); return; }
  setStatus(`${cat.icon} ${cat.name}  ·  ${modeLabel}`);
}

async function checkAndRouteAfterSignIn(): Promise<void> {
  const [interests, allCats, allSubcats] = await Promise.all([
    sendToBackground<{ mode: 'pillars' | 'topics'; pillarIds: string[]; topicIds: string[] }>({ type: 'GET_USER_INTERESTS' }),
    sendToBackground<CategoryItem[]>({ type: 'GET_CATEGORIES' }),
    sendToBackground<SubcategoryItem[]>({ type: 'GET_ALL_SUBCATEGORIES' }),
  ]);
  const categoryItems = allCats.ok && allCats.data.length > 0 ? allCats.data : FALLBACK_CATEGORIES;
  loadedCategories = categoryItems;
  if (allSubcats.ok) loadedSubcategories = allSubcats.data;

  if (interests.ok && (interests.data.pillarIds.length > 0 || interests.data.topicIds.length > 0)) {
    currentInterestMode = interests.data.mode;
    populateInterestChips(interests.data.mode, interests.data.pillarIds, interests.data.topicIds, categoryItems, loadedSubcategories);
    showState('main');
    void refreshStatus();
    // Load "You" section data lazily
    void loadYouSection();
  } else {
    categoriesContext = 'firsttime';
    currentInterestMode = 'pillars';
    populateInterestChips('pillars', [], [], categoryItems, loadedSubcategories);
    el('btn-back-categories').hidden = true;
    showState('categories');
  }
}

function setInterestModeUI(mode: 'pillars' | 'topics') {
  currentInterestMode = mode;
  el('btn-mode-pillars').classList.toggle('mode-btn--active', mode === 'pillars');
  el('btn-mode-topics').classList.toggle('mode-btn--active', mode === 'topics');
}

function populateInterestChips(
  mode: 'pillars' | 'topics',
  selectedPillarIds: string[],
  selectedTopicIds: string[],
  categories: CategoryItem[],
  subcategories: SubcategoryItem[],
) {
  setInterestModeUI(mode);
  const container = el('category-select-chips');
  while (container.firstChild) container.removeChild(container.firstChild);

  if (mode === 'pillars') {
    for (const cat of categories) {
      const btn = document.createElement('button');
      btn.className = 'chip' + (selectedPillarIds.includes(cat.id) ? ' selected' : '');
      btn.dataset.catId = cat.id;
      btn.textContent = `${cat.icon} ${cat.name}`;
      container.appendChild(btn);
    }
  } else {
    const byCat = new Map<string, SubcategoryItem[]>();
    for (const sc of subcategories) {
      if (!byCat.has(sc.category_id)) byCat.set(sc.category_id, []);
      byCat.get(sc.category_id)!.push(sc);
    }
    for (const cat of categories) {
      const subs = byCat.get(cat.id);
      if (!subs || subs.length === 0) continue;
      const header = document.createElement('p');
      header.className = 'topic-group-header';
      header.textContent = `${cat.icon} ${cat.name}`;
      container.appendChild(header);
      for (const sc of subs) {
        const btn = document.createElement('button');
        btn.className = 'chip' + (selectedTopicIds.includes(sc.id) ? ' selected' : '');
        btn.dataset.subcatId = sc.id;
        btn.textContent = sc.name;
        container.appendChild(btn);
      }
    }
  }

  const anySelected = mode === 'pillars'
    ? selectedPillarIds.length > 0
    : selectedTopicIds.length > 0;
  const saveBtn = document.getElementById('btn-save-categories') as HTMLButtonElement | null;
  if (saveBtn) saveBtn.disabled = !anySelected;
  updateCategoryScope();
}

/** Shows how wide the current selection is — the narrowing used to be invisible. */
function updateCategoryScope(): void {
  const chips = Array.from(
    el('category-select-chips').querySelectorAll<HTMLButtonElement>('.chip'),
  );
  const selected = chips.filter((c) => c.classList.contains('selected')).length;
  const noun = currentInterestMode === 'pillars' ? 'categories' : 'topics';
  el('categories-scope').textContent = `${selected} of ${chips.length} ${noun} selected`;
  const selectAllBtn = el<HTMLButtonElement>('btn-select-all-categories');
  selectAllBtn.textContent = `Select all ${noun}`;
  selectAllBtn.hidden = selected >= chips.length || chips.length === 0;
}

/** @deprecated Use populateInterestChips instead */
function populateCategoryChips(selectedIds: string[], categories: CategoryItem[]) {
  populateInterestChips('pillars', selectedIds, [], categories, []);
}

// ── "You" section — notifications, badges, stats ──────────────────────────────
async function loadYouSection() {
  // Notifications count (unread only)
  sendToBackground<number>({ type: 'GET_UNREAD_COUNT' }).then(res => {
    if (res.ok && res.data > 0) {
      const chip = el('notif-count-chip');
      chip.textContent = String(res.data);
      chip.hidden = false;
    }
  });
  // Badges count — unlocked only, matching the gallery header
  sendToBackground<BadgeData[]>({ type: 'GET_BADGES' }).then(res => {
    if (!res.ok) return;
    const unlocked = res.data.filter((b) => b.is_unlocked).length;
    if (unlocked > 0) {
      const chip = el('badge-count-chip');
      chip.textContent = String(unlocked);
      chip.hidden = false;
    }
  });
  // Challenges count — active (incomplete) only
  sendToBackground<ChallengeData[]>({ type: 'GET_CHALLENGES' }).then(res => {
    if (!res.ok) return;
    const active = res.data.filter((c) => !c.completed_at).length;
    if (active > 0) {
      const chip = el('challenge-count-chip');
      chip.textContent = String(active);
      chip.hidden = false;
    }
  });
  // Gamification + counters
  sendToBackground<ProfileStatsData>({ type: 'GET_PROFILE_STATS' }).then(res => {
    if (!res.ok) return;
    el('stat-level').textContent = String(res.data.level ?? 1);
    el('stat-xp').textContent = String(res.data.xp_total ?? 0);
    el('stat-roamed').textContent = String(res.data.roamed ?? 0);
    el('stat-submitted').textContent = String(res.data.submitted ?? 0);
    el('stat-streak').textContent = String(res.data.streak_days ?? 0);
    el('stats-row').hidden = false;
  });
  // Surface an unlock that landed while the popup was closed — the popup shuts
  // immediately after a rating, so this is the only place a celebration shows.
  sendToBackground<NotificationItem[]>({ type: 'GET_NOTIFICATIONS' }).then(res => {
    if (!res.ok) return;
    const item = recentCelebration(res.data, Date.now());
    if (!item) return;
    showToast(`🏅 ${notificationText(item).title}`);
  });
  void hydratePreferences();
}

function renderLanguageChips(selected: string[]): void {
  const container = el('language-chips');
  container.textContent = '';
  for (const lang of LANGUAGES) {
    const btn = document.createElement('button');
    const isEnglish = lang.code === DEFAULT_LANGUAGE;
    btn.className = 'chip' + (selected.includes(lang.code) ? ' selected' : '') + (isEnglish ? ' chip--locked' : '');
    btn.dataset.lang = lang.code;
    btn.textContent = lang.label;
    // English is always included by the backend language filter.
    btn.disabled = isEnglish;
    container.appendChild(btn);
  }
}

/** Fills the settings controls from server truth so they reflect reality. */
async function hydratePreferences(): Promise<void> {
  const [settings, profile, publicState, local] = await Promise.all([
    sendToBackground<UserSettingsData>({ type: 'GET_USER_SETTINGS' }),
    sendToBackground<ProfileData>({ type: 'GET_PROFILE' }),
    sendToBackground<{ is_public: boolean; username: string }>({ type: 'GET_PROFILE_PUBLIC' }),
    chrome.storage.local.get(['auto_translate', 'translate_language', 'desktop_notifications']),
  ]);

  const prefs: UserSettingsData = settings.ok
    ? settings.data
    : { skip_paywalled: false, discovery_mode: 'discovery', preferred_languages: [DEFAULT_LANGUAGE] };

  el<HTMLInputElement>('toggle-paywall').checked = prefs.skip_paywalled;
  el<HTMLInputElement>('toggle-deep-dive').checked = prefs.discovery_mode === 'deep_dive';
  el<HTMLInputElement>('toggle-auto-translate').checked = local.auto_translate === true;
  el<HTMLInputElement>('toggle-desktop-notifications').checked = local.desktop_notifications === true;
  el<HTMLSelectElement>('select-translate-lang').value = (local.translate_language as string) || DEFAULT_LANGUAGE;
  renderLanguageChips(prefs.preferred_languages);

  if (publicState.ok) el<HTMLInputElement>('toggle-public-profile').checked = publicState.data.is_public;

  // New OAuth users have no username yet — surface the claim prompt instead of
  // silently copying a broken /u/undefined link (web gates on the same field).
  const hasUsername = profile.ok && !!profile.data.username;
  el('btn-claim-username').hidden = hasUsername;
  el('btn-copy-profile-link').hidden = !hasUsername;
}

async function boot() {
  console.log('[roam-popup] Booting, checking session state');
  const res = await sendToBackground<StateData>({ type: 'GET_STATE' });
  console.log('[roam-popup] Boot GET_STATE response:', res);
  if (!res.ok) { showError(res.error, 'boot'); return; }
  reportVersionSkew(res.data.version);
  if (!res.data.signedIn) {
    showState('signedout');
    return;
  }
  await checkAndRouteAfterSignIn();
}

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  try { chrome.runtime.connect({ name: 'popup-keepalive' }); } catch { /* ignore */ }

  initAppearance();
  boot();

  // ── Sign in button ───────────────────────────────────────────────────────────
  el('btn-signin').addEventListener('click', () => {
    showState('auth');
  });

  el('btn-retry').addEventListener('click', () => boot());

  el('btn-add-categories').addEventListener('click', async () => {
    categoriesContext = 'settings';
    const [interests, allCats, allSubcats] = await Promise.all([
      sendToBackground<{ mode: 'pillars' | 'topics'; pillarIds: string[]; topicIds: string[] }>({ type: 'GET_USER_INTERESTS' }),
      sendToBackground<CategoryItem[]>({ type: 'GET_CATEGORIES' }),
      sendToBackground<SubcategoryItem[]>({ type: 'GET_ALL_SUBCATEGORIES' }),
    ]);
    const cats = allCats.ok && allCats.data.length > 0 ? allCats.data : FALLBACK_CATEGORIES;
    if (allSubcats.ok) loadedSubcategories = allSubcats.data;
    loadedCategories = cats;
    const mode = interests.ok ? interests.data.mode : 'pillars';
    const pillars = interests.ok ? interests.data.pillarIds : [];
    const topics = interests.ok ? interests.data.topicIds : [];
    populateInterestChips(mode, pillars, topics, cats, loadedSubcategories);
    el('btn-back-categories').hidden = false;
    showState('categories');
  });

  el('btn-back-auth').addEventListener('click', () => showState('signedout'));
  el('btn-back-email').addEventListener('click', () => showState('auth'));

  // ── Auth: Google OAuth ───────────────────────────────────────────────────
  async function startOAuthFlow() {
    const buttons = ['btn-auth-google', 'btn-auth-email'];
    buttons.forEach((id) => (el<HTMLButtonElement>(id).disabled = true));
    el('auth-waiting').hidden = false;

    const res = await sendToBackground<StateData>({ type: 'SIGN_IN_GOOGLE' });
    if (!res.ok) {
      buttons.forEach((id) => (el<HTMLButtonElement>(id).disabled = false));
      el('auth-waiting').hidden = true;
      showError(res.error, 'sign-in');
      return;
    }

    // The sign-in tab is open - get this popup out of the way. Signed-in state is
    // read from GET_STATE the next time the popup opens, so there is no polling.
    window.close();
  }

  el('btn-auth-google').addEventListener('click', () => startOAuthFlow());

  // ── Auth: email form ─────────────────────────────────────────────────────
  el('btn-auth-email').addEventListener('click', () => {
    el<HTMLInputElement>('input-email').value = '';
    el<HTMLInputElement>('input-password').value = '';
    el('email-auth-error').hidden = true;
    el('email-verify-msg').hidden = true;
    el<HTMLButtonElement>('btn-email-submit').textContent = 'Sign in';
    el('tab-signin').classList.add('auth-tab--active');
    el('tab-signup').classList.remove('auth-tab--active');
    showState('email-auth');
  });

  let emailMode: 'signin' | 'signup' = 'signin';

  el('tab-signin').addEventListener('click', () => {
    emailMode = 'signin';
    el('tab-signin').classList.add('auth-tab--active');
    el('tab-signup').classList.remove('auth-tab--active');
    el<HTMLButtonElement>('btn-email-submit').textContent = 'Sign in';
    el('email-auth-error').hidden = true;
    el('email-verify-msg').hidden = true;
  });

  el('tab-signup').addEventListener('click', () => {
    emailMode = 'signup';
    el('tab-signup').classList.add('auth-tab--active');
    el('tab-signin').classList.remove('auth-tab--active');
    el<HTMLButtonElement>('btn-email-submit').textContent = 'Sign up';
    el('email-auth-error').hidden = true;
    el('email-verify-msg').hidden = true;
  });

  el('btn-email-submit').addEventListener('click', async () => {
    const email = el<HTMLInputElement>('input-email').value.trim();
    const password = el<HTMLInputElement>('input-password').value;
    const errorEl = el<HTMLParagraphElement>('email-auth-error');

    if (!email || !password) {
      errorEl.textContent = 'Please enter both your email and password.';
      errorEl.hidden = false;
      return;
    }

    const submitBtn = el<HTMLButtonElement>('btn-email-submit');
    submitBtn.disabled = true;
    errorEl.hidden = true;

    if (emailMode === 'signin') {
      const res = await sendToBackground<StateData>({ type: 'SIGN_IN_EMAIL', email, password });
      submitBtn.disabled = false;
      if (!res.ok) {
        errorEl.textContent = res.error;
        errorEl.hidden = false;
        return;
      }
      await checkAndRouteAfterSignIn();
    } else {
      const res = await sendToBackground<{ needsVerification: boolean }>({ type: 'SIGN_UP_EMAIL', email, password });
      submitBtn.disabled = false;
      if (!res.ok) {
        errorEl.textContent = res.error;
        errorEl.hidden = false;
        return;
      }
      if (res.data.needsVerification) {
        el('email-verify-msg').hidden = false;
        submitBtn.textContent = 'Resend email';
      } else {
        await checkAndRouteAfterSignIn();
      }
    }
  });

  // ── Categories: chip multi-select ─────────────────────────────────────────
  el('category-select-chips').addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLButtonElement>('.chip');
    if (!chip) return;
    chip.classList.toggle('selected');
    const anySelected = el('category-select-chips').querySelectorAll('.chip.selected').length > 0;
    el<HTMLButtonElement>('btn-save-categories').disabled = !anySelected;
    el('categories-error').hidden = true;
    updateCategoryScope();
  });

  el('btn-select-all-categories').addEventListener('click', () => {
    const chips = Array.from(
      el('category-select-chips').querySelectorAll<HTMLButtonElement>('.chip'),
    );
    for (const chip of chips) chip.classList.add('selected');
    el<HTMLButtonElement>('btn-save-categories').disabled = chips.length === 0;
    el('categories-error').hidden = true;
    updateCategoryScope();
  });

  el('btn-mode-pillars').addEventListener('click', () => {
    if (currentInterestMode === 'pillars') return;
    populateInterestChips('pillars', [], [], loadedCategories, loadedSubcategories);
  });
  el('btn-mode-topics').addEventListener('click', async () => {
    if (currentInterestMode === 'topics') return;
    if (loadedSubcategories.length === 0) {
      const res = await sendToBackground<SubcategoryItem[]>({ type: 'GET_ALL_SUBCATEGORIES' });
      if (res.ok) loadedSubcategories = res.data;
    }
    populateInterestChips('topics', [], [], loadedCategories, loadedSubcategories);
  });

  el('btn-save-categories').addEventListener('click', async () => {
    const selectedChips = Array.from(
      el('category-select-chips').querySelectorAll<HTMLButtonElement>('.chip.selected')
    );
    const pillarIds = currentInterestMode === 'pillars'
      ? selectedChips.map((c) => c.dataset.catId!).filter(Boolean)
      : [];
    const topicIds = currentInterestMode === 'topics'
      ? selectedChips.map((c) => c.dataset.subcatId!).filter(Boolean)
      : [];

    const saveBtn = el<HTMLButtonElement>('btn-save-categories');
    saveBtn.disabled = true;
    const errEl = el<HTMLParagraphElement>('categories-error');
    errEl.hidden = true;

    const res = await sendToBackground({
      type: 'SET_USER_INTERESTS',
      mode: currentInterestMode,
      pillarIds,
      topicIds,
    });
    saveBtn.disabled = false;
    if (!res.ok) {
      errEl.textContent = res.error;
      errEl.hidden = false;
      return;
    }
    showPanel(null);
    showState('main');
    void refreshStatus();
  });

  el('btn-back-categories').addEventListener('click', () => {
    if (categoriesContext === 'settings') {
      showPanel('config');
      showState('main');
      void refreshStatus();
    }
  });

  // ── Roam button ───────────────────────────────────────────────────────────
  el('btn-roam').addEventListener('click', async () => {
    showPanel(null);
    const roamBtn = el<HTMLButtonElement>('btn-roam');
    roamBtn.disabled = true;
    roamBtn.textContent = 'Roaming…';
    setStatus('Finding next page…');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const res = await sendToBackground<RoamData>({
      type: 'ROAM',
      ...(focusModeEnabled && focusCategoryId ? { categoryId: focusCategoryId } : {}),
      ...(focusModeEnabled && focusSubcategoryId ? { subcategoryId: focusSubcategoryId } : {}),
    });
    roamBtn.disabled = false;
    roamBtn.textContent = 'Roam';
    if (!res.ok) { showError(res.error, 'roam'); return; }
    if (!res.data?.url) { showNoResults(res.data?.exhaustion ?? null); return; }
    if (tab?.id) chrome.tabs.update(tab.id, { url: res.data.url });
    window.close();
  });

  // ── Thumbs up ─────────────────────────────────────────────────────────────
  el('btn-upvote').addEventListener('click', async () => {
    showPanel(null);
    const flashDone = flashButton('btn-upvote', 'up');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url ?? '';
    if (!url) return;
    const check = await sendToBackground<CheckUrlData>({ type: 'CHECK_URL', url });
    if (!check.ok) { showError(check.error, 'upvote'); return; }
    if (check.data.known && check.data.url_id) {
      await Promise.all([
        flashDone,
        sendToBackground({ type: 'RATE', url_id: check.data.url_id, vote: 1 }),
      ]);
      window.close();
    } else {
      await flashDone;
      showPanel('submit');
    }
  });

  // ── Thumbs down ───────────────────────────────────────────────────────────
  el('btn-downvote').addEventListener('click', async () => {
    showPanel(null);
    flashButton('btn-downvote', 'down');
    setStatus('Finding next page…');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url ?? '';
    const roamPromise = sendToBackground<RoamData>({
      type: 'ROAM',
      ...(focusModeEnabled && focusCategoryId ? { categoryId: focusCategoryId } : {}),
      ...(focusModeEnabled && focusSubcategoryId ? { subcategoryId: focusSubcategoryId } : {}),
    });
    if (url) {
      sendToBackground<CheckUrlData>({ type: 'CHECK_URL', url }).then((check) => {
        if (check.ok && check.data.known && check.data.url_id) {
          sendToBackground({ type: 'RATE', url_id: check.data.url_id, vote: -1 });
        }
      });
    }
    const roamRes = await roamPromise;
    if (!roamRes.ok) { showError(roamRes.error, 'downvote'); return; }
    if (!roamRes.data?.url) { showNoResults(roamRes.data?.exhaustion ?? null); return; }
    if (tab?.id) chrome.tabs.update(tab.id, { url: roamRes.data.url });
    window.close();
  });

  // ── Config toggle ─────────────────────────────────────────────────────────
  el('btn-config').addEventListener('click', () => {
    const open = el('panel-config').hidden;
    showPanel(open ? 'config' : null);
    if (open) loadYouSection();
  });

  // ── Submit panel chips: populate from FALLBACK_CATEGORIES ──────────────────
  {
    const container = el('category-chips');
    for (const cat of FALLBACK_CATEGORIES) {
      const btn = document.createElement('button');
      btn.className = 'chip';
      btn.dataset.catId = cat.id;
      btn.textContent = `${cat.icon} ${cat.name}`;
      container.appendChild(btn);
    }
  }

  // ── Category chip selection + subcategory loading ──────────────────────────
  let selectedCategory: string | null = null;
  let selectedSubcategory: string | null = null;
  el('category-chips').addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLButtonElement>('.chip');
    if (!chip) return;
    el('category-chips').querySelectorAll('.chip').forEach((c) => c.classList.remove('selected'));
    chip.classList.add('selected');
    selectedCategory = chip.dataset.catId ?? null;
    selectedSubcategory = null;
    el<HTMLButtonElement>('btn-submit').disabled = false;
    // Load subcategories for this category
    const subcatContainer = el('subcategory-chips');
    const subcatGrid = el('subcategory-chip-grid');
    subcatGrid.textContent = '';
    if (selectedCategory) {
      sendToBackground<SubcategoryItem[]>({ type: 'GET_SUBCATEGORIES_FOR_CATEGORY', categoryId: selectedCategory }).then(res => {
        if (res.ok && res.data.length > 0) {
          subcatContainer.hidden = false;
          for (const sc of res.data) {
            const b = document.createElement('button');
            b.className = 'chip';
            b.dataset.subcatId = sc.id;
            b.textContent = sc.name;
            subcatGrid.appendChild(b);
          }
        } else {
          subcatContainer.hidden = true;
        }
      });
    }
  });

  // ── Subcategory chip selection ──────────────────────────────────────────────
  el('subcategory-chip-grid').addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLButtonElement>('.chip');
    if (!chip) return;
    el('subcategory-chip-grid').querySelectorAll('.chip').forEach((c) => c.classList.remove('selected'));
    chip.classList.add('selected');
    selectedSubcategory = chip.dataset.subcatId ?? null;
  });

  // ── Submit unknown URL ────────────────────────────────────────────────────
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  el('btn-submit').addEventListener('click', async () => {
    if (!selectedCategory || !UUID_RE.test(selectedCategory)) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url ?? '';
    if (!url) return;
    const submitErr = el<HTMLParagraphElement>('submit-error');
    submitErr.hidden = true;
    el<HTMLButtonElement>('btn-submit').disabled = true;
    const res = await sendToBackground<{ duplicate?: boolean; message?: string }>({ type: 'SUBMIT_URL', url, categoryId: selectedCategory, subcategoryId: selectedSubcategory ?? undefined });
    el<HTMLButtonElement>('btn-submit').disabled = false;
    if (!res.ok) {
      submitErr.textContent = res.error.includes('safe') || res.error.includes('Safe')
        ? 'This URL was flagged by Google Safe Browsing and cannot be submitted.'
        : res.error.includes('429') || res.error.includes('rate')
          ? 'You\'ve submitted too many URLs recently. Try again in an hour.'
          : res.error;
      submitErr.hidden = false;
      return;
    }
    if (res.data?.duplicate) {
      submitErr.textContent = res.data.message ?? 'This URL is already in our database.';
      submitErr.hidden = false;
      return;
    }
    const submitSuccess = el<HTMLParagraphElement>('submit-success');
    submitSuccess.textContent = 'Submitted for review!';
    submitSuccess.hidden = false;
    el<HTMLButtonElement>('btn-submit').disabled = true;
    setTimeout(() => window.close(), 2000);
  });

  // ── Config panel actions ──────────────────────────────────────────────────
  let loadedCollections: Collection[] = [];

  async function loadCollectionsForDropdown(): Promise<void> {
    const res = await sendToBackground<Collection[]>({ type: 'GET_COLLECTIONS' });
    if (res.ok) {
      loadedCollections = res.data;
    } else {
      console.error('Failed to load collections:', res.error);
    }
  }

  // ── Collections screen (rename / delete / visibility) ─────────────────────
  function collectionAction(label: string, onClick: () => void, extraClass?: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'collection-action' + (extraClass ? ` ${extraClass}` : '');
    btn.textContent = label;
    btn.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
    return btn;
  }

  async function renderCollectionsScreen(): Promise<void> {
    const list = el('collections-list');
    const empty = el('collections-empty');
    const err = el('collections-error');
    list.textContent = '';
    empty.hidden = true;
    err.hidden = true;

    const res = await sendToBackground<Collection[]>({ type: 'GET_COLLECTIONS' });
    if (!res.ok) {
      err.textContent = res.error;
      err.hidden = false;
      return;
    }
    loadedCollections = res.data;
    if (res.data.length === 0) {
      empty.hidden = false;
      return;
    }

    for (const col of res.data) {
      const row = document.createElement('div');
      row.className = 'collection-row';

      const name = document.createElement('div');
      name.className = 'collection-name';
      name.textContent = col.name;
      const meta = document.createElement('div');
      meta.className = 'collection-meta';
      meta.textContent = `${col.item_count} item${col.item_count === 1 ? '' : 's'}${col.is_public ? ' · public' : ''}`;
      name.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'collection-actions';

      actions.appendChild(collectionAction('Rename', () => {
        if (row.querySelector('.collection-rename')) return;
        const input = document.createElement('input');
        input.className = 'collection-rename';
        input.type = 'text';
        input.maxLength = 60;
        input.value = col.name;
        row.replaceChild(input, name);
        input.focus();
        input.select();
        let settled = false;
        const cancel = () => {
          if (settled) return;
          settled = true;
          if (input.parentNode === row) row.replaceChild(name, input);
        };
        const commit = async () => {
          if (settled) return;
          const next = input.value.trim();
          if (!next || next === col.name) { cancel(); return; }
          settled = true;
          const renameRes = await sendToBackground({ type: 'RENAME_COLLECTION', collectionId: col.id, name: next });
          if (!renameRes.ok) { showError(renameRes.error, 'rename-collection'); return; }
          await renderCollectionsScreen();
        };
        input.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') { ev.preventDefault(); void commit(); }
          if (ev.key === 'Escape') { ev.preventDefault(); cancel(); }
        });
        input.addEventListener('blur', () => { void commit(); });
      }));

      actions.appendChild(collectionAction(col.is_public ? 'Make private' : 'Make public', async () => {
        const updateRes = await sendToBackground({ type: 'UPDATE_COLLECTION_PUBLIC', collectionId: col.id, isPublic: !col.is_public });
        if (!updateRes.ok) { showError(updateRes.error, 'collection-visibility'); return; }
        await renderCollectionsScreen();
      }));

      if (col.is_public) {
        actions.appendChild(collectionAction('Copy link', async () => {
          await navigator.clipboard.writeText(`https://roamtheweb.app/c/${col.slug}`);
          showToast('Link copied');
        }));
      }

      // Two-tap delete — popups cannot use window.confirm reliably.
      let armed = false;
      let disarm: number | undefined;
      const del = collectionAction('Delete', async () => {
        if (!armed) {
          armed = true;
          del.textContent = 'Confirm?';
          disarm = window.setTimeout(() => { armed = false; del.textContent = 'Delete'; }, 3000);
          return;
        }
        window.clearTimeout(disarm);
        const delRes = await sendToBackground({ type: 'DELETE_COLLECTION', collectionId: col.id });
        if (!delRes.ok) { showError(delRes.error, 'delete-collection'); return; }
        await renderCollectionsScreen();
      }, 'collection-action--danger');
      actions.appendChild(del);

      row.appendChild(name);
      row.appendChild(actions);
      list.appendChild(row);
    }
  }

  // ── Community: activity feed + follow lists ───────────────────────────────
  function personRow(user: FollowUser, onAction: (() => void) | null): HTMLElement {
    const row = document.createElement('div');
    row.className = 'person-row';

    const profile = document.createElement('button');
    profile.className = 'person-profile';
    const name = document.createElement('span');
    name.className = 'person-name';
    name.textContent = user.display_name || user.username;
    const meta = document.createElement('span');
    meta.className = 'person-meta';
    meta.textContent = `@${user.username}`;
    profile.appendChild(name);
    profile.appendChild(meta);
    profile.addEventListener('click', () => {
      chrome.tabs.create({ url: `https://roamtheweb.app/u/${user.username}` });
      window.close();
    });
    row.appendChild(profile);

    if (onAction) {
      const action = document.createElement('button');
      action.className = 'person-action';
      action.textContent = 'Unfollow';
      action.addEventListener('click', onAction);
      row.appendChild(action);
    }
    return row;
  }

  async function renderActivityTab(): Promise<void> {
    const list = el('activity-list');
    const empty = el('activity-empty');
    const err = el('community-error');
    list.textContent = '';
    empty.hidden = true;
    err.hidden = true;

    const res = await sendToBackground<ActivityItem[]>({ type: 'GET_ACTIVITY_FEED', limit: 30 });
    if (!res.ok) {
      err.textContent = res.error;
      err.hidden = false;
      return;
    }
    if (res.data.length === 0) {
      empty.hidden = false;
      return;
    }

    for (const item of res.data) {
      const link = activityLink(item);
      const row = document.createElement('button');
      row.className = 'activity-row';

      const name = document.createElement('span');
      name.className = 'activity-name';
      name.textContent = item.display_name || item.username;

      const text = document.createElement('span');
      text.className = 'activity-text';
      text.textContent = activityText(item);

      const time = document.createElement('span');
      time.className = 'activity-time';
      time.textContent = relativeTime(item.created_at);

      row.appendChild(name);
      row.appendChild(text);
      row.appendChild(time);
      row.addEventListener('click', () => {
        if (!link) return;
        chrome.tabs.create({ url: link });
        window.close();
      });
      list.appendChild(row);
    }
  }

  async function renderPeopleTab(): Promise<void> {
    const followersList = el('followers-list');
    const followingList = el('following-list');
    const followersEmpty = el('followers-empty');
    const followingEmpty = el('following-empty');
    const err = el('community-error');
    followersList.textContent = '';
    followingList.textContent = '';
    followersEmpty.hidden = true;
    followingEmpty.hidden = true;
    err.hidden = true;

    const [followers, following] = await Promise.all([
      sendToBackground<FollowUser[]>({ type: 'GET_FOLLOWERS' }),
      sendToBackground<FollowUser[]>({ type: 'GET_FOLLOWING' }),
    ]);
    if (!followers.ok) { err.textContent = followers.error; err.hidden = false; return; }
    if (!following.ok) { err.textContent = following.error; err.hidden = false; return; }

    followersEmpty.hidden = followers.data.length > 0;
    followingEmpty.hidden = following.data.length > 0;

    for (const user of followers.data) followersList.appendChild(personRow(user, null));
    for (const user of following.data) {
      followingList.appendChild(personRow(user, async () => {
        const res = await sendToBackground({ type: 'UNFOLLOW_USER', userId: user.id });
        if (!res.ok) { showError(res.error, 'unfollow'); return; }
        await renderPeopleTab();
      }));
    }
  }

  function setCommunityTab(tab: 'activity' | 'people'): void {
    const isActivity = tab === 'activity';
    el('tab-activity').classList.toggle('auth-tab--active', isActivity);
    el('tab-people').classList.toggle('auth-tab--active', !isActivity);
    el('community-activity').hidden = !isActivity;
    el('community-people').hidden = isActivity;
    if (isActivity) void renderActivityTab();
    else void renderPeopleTab();
  }

  el('btn-community').addEventListener('click', () => {
    showPanel(null);
    showState('community');
    el('community-error').hidden = true;
    setCommunityTab('activity');
  });

  el('tab-activity').addEventListener('click', () => setCommunityTab('activity'));
  el('tab-people').addEventListener('click', () => setCommunityTab('people'));

  el('btn-back-community').addEventListener('click', () => {
    showPanel('config');
    showState('main');
  });

  el('btn-find-people').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://roamtheweb.app/people' });
    window.close();
  });

  // ── Profile: username, display name, bio ──────────────────────────────────
  async function renderProfileScreen(): Promise<void> {
    const err = el('profile-error');
    err.hidden = true;
    el('profile-success').hidden = true;

    const [res, state] = await Promise.all([
      sendToBackground<MyProfileData>({ type: 'GET_MY_PROFILE' }),
      sendToBackground<StateData>({ type: 'GET_STATE' }),
    ]);
    if (!res.ok) {
      err.textContent = res.error;
      err.hidden = false;
      return;
    }
    if (state.ok) reportVersionSkew(state.data.version);
    const me = res.data;
    el('profile-summary').textContent =
      `Lv ${me.level} · ${me.xp_total} XP · 🔥 ${me.streak_days} · Roamed ${me.roamed} · Submitted ${me.submitted}`;

    const usernameInput = el<HTMLInputElement>('input-username');
    const claimBtn = el('btn-claim-username-submit');
    const viewBtn = el('btn-view-public-profile');
    if (me.username) {
      usernameInput.value = me.username;
      usernameInput.disabled = true;
      claimBtn.hidden = true;
      viewBtn.hidden = false;
      viewBtn.textContent = `View @${me.username} ↗`;
    } else {
      usernameInput.value = '';
      usernameInput.disabled = false;
      claimBtn.hidden = false;
      viewBtn.hidden = true;
    }

    el<HTMLInputElement>('input-display-name').value = me.display_name ?? '';
    el<HTMLTextAreaElement>('input-bio').value = me.bio ?? '';
    el('bio-chars').textContent = String((me.bio ?? '').length);

    // Password change is only meaningful for email accounts; an unknown provider
    // falls back to showing it rather than hiding the feature silently.
    const isEmailAccount = !state.ok || (state.data.provider ?? 'email') === 'email';
    el('profile-security').hidden = !isEmailAccount;
    el('profile-security-note').hidden = isEmailAccount;
  }

  function openProfileScreen(): void {
    showPanel(null);
    showState('profile');
    void renderProfileScreen();
  }

  el('btn-profile').addEventListener('click', openProfileScreen);

  el('btn-back-profile').addEventListener('click', () => {
    showPanel('config');
    showState('main');
  });

  el('input-bio').addEventListener('input', () => {
    el('bio-chars').textContent = String(el<HTMLTextAreaElement>('input-bio').value.length);
  });

  el('btn-claim-username-submit').addEventListener('click', async () => {
    const err = el('profile-error');
    const btn = el<HTMLButtonElement>('btn-claim-username-submit');
    btn.disabled = true;
    err.hidden = true;

    const res = await sendToBackground<{ username: string }>({
      type: 'CLAIM_USERNAME',
      username: el<HTMLInputElement>('input-username').value.trim(),
    });
    btn.disabled = false;
    if (!res.ok) {
      err.textContent = res.error;
      err.hidden = false;
      return;
    }
    await renderProfileScreen();
    el('profile-success').hidden = false;
  });

  el('btn-save-profile').addEventListener('click', async () => {
    const btn = el<HTMLButtonElement>('btn-save-profile');
    const err = el('profile-error');
    const success = el('profile-success');
    btn.disabled = true;
    err.hidden = true;
    success.hidden = true;

    const res = await sendToBackground({
      type: 'SET_PROFILE_FIELDS',
      displayName: el<HTMLInputElement>('input-display-name').value,
      bio: el<HTMLTextAreaElement>('input-bio').value,
    });
    btn.disabled = false;
    if (!res.ok) {
      err.textContent = res.error;
      err.hidden = false;
      return;
    }
    success.hidden = false;
  });

  el('btn-view-public-profile').addEventListener('click', () => {
    const username = el<HTMLInputElement>('input-username').value.trim();
    if (!username) return;
    chrome.tabs.create({ url: `https://roamtheweb.app/u/${username}` });
    window.close();
  });

  // ── Security: password change ─────────────────────────────────────────────
  el('btn-change-password').addEventListener('click', async () => {
    const err = el('password-error');
    const success = el('password-success');
    const btn = el<HTMLButtonElement>('btn-change-password');
    err.hidden = true;
    success.hidden = true;

    const current = el<HTMLInputElement>('input-current-password').value;
    const next = el<HTMLInputElement>('input-new-password').value;
    const confirm = el<HTMLInputElement>('input-confirm-password').value;

    if (next !== confirm) {
      err.textContent = 'The new passwords do not match.';
      err.hidden = false;
      return;
    }
    const ruleError = validatePassword(next);
    if (ruleError) {
      err.textContent = ruleError;
      err.hidden = false;
      return;
    }

    btn.disabled = true;
    const res = await sendToBackground({ type: 'CHANGE_PASSWORD', currentPassword: current, newPassword: next });
    btn.disabled = false;
    if (!res.ok) {
      err.textContent = res.error;
      err.hidden = false;
      return;
    }
    el<HTMLInputElement>('input-current-password').value = '';
    el<HTMLInputElement>('input-new-password').value = '';
    el<HTMLInputElement>('input-confirm-password').value = '';
    success.hidden = false;
  });

  el('btn-web-account').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://roamtheweb.app/settings' });
    window.close();
  });

  el('btn-add-collection').addEventListener('click', async () => {
    await loadCollectionsForDropdown();

    const newColBtn = document.createElement('button');
    newColBtn.style.cssText = `
      width: 100%;
      padding: 8px 10px;
      border: none;
      background: transparent;
      color: var(--accent);
      text-align: left;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
    `;
    newColBtn.textContent = '+ New collection';
    newColBtn.addEventListener('click', async () => {
      const name = prompt('Collection name:');
      if (!name) return;
      const res = await sendToBackground<Collection>({ type: 'CREATE_COLLECTION', name });
      if (!res.ok) { showError(res.error ?? "Couldn't create collection.", 'create-collection'); return; }
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url) return;
      const addRes = await sendToBackground({ type: 'ADD_URL_TO_COLLECTION', url: tab.url, collectionId: res.data.id });
      if (addRes.ok) { showToast('✓ Added to collection'); setTimeout(() => window.close(), 1500); } else { showError(addRes.error ?? "Couldn't add to collection.", 'add-to-collection'); }
    });

    const anchor = el<HTMLButtonElement>('btn-add-collection');
    showDropdown(
      anchor,
      loadedCollections.map(col => ({
        label: col.name,
        onPick: async () => {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!tab?.url) return;
          const res = await sendToBackground({ type: 'ADD_URL_TO_COLLECTION', url: tab.url, collectionId: col.id });
          if (res.ok) { showToast('✓ Added to collection'); setTimeout(() => window.close(), 1500); } else { showError(res.error ?? "Couldn't add to collection.", 'add-to-collection'); }
        },
      })),
      newColBtn
    );
  });

  el('btn-save-later').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return;
    const res = await sendToBackground({ type: 'SAVE_LATER', url: tab.url, title: tab.title });
    if (res.ok) {
      showToast('✓ Saved!');
      setTimeout(() => window.close(), 1500);
    }
  });

  el('btn-saved-pages').addEventListener('click', async () => {
    const res = await sendToBackground<SavedUrlItem[]>({ type: 'GET_SAVED_URLS' });
    const list = el('saved-list');
    const empty = el('saved-empty');
    list.textContent = '';
    const items = res.ok ? res.data : [];
    if (items.length === 0) {
      empty.hidden = false;
    } else {
      empty.hidden = true;
      for (const item of items) {
        const row = document.createElement('div');
        row.className = 'saved-item';
        row.dataset.id = item.id;

        const link = document.createElement('a');
        link.href = item.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.className = 'saved-item-link';

        const title = document.createElement('span');
        title.className = 'saved-item-title';
        title.textContent = item.title || item.url;

        const domain = document.createElement('span');
        domain.className = 'saved-item-domain';
        try { domain.textContent = new URL(item.url).hostname; } catch { domain.textContent = ''; }

        link.appendChild(title);
        link.appendChild(domain);

        const remove = document.createElement('button');
        remove.className = 'saved-item-remove';
        remove.textContent = '✕';
        remove.title = 'Remove';
        remove.dataset.id = item.id;

        row.appendChild(link);
        row.appendChild(remove);
        list.appendChild(row);
      }
    }
    showState('saved');
  });

  // Single delegated handler: the list is re-rendered on every open, so binding
  // a listener per render would stack duplicate handlers on the same element.
  el('saved-list').addEventListener('click', async (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('.saved-item-remove');
    if (!btn?.dataset.id) return;
    const res = await sendToBackground<null>({ type: 'REMOVE_SAVED_URL', savedUrlId: btn.dataset.id });
    if (!res.ok) { showError(res.error, 'remove-saved'); return; }
    btn.closest('.saved-item')?.remove();
    if (!el('saved-list').children.length) el('saved-empty').hidden = false;
  });

  el('btn-back-saved').addEventListener('click', () => showState('main'));

  el('btn-share').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) await navigator.clipboard.writeText(tab.url);
    window.close();
  });

  el('btn-share-with-user').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url;
    if (!url) return;

    const res = await sendToBackground<Array<{ user_id: string; username: string; display_name: string | null }>>({
      type: 'GET_SHARE_RECIPIENTS',
    });

    if (!res.ok || !res.data || res.data.length === 0) {
      chrome.tabs.create({ url: 'https://roamtheweb.app/following' });
      window.close();
      return;
    }

    const anchor = el<HTMLButtonElement>('btn-share-with-user');
    showDropdown(
      anchor,
      res.data.map(user => ({
        label: `${user.username}${user.display_name ? ` (${user.display_name})` : ''}`,
        onPick: async () => {
          const shareRes = await sendToBackground({ type: 'SHARE_URL_WITH_USER', url, recipientId: user.user_id });
          if (shareRes.ok) {
            window.close();
          } else {
            showError(shareRes.error ?? "Couldn't share this URL.", 'share-url');
          }
        },
      }))
    );
  });

  el('btn-copy-profile-link').addEventListener('click', async () => {
    const profile = await sendToBackground<ProfileData>({ type: 'GET_PROFILE' });
    if (profile.ok && profile.data.username) {
      await navigator.clipboard.writeText(`https://roamtheweb.app/u/${profile.data.username}`);
    } else {
      chrome.tabs.create({ url: 'https://roamtheweb.app/profile' });
    }
    window.close();
  });

  el('btn-roam-category').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url ?? '';
    if (!url) return;
    const check = await sendToBackground<CheckUrlData>({ type: 'CHECK_URL', url });
    if (!check.ok || !check.data.category_id) {
      showError('Couldn\'t determine a category for this page. Try a different one.', 'roam-category');
      return;
    }
    const res = await sendToBackground<RoamData>({
      type: 'ROAM_CATEGORY',
      categoryId: check.data.category_id,
    });
    if (!res.ok) { showError(res.error, 'roam-category'); return; }
    if (!res.data?.url) { showState('noresults'); return; }
    if (tab?.id) chrome.tabs.update(tab.id, { url: res.data.url });
    window.close();
  });

  el('btn-roam-collection').addEventListener('click', async () => {
    await loadCollectionsForDropdown();
    if (loadedCollections.length === 0) {
      showError('No collections yet. Create one from the web app.', 'roam-collection');
      return;
    }
    const anchor = el<HTMLButtonElement>('btn-roam-collection');
    const items = loadedCollections.map(col => ({
      label: `${col.name} (${col.item_count})`,
      onPick: async () => {
        const res = await sendToBackground<RoamData>({ type: 'ROAM_COLLECTION', collectionId: col.id });
        if (!res.ok) { showError(res.error, 'roam-collection'); return; }
        if (!res.data?.url) { showState('noresults'); return; }
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) chrome.tabs.update(tab.id, { url: res.data.url });
        window.close();
      },
    }));
    const publicCols = loadedCollections.filter(c => c.is_public);
    let footer: HTMLElement | undefined;
    if (publicCols.length > 0) {
      footer = document.createElement('div');
      footer.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';
      for (const col of publicCols) {
        const linkBtn = document.createElement('button');
        linkBtn.style.cssText = `
          width: 100%;
          padding: 8px 10px;
          border: none;
          border-top: 1px solid var(--border);
          background: transparent;
          color: var(--text);
          text-align: left;
          cursor: pointer;
          font-size: 13px;
        `;
        linkBtn.textContent = `🔗 Copy link: ${col.name}`;
        linkBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await navigator.clipboard.writeText(`https://roamtheweb.app/c/${col.slug}`);
          linkBtn.textContent = '✓ Copied';
        });
        linkBtn.addEventListener('mouseover', () => { linkBtn.style.background = 'var(--bg-hover)'; });
        linkBtn.addEventListener('mouseout', () => { linkBtn.style.background = 'transparent'; });
        footer.appendChild(linkBtn);
      }
    }
    showDropdown(anchor, items, footer);
  });

  el('btn-manage-collections').addEventListener('click', () => {
    showPanel(null);
    showState('collections');
    void renderCollectionsScreen();
  });

  el('btn-back-collections').addEventListener('click', () => {
    showPanel('config');
    showState('main');
  });

  el('btn-web-collections').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://roamtheweb.app/profile' });
    window.close();
  });

  el('btn-category-prefs').addEventListener('click', async () => {
    categoriesContext = 'settings';
    const [interests, allCats, allSubcats] = await Promise.all([
      sendToBackground<{ mode: 'pillars' | 'topics'; pillarIds: string[]; topicIds: string[] }>({ type: 'GET_USER_INTERESTS' }),
      sendToBackground<CategoryItem[]>({ type: 'GET_CATEGORIES' }),
      sendToBackground<SubcategoryItem[]>({ type: 'GET_ALL_SUBCATEGORIES' }),
    ]);
    const cats = allCats.ok && allCats.data.length > 0 ? allCats.data : FALLBACK_CATEGORIES;
    if (allSubcats.ok) loadedSubcategories = allSubcats.data;
    loadedCategories = cats;
    const mode = interests.ok ? interests.data.mode : 'pillars';
    const pillars = interests.ok ? interests.data.pillarIds : [];
    const topics = interests.ok ? interests.data.topicIds : [];
    populateInterestChips(mode, pillars, topics, cats, loadedSubcategories);
    showPanel(null);
    el('btn-back-categories').hidden = false;
    showState('categories');
  });

  el('btn-signout').addEventListener('click', async () => {
    await sendToBackground({ type: 'SIGN_OUT' });
    showPanel(null);
    showState('signedout');
  });

  // ── Report broken link ────────────────────────────────────────────────────
  el('btn-report-url').addEventListener('click', async () => {
    const btn = el<HTMLButtonElement>('btn-report-url');
    btn.disabled = true;
    btn.textContent = 'Reporting…';
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url ?? '';
    if (!url) { btn.disabled = false; btn.textContent = 'Report broken link'; return; }
    const check = await sendToBackground<CheckUrlData>({ type: 'CHECK_URL', url });
    if (!check.ok || !check.data.known || !check.data.url_id) {
      btn.disabled = false; btn.textContent = 'Report broken link'; return;
    }
    const res = await sendToBackground({ type: 'REPORT_URL', url_id: check.data.url_id });
    if (!res.ok) { btn.disabled = false; btn.textContent = 'Report broken link'; return; }
    btn.textContent = 'Reported ✓ — skipping…';
    showPanel(null);
    const roamRes = await sendToBackground<RoamData>({ type: 'ROAM' });
    if (!roamRes.ok) { showError(roamRes.error, 'roam'); return; }
    if (!roamRes.data?.url) { showState('noresults'); return; }
    if (tab?.id) chrome.tabs.update(tab.id, { url: roamRes.data.url });
    window.close();
  });

  // ── Feedback ──────────────────────────────────────────────────────────────
  el('btn-send-feedback').addEventListener('click', () => {
    el<HTMLTextAreaElement>('feedback-message').value = '';
    el<HTMLInputElement>('feedback-email').value = '';
    el('feedback-chars').textContent = '0';
    el('feedback-error').hidden = true;
    el('feedback-success').hidden = true;
    el<HTMLButtonElement>('btn-feedback-submit').disabled = true;
    el<HTMLButtonElement>('btn-feedback-submit').textContent = 'Send';
    showPanel(null);
    showState('feedback');
  });

  el('btn-back-feedback').addEventListener('click', () => {
    showPanel('config');
    showState('main');
    void refreshStatus();
  });

  el('feedback-message').addEventListener('input', () => {
    const val = el<HTMLTextAreaElement>('feedback-message').value;
    el('feedback-chars').textContent = String(val.length);
    el<HTMLButtonElement>('btn-feedback-submit').disabled = val.trim().length === 0;
  });

  el('btn-feedback-submit').addEventListener('click', async () => {
    const message = el<HTMLTextAreaElement>('feedback-message').value.trim();
    const email = el<HTMLInputElement>('feedback-email').value.trim() || undefined;
    if (!message) return;

    const submitBtn = el<HTMLButtonElement>('btn-feedback-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';
    el('feedback-error').hidden = true;

    const isFirefox = navigator.userAgent.includes('Firefox');
    const platform = isFirefox ? 'extension-firefox' : 'extension-chrome';

    const res = await sendToBackground({ type: 'SEND_FEEDBACK', message, email, platform });
    if (!res.ok) {
      el<HTMLParagraphElement>('feedback-error').textContent = res.error;
      el('feedback-error').hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send';
      return;
    }

    el('feedback-success').hidden = false;
    submitBtn.textContent = 'Sent ✓';
    setTimeout(() => {
      showPanel('config');
      showState('main');
      void refreshStatus();
    }, 2000);
  });

  // ── Notifications ─────────────────────────────────────────────────────────
  el('btn-notifications').addEventListener('click', async () => {
    const res = await sendToBackground<NotificationItem[]>({ type: 'GET_NOTIFICATIONS' });
    const list = el('notif-list');
    const empty = el('notif-empty');
    list.textContent = '';
    if (res.ok && res.data.length > 0) {
      empty.hidden = true;
      for (const n of res.data) {
        const link = notificationLink(n);
        const row = document.createElement('div');
        row.className = 'notif-item' + (n.read ? '' : ' notif-item--unread') + (link ? ' notif-item--link' : '');
        row.dataset.id = n.id;
        const text = document.createElement('div');
        text.className = 'notif-text';
        const { title, body } = notificationText(n);
        const titleEl = document.createElement('div');
        titleEl.className = 'notif-title';
        titleEl.textContent = title;
        text.appendChild(titleEl);
        if (body) {
          const bodyEl = document.createElement('div');
          bodyEl.className = 'notif-body';
          bodyEl.textContent = body;
          text.appendChild(bodyEl);
        }
        const time = document.createElement('div');
        time.className = 'notif-time';
        try { time.textContent = new Date(n.created_at).toLocaleDateString(); } catch { time.textContent = ''; }
        text.appendChild(time);
        const del = document.createElement('button');
        del.className = 'notif-delete';
        del.textContent = '✕';
        del.title = 'Delete';
        del.addEventListener('click', async (e) => {
          e.stopPropagation();
          await sendToBackground({ type: 'DELETE_NOTIFICATION', notificationId: n.id });
          const wasUnread = row.classList.contains('notif-item--unread');
          row.remove();
          if (!list.children.length) empty.hidden = false;
          if (wasUnread) decrementUnreadChip();
        });
        // Tapping marks it read and, when the notification carries a target,
        // opens the same place the web app would (share, badge, profile, …).
        row.addEventListener('click', async () => {
          if (row.classList.contains('notif-item--unread')) {
            await sendToBackground({ type: 'MARK_NOTIFICATION_READ', notificationId: n.id });
            row.classList.remove('notif-item--unread');
            decrementUnreadChip();
          }
          if (link) {
            chrome.tabs.create({ url: link });
            window.close();
          }
        });
        row.appendChild(text);
        row.appendChild(del);
        list.appendChild(row);
      }
    } else {
      empty.hidden = false;
    }
    showPanel(null);
    showState('notifications');
  });

  el('btn-back-notifications').addEventListener('click', () => {
    showPanel('config');
    showState('main');
  });

  el('btn-mark-all-read').addEventListener('click', async () => {
    await sendToBackground({ type: 'MARK_NOTIFICATIONS_READ' });
    el('notif-list').querySelectorAll('.notif-item--unread').forEach(r => r.classList.remove('notif-item--unread'));
    const chip = el('notif-count-chip');
    chip.hidden = true;
  });

  el('btn-clear-notifications').addEventListener('click', async () => {
    await sendToBackground({ type: 'CLEAR_NOTIFICATIONS' });
    el('notif-list').textContent = '';
    el('notif-empty').hidden = false;
    el('notif-count-chip').hidden = true;
  });

  // ── Badges ────────────────────────────────────────────────────────────────
  el('btn-web-badges').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://roamtheweb.app/badges' });
    window.close();
  });

  el('btn-badges').addEventListener('click', async () => {
    showPanel(null);
    showState('badges');
    const grid = el('badges-grid');
    const empty = el('badges-empty');
    const err = el('badges-error');
    grid.textContent = '';
    empty.hidden = true;
    err.hidden = true;
    const res = await sendToBackground<BadgeData[]>({ type: 'GET_BADGES' });
    if (!res.ok) {
      err.textContent = res.error;
      err.hidden = false;
      return;
    }
    const badges = res.data ?? [];
    if (badges.length === 0) {
      empty.hidden = false;
      return;
    }
    const unlocked = badges.filter((b) => b.is_unlocked).length;
    el('badges-count').textContent = `${unlocked} / ${badges.length}`;
    for (const b of badges) {
      const hidden = b.is_hidden && !b.is_unlocked;
      const item = document.createElement('button');
      item.className = 'badge-item' + (b.is_unlocked ? ' badge-item--unlocked' : '');
      item.title = hidden ? '???' : `${b.name}: ${b.description}`;

      const icon = document.createElement('span');
      icon.className = 'badge-item-icon';
      icon.textContent = hidden ? '?' : b.icon;
      item.appendChild(icon);

      const name = document.createElement('span');
      name.className = 'badge-item-name';
      name.textContent = hidden ? '???' : b.name;
      item.appendChild(name);

      if (!b.is_unlocked && b.required_count != null && b.required_count > 0) {
        const bar = document.createElement('div');
        bar.className = 'badge-item-bar';
        const fill = document.createElement('div');
        fill.className = 'badge-item-fill';
        const pct = Math.min((b.progress_current / b.required_count) * 100, 100);
        fill.style.width = `${pct}%`;
        bar.appendChild(fill);
        item.appendChild(bar);
      }
      grid.appendChild(item);
    }
  });

  el('btn-back-badges').addEventListener('click', () => {
    showPanel('config');
    showState('main');
  });

  el('btn-challenges').addEventListener('click', async () => {
    showPanel(null);
    showState('challenges');
    const list = el('challenges-list');
    const empty = el('challenges-empty');
    const err = el('challenges-error');
    list.textContent = '';
    empty.hidden = true;
    err.hidden = true;
    const res = await sendToBackground<ChallengeData[]>({ type: 'GET_CHALLENGES' });
    if (!res.ok) {
      err.textContent = res.error;
      err.hidden = false;
      return;
    }
    const challenges = res.data ?? [];
    if (challenges.length === 0) {
      empty.hidden = false;
      return;
    }
    const sections: { label: string; type: 'daily' | 'weekly' | 'monthly' }[] = [
      { label: 'Daily', type: 'daily' },
      { label: 'Weekly', type: 'weekly' },
      { label: 'Monthly', type: 'monthly' },
    ];
    const typeColors: Record<'daily' | 'weekly' | 'monthly', string> = {
      daily: '#3b82f6',
      weekly: '#a855f7',
      monthly: '#d97706',
    };
    for (const section of sections) {
      const items = challenges.filter((c) => c.challenge.type === section.type);
      if (items.length === 0) continue;
      const header = document.createElement('div');
      header.className = 'challenges-section-title';
      header.textContent = section.label;
      list.appendChild(header);
      for (const c of items) {
        const goal = c.challenge.goal_count;
        const progress = goal > 0 ? Math.min(c.progress_current / goal, 1) : 0;
        const completed = !!c.completed_at;

        const card = document.createElement('div');
        card.className = 'challenge-card' + (completed ? ' challenge-card--done' : '');

        const head = document.createElement('div');
        head.className = 'challenge-card-head';
        const title = document.createElement('span');
        title.className = 'challenge-card-title';
        title.textContent = c.challenge.title;
        head.appendChild(title);
        if (completed) {
          const check = document.createElement('span');
          check.className = 'challenge-card-check';
          check.textContent = '✓';
          head.appendChild(check);
        }
        card.appendChild(head);

        const desc = document.createElement('div');
        desc.className = 'challenge-card-desc';
        desc.textContent = c.challenge.goal_description || '';
        card.appendChild(desc);

        const meta = document.createElement('div');
        meta.className = 'challenge-card-meta';
        const progText = document.createElement('span');
        progText.textContent = `${c.progress_current} / ${goal}`;
        const xp = document.createElement('span');
        xp.textContent = `+${c.challenge.xp_reward} XP`;
        meta.appendChild(progText);
        meta.appendChild(xp);
        card.appendChild(meta);

        const bar = document.createElement('div');
        bar.className = 'challenge-card-bar';
        const fill = document.createElement('div');
        fill.className = 'challenge-card-fill';
        fill.style.width = `${Math.round(progress * 100)}%`;
        fill.style.background = completed ? '#22c55e' : typeColors[section.type];
        bar.appendChild(fill);
        card.appendChild(bar);

        list.appendChild(card);
      }
    }
  });

  el('btn-back-challenges').addEventListener('click', () => {
    showPanel('config');
    showState('main');
  });

  // ── History ───────────────────────────────────────────────────────────────
  el('btn-history').addEventListener('click', async () => {
    const res = await sendToBackground<{ url: string; title: string; visitedAt: number }[]>({ type: 'GET_URL_HISTORY', limit: 50 });
    const list = el('history-list');
    const empty = el('history-empty');
    list.textContent = '';
    if (res.ok && res.data.length > 0) {
      empty.hidden = true;
      for (const entry of res.data) {
        const row = document.createElement('div');
        row.className = 'history-item';
        const link = document.createElement('a');
        link.href = entry.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.className = 'history-item-link';
        const title = document.createElement('span');
        title.className = 'history-item-title';
        title.textContent = entry.title || entry.url;
        const domain = document.createElement('span');
        domain.className = 'history-item-domain';
        try { domain.textContent = new URL(entry.url).hostname; } catch { domain.textContent = ''; }
        link.appendChild(title);
        link.appendChild(domain);
        row.appendChild(link);
        list.appendChild(row);
      }
    } else {
      empty.hidden = false;
    }
    showPanel(null);
    showState('history');
  });

  el('btn-back-history').addEventListener('click', () => {
    showPanel('config');
    showState('main');
  });

  el('btn-clear-history').addEventListener('click', async () => {
    await sendToBackground({ type: 'CLEAR_URL_HISTORY' });
    el('history-list').textContent = '';
    el('history-empty').hidden = false;
  });

  // ── Discovery languages (multi-select chips) ──────────────────────────────
  el('language-chips').addEventListener('click', async (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLButtonElement>('.chip');
    if (!chip || chip.disabled || !chip.dataset.lang) return;
    chip.classList.toggle('selected');
    const languages = Array.from(el('language-chips').querySelectorAll<HTMLButtonElement>('.chip.selected'))
      .map((c) => c.dataset.lang)
      .filter((code): code is string => typeof code === 'string' && code.length > 0);
    const res = await sendToBackground({ type: 'SET_LANGUAGE_PREF', languages });
    if (!res.ok) showError(res.error, 'set-language');
  });

  // ── Toggle: Public profile ────────────────────────────────────────────────
  el('toggle-public-profile').addEventListener('change', () => {
    const checked = el<HTMLInputElement>('toggle-public-profile').checked;
    sendToBackground({ type: 'SET_PROFILE_PUBLIC', isPublic: checked });
  });

  // ── Toggle: Paywall ───────────────────────────────────────────────────────
  el('toggle-paywall').addEventListener('change', () => {
    const checked = el<HTMLInputElement>('toggle-paywall').checked;
    sendToBackground({ type: 'SET_PAYWALL_PREF', skip: checked });
  });

  // ── Toggle: Deep dive discovery ───────────────────────────────────────────
  el('toggle-deep-dive').addEventListener('change', () => {
    const checked = el<HTMLInputElement>('toggle-deep-dive').checked;
    sendToBackground({ type: 'SET_DISCOVERY_MODE', mode: checked ? 'deep_dive' : 'discovery' });
  });

  // ── Toggle: Desktop notifications ─────────────────────────────────────────
  el('toggle-desktop-notifications').addEventListener('change', () => {
    const checked = el<HTMLInputElement>('toggle-desktop-notifications').checked;
    sendToBackground({ type: 'SET_DESKTOP_NOTIFICATIONS', enabled: checked });
  });

  // ── Toggle: Always translate roamed pages ─────────────────────────────────
  el('toggle-auto-translate').addEventListener('change', () => {
    const checked = el<HTMLInputElement>('toggle-auto-translate').checked;
    sendToBackground({ type: 'SET_AUTO_TRANSLATE', enabled: checked });
  });

  // ── Translate target language ─────────────────────────────────────────────
  {
    const select = el<HTMLSelectElement>('select-translate-lang');
    for (const lang of LANGUAGES) {
      const opt = document.createElement('option');
      opt.value = lang.code;
      opt.textContent = lang.label;
      select.appendChild(opt);
    }
    select.value = DEFAULT_LANGUAGE;
    select.addEventListener('change', () => {
      void chrome.storage.local.set({ translate_language: select.value });
    });
  }

  // ── Claim username (new OAuth users have none yet) ────────────────────────
  el('btn-claim-username').addEventListener('click', () => {
    openProfileScreen();
    el<HTMLInputElement>('input-username').focus();
  });

  // ── Toggle: Focus mode ────────────────────────────────────────────────────
  el('toggle-focus').addEventListener('change', () => {
    focusModeEnabled = el<HTMLInputElement>('toggle-focus').checked;
    el('focus-pickers').hidden = !focusModeEnabled;
    if (focusModeEnabled) {
      loadCategoriesForFocus();
    } else {
      focusCategoryId = null;
      focusSubcategoryId = null;
      void refreshStatus();
    }
  });

  async function loadCategoriesForFocus() {
    const res = await sendToBackground<CategoryItem[]>({ type: 'GET_CATEGORIES' });
    const cats = res.ok && res.data.length > 0 ? res.data : FALLBACK_CATEGORIES;
    el('btn-focus-category').addEventListener('click', () => {
      const anchor = el('btn-focus-category');
      showDropdown(anchor, cats.map(c => ({
        label: `${c.icon} ${c.name}`,
        onPick: () => {
          focusCategoryId = c.id;
          el('btn-focus-category').textContent = `Category: ${c.name}`;
          el('btn-focus-subcategory').hidden = false;
          void refreshStatus();
        },
      })));
    }, { once: true });
  }

  // ── Web app links ─────────────────────────────────────────────────────────
  el('btn-web-leaderboard').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://roamtheweb.app/leaderboard' });
    window.close();
  });
  el('btn-web-settings').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://roamtheweb.app/settings' });
    window.close();
  });

  // ── Translate this page (one-shot, does not change the persisted setting) ──
  el('btn-translate-page').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url) return;
    const lang = await chrome.storage.local.get('translate_language');
    const tl = (lang.translate_language as string) || DEFAULT_LANGUAGE;
    const translated = `https://translate.google.com/translate?sl=auto&tl=${tl}&u=${encodeURIComponent(tab.url)}`;
    chrome.tabs.update(tab.id, { url: translated });
    window.close();
  });
});