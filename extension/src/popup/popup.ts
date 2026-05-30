// popup.ts — Roam extension popup entry point

import '../lib/sentry'; // must be first — initialises Sentry if SENTRY_DSN is set
import { Sentry } from '../lib/sentry';
import { sendToBackground } from '../lib/messages';
import type { StateData, RoamData, CheckUrlData, Collection, CategoryItem, ProfileData, SubcategoryItem, SavedUrlItem } from '../lib/messages';
import { FALLBACK_CATEGORIES } from '../lib/constants';

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

type AppState = 'signedout' | 'auth' | 'email-auth' | 'categories' | 'error' | 'noresults' | 'main' | 'feedback' | 'saved';

function showState(name: AppState) {
  for (const s of ['signedout', 'auth', 'email-auth', 'categories', 'error', 'noresults', 'main', 'feedback', 'saved'] as const) {
    el(`state-${s}`).hidden = s !== name;
  }
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

function showError(message: string) {
  const span = document.querySelector<HTMLElement>('#state-error .error-msg');
  if (span) span.textContent = message;
  // Capture user-visible errors as warnings (not errors) so beta issues surface in Sentry
  // without inflating the error count. The underlying bg errors are already captured as
  // errors by the dispatch() wrapper in background.ts.
  Sentry.captureMessage(`popup error shown: ${message}`, {
    level: 'warning',
    tags: { context: 'showError' },
  });
  showState('error');
}

function showDropdown(
  anchor: HTMLElement,
  items: { label: string; onPick: () => void }[],
  footer?: HTMLElement
): void {
  const menu = document.createElement('div');
  menu.style.cssText = `
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    z-index: 1000;
    max-height: 200px;
    overflow-y: auto;
  `;
  items.forEach(({ label, onPick }) => {
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

// Context for categories screen: 'firsttime' (post sign-in) or 'settings' (from config panel)
let categoriesContext: 'firsttime' | 'settings' = 'firsttime';

// Category list populated on sign-in; used for status bar label lookups
let loadedCategories: CategoryItem[] = [];

// Subcategory list for topics mode (loaded lazily)
let loadedSubcategories: SubcategoryItem[] = [];

// Current interest mode shown in the categories screen
let currentInterestMode: 'pillars' | 'topics' = 'pillars';

// Focus mode — ephemeral, resets on popup close
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

// FALLBACK_CATEGORIES imported from ../lib/constants

async function checkAndRouteAfterSignIn(): Promise<void> {
  const [interests, allCats, allSubcats, sessionPrefs] = await Promise.all([
    sendToBackground<{ mode: 'pillars' | 'topics'; pillarIds: string[]; topicIds: string[] }>({ type: 'GET_USER_INTERESTS' }),
    sendToBackground<CategoryItem[]>({ type: 'GET_CATEGORIES' }),
    sendToBackground<SubcategoryItem[]>({ type: 'GET_ALL_SUBCATEGORIES' }),
    chrome.storage.session.get(['auto_translate']),
  ]);
  el<HTMLInputElement>('toggle-translate').checked = sessionPrefs.auto_translate === true;
  const categoryItems = allCats.ok && allCats.data.length > 0 ? allCats.data : FALLBACK_CATEGORIES;
  loadedCategories = categoryItems;
  if (allSubcats.ok) loadedSubcategories = allSubcats.data;

  if (interests.ok && (interests.data.pillarIds.length > 0 || interests.data.topicIds.length > 0)) {
    currentInterestMode = interests.data.mode;
    populateInterestChips(interests.data.mode, interests.data.pillarIds, interests.data.topicIds, categoryItems, loadedSubcategories);
    showState('main');
    void refreshStatus();
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
    // Group subcategories by category
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
}

/** @deprecated Use populateInterestChips instead */
function populateCategoryChips(selectedIds: string[], categories: CategoryItem[]) {
  populateInterestChips('pillars', selectedIds, [], categories, []);
}

async function boot() {
  console.log('[roam-popup] Booting, checking session state');
  const res = await sendToBackground<StateData>({ type: 'GET_STATE' });
  console.log('[roam-popup] Boot GET_STATE response:', res);
  if (!res.ok) { showError(res.error); return; }
  if (!res.data.signedIn) {
    showState('signedout');
    return;
  }
  await checkAndRouteAfterSignIn();
}

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Keep the background service worker alive while the popup is open.
  // MV3 service workers are terminated after ~30 s of inactivity; an open port
  // prevents that, so messages sent later (e.g. SIGN_IN_GOOGLE) always land.
  try { chrome.runtime.connect({ name: 'popup-keepalive' }); } catch { /* ignore */ }

  // Ask the background SW for the current auth state and show the right view.
  boot();

  // ── Sign in button → show auth method selection ───────────────────────────
  el('btn-signin').addEventListener('click', () => {
    showState('auth');
  });

  // ── Retry button ───────────────────────────────────────────────────────────
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

  // ── Auth: back to signed-out ───────────────────────────────────────────────
  el('btn-back-auth').addEventListener('click', () => showState('signedout'));

  // ── Auth: back email → back to auth methods ───────────────────────────────
  el('btn-back-email').addEventListener('click', () => showState('auth'));

  // ── Auth: Google OAuth ────────────────────────────────────────────────────
  async function startOAuthFlow(provider: 'google' | 'github') {
    const buttons = ['btn-auth-google', 'btn-auth-github', 'btn-auth-email'];
    buttons.forEach((id) => (el<HTMLButtonElement>(id).disabled = true));
    el('auth-waiting').hidden = false;

    const msgType = provider === 'google' ? 'SIGN_IN_GOOGLE' : 'SIGN_IN_GITHUB';
    const res = await sendToBackground<StateData>({ type: msgType });
    if (!res.ok) {
      buttons.forEach((id) => (el<HTMLButtonElement>(id).disabled = false));
      el('auth-waiting').hidden = true;
      showError(res.error);
      return;
    }

    // Poll until the callback tab completes and session is saved
    const pollInterval = setInterval(async () => {
      const state = await sendToBackground<StateData>({ type: 'GET_STATE' });
      if (state.ok && state.data.signedIn) {
        clearInterval(pollInterval);
        await checkAndRouteAfterSignIn();
      }
    }, 500);
    setTimeout(() => clearInterval(pollInterval), 5 * 60 * 1000);
  }

  el('btn-auth-google').addEventListener('click', () => startOAuthFlow('google'));
  el('btn-auth-github').addEventListener('click', () => startOAuthFlow('github'));

  // ── Auth: show email form ─────────────────────────────────────────────────
  el('btn-auth-email').addEventListener('click', () => {
    // Reset email form state
    el<HTMLInputElement>('input-email').value = '';
    el<HTMLInputElement>('input-password').value = '';
    el('email-auth-error').hidden = true;
    el('email-verify-msg').hidden = true;
    el<HTMLButtonElement>('btn-email-submit').textContent = 'Sign in';
    el('tab-signin').classList.add('auth-tab--active');
    el('tab-signup').classList.remove('auth-tab--active');
    showState('email-auth');
  });

  // ── Email auth: tab switching ─────────────────────────────────────────────
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

  // ── Email auth: submit ────────────────────────────────────────────────────
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
        // Immediately signed in
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
  });

  // ── Interest mode toggle ──────────────────────────────────────────────────
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

  // ── Categories: save ─────────────────────────────────────────────────────
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

    const res = await sendToBackground({ type: 'SET_USER_INTERESTS', pillarIds, topicIds });
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

  // ── Categories: back button ───────────────────────────────────────────────
  el('btn-back-categories').addEventListener('click', () => {
    if (categoriesContext === 'settings') {
      showPanel('config');
      showState('main');
      void refreshStatus();
    }
    // In firsttime mode the button is hidden — nothing to do
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
    console.log('[roam-popup] Roam response:', res);
    roamBtn.disabled = false;
    roamBtn.textContent = 'Roam';
    if (!res.ok) { showError(res.error); return; }
    if (!res.data?.url) { showState('noresults'); return; }
    // Background has already reset auto_translate; sync the UI toggle
    el<HTMLInputElement>('toggle-translate').checked = false;
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
    if (!check.ok) { showError(check.error); return; }

    if (check.data.known && check.data.url_id) {
      // Known URL → rate +1; wait for both the flash and the rate call before closing
      await Promise.all([
        flashDone,
        sendToBackground({ type: 'RATE', url_id: check.data.url_id, vote: 1 }),
      ]);
      window.close();
    } else {
      // Unknown URL → wait for flash, then show submit panel
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

    // Fire roam and check+rate fully in parallel — navigate the instant roam resolves,
    // without blocking on the rating round-trip.
    const roamPromise = sendToBackground<RoamData>({
      type: 'ROAM',
      ...(focusModeEnabled && focusCategoryId ? { categoryId: focusCategoryId } : {}),
      ...(focusModeEnabled && focusSubcategoryId ? { subcategoryId: focusSubcategoryId } : {}),
    });
    if (url) {
      // Fire-and-forget: rating doesn't need to complete before we navigate away.
      sendToBackground<CheckUrlData>({ type: 'CHECK_URL', url }).then((check) => {
        if (check.ok && check.data.known && check.data.url_id) {
          sendToBackground({ type: 'RATE', url_id: check.data.url_id, vote: -1 });
        }
      });
    }

    const roamRes = await roamPromise;
    if (!roamRes.ok) { showError(roamRes.error); return; }
    if (!roamRes.data?.url) { showState('noresults'); return; }
    if (tab?.id) chrome.tabs.update(tab.id, { url: roamRes.data.url });
    window.close();
  });

  // ── Config toggle ─────────────────────────────────────────────────────────
  el('btn-config').addEventListener('click', () => {
    const open = el('panel-config').hidden;
    showPanel(open ? 'config' : null);
  });

  // ── Submit panel chips: populate from FALLBACK_CATEGORIES (real UUIDs) ──────
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

  // ── Category chip selection ────────────────────────────────────────────────
  let selectedCategory: string | null = null;
  el('category-chips').addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLButtonElement>('.chip');
    if (!chip) return;
    el('category-chips').querySelectorAll('.chip').forEach((c) => c.classList.remove('selected'));
    chip.classList.add('selected');
    selectedCategory = chip.dataset.catId ?? null;
    el<HTMLButtonElement>('btn-submit').disabled = false;
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
    const res = await sendToBackground({ type: 'SUBMIT_URL', url, categoryId: selectedCategory });
    el<HTMLButtonElement>('btn-submit').disabled = false;
    if (!res.ok) {
      // Show inline error — Safe Browsing rejection or rate-limit
      submitErr.textContent = res.error.includes('safe') || res.error.includes('Safe')
        ? 'This URL was flagged by Google Safe Browsing and cannot be submitted.'
        : res.error.includes('429') || res.error.includes('rate')
          ? 'You\'ve submitted too many URLs recently. Try again in an hour.'
          : res.error;
      submitErr.hidden = false;
      return;
    }
    window.close();
  });

  // ── Config panel actions ──────────────────────────────────────────────────
  
  // Keep track of loaded collections for add/roam operations
  let loadedCollections: Collection[] = [];

  async function loadCollectionsForDropdown(): Promise<void> {
    const res = await sendToBackground<Collection[]>({ type: 'GET_COLLECTIONS' });
    if (res.ok) {
      loadedCollections = res.data;
    } else {
      console.error('Failed to load collections:', res.error);
    }
  }

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
      if (!res.ok) { showError(res.error ?? "Couldn't create collection."); return; }
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url) return;
      const addRes = await sendToBackground({ type: 'ADD_URL_TO_COLLECTION', url: tab.url, collectionId: res.data.id });
      if (addRes.ok) { window.close(); } else { showError(addRes.error ?? "Couldn't add to collection."); }
    });

    const anchor = el<HTMLButtonElement>('btn-add-collection');
    showDropdown(
      anchor,
      loadedCollections.map(col => ({
        label: `${col.name} (${col.item_count})`,
        onPick: async () => {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!tab?.url) return;
          const res = await sendToBackground({ type: 'ADD_URL_TO_COLLECTION', url: tab.url, collectionId: col.id });
          if (res.ok) { window.close(); } else { showError(res.error ?? "Couldn't add to collection."); }
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
      window.close();
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
      list.addEventListener('click', async (e) => {
        const btn = (e.target as HTMLElement).closest('.saved-item-remove') as HTMLElement | null;
        if (!btn?.dataset.id) return;
        const id = btn.dataset.id;
        const res2 = await sendToBackground<null>({ type: 'REMOVE_SAVED_URL', savedUrlId: id });
        if (res2.ok) {
          const row = list.querySelector(`[data-id="${id}"]`) as HTMLElement | null;
          if (row) row.remove();
          if (!list.children.length) empty.hidden = false;
        }
      });
    }
    showState('saved');
  });

  el('btn-back-saved').addEventListener('click', () => showState('main'));

  el('btn-share').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) await navigator.clipboard.writeText(tab.url);
    window.close();
  });

  el('btn-roam-category').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url ?? '';
    if (!url) return;

    // Check if current URL is known to get its category
    const check = await sendToBackground<CheckUrlData>({ type: 'CHECK_URL', url });
    if (!check.ok || !check.data.category_id) {
      showError('Couldn\'t determine a category for this page. Try a different one.');
      return;
    }

    // Roam within this category
    const res = await sendToBackground<RoamData>({
      type: 'ROAM_CATEGORY',
      categoryId: check.data.category_id,
    });
    if (!res.ok) { showError(res.error); return; }
    if (!res.data?.url) { showState('noresults'); return; }
    if (tab?.id) chrome.tabs.update(tab.id, { url: res.data.url });
    window.close();
  });

  el('btn-roam-collection').addEventListener('click', async () => {
    await loadCollectionsForDropdown();

    if (loadedCollections.length === 0) {
      showError('No collections yet. Create one from the web app.');
      return;
    }

    const anchor = el<HTMLButtonElement>('btn-roam-collection');
    showDropdown(
      anchor,
      loadedCollections.map(col => ({
        label: `${col.name} (${col.item_count})`,
        onPick: async () => {
          const res = await sendToBackground<RoamData>({ type: 'ROAM_COLLECTION', collectionId: col.id });
          if (!res.ok) { showError(res.error); return; }
          if (!res.data?.url) { showState('noresults'); return; }
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab?.id) chrome.tabs.update(tab.id, { url: res.data.url });
          window.close();
        },
      }))
    );
  });

  el('btn-manage-collections').addEventListener('click', () => {
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

    if (!url) {
      btn.disabled = false;
      btn.textContent = 'Report broken link';
      return;
    }

    const check = await sendToBackground<CheckUrlData>({ type: 'CHECK_URL', url });
    if (!check.ok || !check.data.known || !check.data.url_id) {
      btn.disabled = false;
      btn.textContent = 'Report broken link';
      return;
    }

    const res = await sendToBackground({ type: 'REPORT_URL', url_id: check.data.url_id });
    if (!res.ok) {
      btn.disabled = false;
      btn.textContent = 'Report broken link';
      return;
    }

    // Show confirmation, then roam to the next URL
    btn.textContent = 'Reported ✓ — skipping…';
    showPanel(null);
    const roamRes = await sendToBackground<RoamData>({ type: 'ROAM' });
    if (!roamRes.ok) { showError(roamRes.error); return; }
    if (!roamRes.data?.url) { showState('noresults'); return; }
    if (tab?.id) chrome.tabs.update(tab.id, { url: roamRes.data.url });
    window.close();
  });

  // ── Feedback ──────────────────────────────────────────────────────────────
  el('btn-send-feedback').addEventListener('click', () => {
    // Reset feedback form
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

    // Detect Firefox vs Chrome for platform tagging
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
    // Auto-return after 2 seconds
    setTimeout(() => {
      showPanel('config');
      showState('main');
    }, 2000);
  });

  // ── Paywall toggle ────────────────────────────────────────────────────────
  el<HTMLInputElement>('toggle-paywall').addEventListener('change', async (e) => {
    const checked = (e.target as HTMLInputElement).checked;
    await sendToBackground({ type: 'SET_PAYWALL_PREF', skip: checked });
  });

  // ── Auto-translate toggle ─────────────────────────────────────────────────
  el<HTMLInputElement>('toggle-translate').addEventListener('change', async (e) => {
    const checked = (e.target as HTMLInputElement).checked;
    await sendToBackground({ type: 'SET_AUTO_TRANSLATE', enabled: checked });
    // Immediately translate or un-translate the current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url) return;

    if (checked) {
      // Don't double-wrap a page that's already going through Translate
      if (!tab.url.startsWith('https://translate.google.com/translate')) {
        const lang = el<HTMLSelectElement>('select-translate-lang').value;
        const translated = `https://translate.google.com/translate?sl=auto&tl=${encodeURIComponent(lang)}&u=${encodeURIComponent(tab.url)}`;
        chrome.tabs.update(tab.id, { url: translated });
        window.close();
      }
    } else {
      // Strip the Translate wrapper and navigate back to the raw URL
      if (tab.url.startsWith('https://translate.google.com/translate')) {
        try {
          const raw = new URL(tab.url).searchParams.get('u');
          if (raw) {
            chrome.tabs.update(tab.id, { url: raw });
            window.close();
          }
        } catch { /* ignore malformed URL */ }
      }
    }  });
  // ── Focus mode ──────────────────────────────────────────────────────────────────
  el<HTMLInputElement>('toggle-focus').addEventListener('change', (e) => {
    focusModeEnabled = (e.target as HTMLInputElement).checked;
    el('focus-pickers').hidden = !focusModeEnabled;
    if (!focusModeEnabled) {
      focusCategoryId = null;
      focusSubcategoryId = null;
      focusSubcategoryName = null;
      el('btn-focus-category').textContent = 'Category: Any';
      el('btn-focus-subcategory').hidden = true;
      el('btn-focus-subcategory').textContent = 'Topic: All';
    }
    void refreshStatus();
  });

  el('btn-focus-category').addEventListener('click', () => {
    if (loadedCategories.length === 0) return;
    showDropdown(
      el<HTMLButtonElement>('btn-focus-category'),
      loadedCategories.map(cat => ({
        label: `${cat.icon} ${cat.name}`,
        onPick: () => {
          focusCategoryId = cat.id;
          focusSubcategoryId = null;
          focusSubcategoryName = null;
          el('btn-focus-category').textContent = `${cat.icon} ${cat.name}`;
          el('btn-focus-subcategory').hidden = false;
          el('btn-focus-subcategory').textContent = 'Topic: All';
          void refreshStatus();
        },
      }))
    );
  });

  el('btn-focus-subcategory').addEventListener('click', async () => {
    if (!focusCategoryId) return;
    const res = await sendToBackground<SubcategoryItem[]>({
      type: 'GET_SUBCATEGORIES',
      categoryId: focusCategoryId,
    });
    const subs = res.ok ? res.data : [];
    showDropdown(
      el<HTMLButtonElement>('btn-focus-subcategory'),
      [
        {
          label: 'All topics',
          onPick: () => {
            focusSubcategoryId = null;
            focusSubcategoryName = null;
            el('btn-focus-subcategory').textContent = 'Topic: All';
            void refreshStatus();
          },
        },
        ...subs.map(sub => ({
          label: sub.name,
          onPick: () => {
            focusSubcategoryId = sub.id;
            focusSubcategoryName = sub.name;
            el('btn-focus-subcategory').textContent = sub.name;
            void refreshStatus();
          },
        })),
      ]
    );
  });
  // ── Translate language picker ─────────────────────────────────────────────
  // Load saved preferences from storage
  chrome.storage.local.get(['skip_paywalled', 'translate_language'], (stored) => {
    if (stored.skip_paywalled) {
      el<HTMLInputElement>('toggle-paywall').checked = true;
    }
    const lang = (stored.translate_language as string) ?? 'en';
    el<HTMLSelectElement>('select-translate-lang').value = lang;
  });

  el<HTMLSelectElement>('select-translate-lang').addEventListener('change', async (e) => {
    const lang = (e.target as HTMLSelectElement).value;
    await chrome.storage.local.set({ translate_language: lang });
  });
});

