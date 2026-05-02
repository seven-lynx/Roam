// popup.ts — Roam extension popup entry point

import '../lib/sentry'; // must be first — initialises Sentry if SENTRY_DSN is set
import { Sentry } from '../lib/sentry';
import { sendToBackground } from '../lib/messages';
import type { StateData, RoamData, CheckUrlData, Collection, CategoryItem, ProfileData } from '../lib/messages';
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

type AppState = 'signedout' | 'auth' | 'email-auth' | 'categories' | 'error' | 'noresults' | 'main' | 'feedback';

function showState(name: AppState) {
  for (const s of ['signedout', 'auth', 'email-auth', 'categories', 'error', 'noresults', 'main', 'feedback'] as const) {
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

// Context for categories screen: 'firsttime' (post sign-in) or 'settings' (from config panel)
let categoriesContext: 'firsttime' | 'settings' = 'firsttime';

// FALLBACK_CATEGORIES imported from ../lib/constants

async function checkAndRouteAfterSignIn(): Promise<void> {
  const [cats, allCats] = await Promise.all([
    sendToBackground<{ categoryIds: string[] }>({ type: 'GET_USER_CATEGORIES' }),
    sendToBackground<CategoryItem[]>({ type: 'GET_CATEGORIES' }),
  ]);
  const selectedIds = cats.ok ? cats.data.categoryIds : [];
  const categoryItems = allCats.ok && allCats.data.length > 0 ? allCats.data : FALLBACK_CATEGORIES;
  if (cats.ok && selectedIds.length > 0) {
    populateCategoryChips(selectedIds, categoryItems);
    showState('main');
  } else {
    categoriesContext = 'firsttime';
    populateCategoryChips(selectedIds, categoryItems);
    el('btn-back-categories').hidden = true;
    showState('categories');
  }
}

function populateCategoryChips(selectedIds: string[], categories: CategoryItem[]) {
  const container = el('category-select-chips');
  while (container.firstChild) container.removeChild(container.firstChild);
  for (const cat of categories) {
    const btn = document.createElement('button');
    btn.className = 'chip' + (selectedIds.includes(cat.id) ? ' selected' : '');
    btn.dataset.catId = cat.id;
    btn.textContent = `${cat.icon} ${cat.name}`;
    container.appendChild(btn);
  }
  const saveBtn = document.getElementById('btn-save-categories') as HTMLButtonElement | null;
  if (saveBtn) saveBtn.disabled = selectedIds.length === 0;
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

  // ── No-results "Edit categories" button ───────────────────────────────────
  el('btn-add-categories').addEventListener('click', async () => {
    categoriesContext = 'settings';
    const [cats, allCats] = await Promise.all([
      sendToBackground<{ categoryIds: string[] }>({ type: 'GET_USER_CATEGORIES' }),
      sendToBackground<CategoryItem[]>({ type: 'GET_CATEGORIES' }),
    ]);
    populateCategoryChips(
      cats.ok ? cats.data.categoryIds : [],
      allCats.ok && allCats.data.length > 0 ? allCats.data : FALLBACK_CATEGORIES,
    );
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

  // ── Categories: save ─────────────────────────────────────────────────────
  el('btn-save-categories').addEventListener('click', async () => {
    const selected = Array.from(
      el('category-select-chips').querySelectorAll<HTMLButtonElement>('.chip.selected')
    ).map((c) => c.dataset.catId!);

    const saveBtn = el<HTMLButtonElement>('btn-save-categories');
    saveBtn.disabled = true;
    const errEl = el<HTMLParagraphElement>('categories-error');
    errEl.hidden = true;

    const res = await sendToBackground({ type: 'SET_USER_CATEGORIES', categoryIds: selected });
    saveBtn.disabled = false;
    if (!res.ok) {
      errEl.textContent = res.error;
      errEl.hidden = false;
      return;
    }
    showPanel(null);
    showState('main');
  });

  // ── Categories: back button ───────────────────────────────────────────────
  el('btn-back-categories').addEventListener('click', () => {
    if (categoriesContext === 'settings') {
      showPanel('config');
      showState('main');
    }
    // In firsttime mode the button is hidden — nothing to do
  });

  // ── Roam button ───────────────────────────────────────────────────────────
  el('btn-roam').addEventListener('click', async () => {
    showPanel(null);
    el<HTMLButtonElement>('btn-roam').disabled = true;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const res = await sendToBackground<RoamData>({ type: 'ROAM' });
    console.log('[roam-popup] Roam response:', res);
    el<HTMLButtonElement>('btn-roam').disabled = false;
    if (!res.ok) { showError(res.error); return; }
    if (!res.data?.url) { showState('noresults'); return; }
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

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url ?? '';

    // Fire roam immediately; run the check+rate in parallel to minimise wait time
    const roamPromise = sendToBackground<RoamData>({ type: 'ROAM' });
    if (url) {
      const check = await sendToBackground<CheckUrlData>({ type: 'CHECK_URL', url });
      if (check.ok && check.data.known && check.data.url_id) {
        await sendToBackground({ type: 'RATE', url_id: check.data.url_id, vote: -1 });
      }
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
    // Load collections and show dropdown
    await loadCollectionsForDropdown();

    // Create a temporary dropdown menu
    const menu = document.createElement('div');
    menu.style.cssText = `
      position: absolute;
      top: 100%;
      left: 6px;
      right: 6px;
      background: var(--bg-panel);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      margin-top: 4px;
      z-index: 1000;
      max-height: 200px;
      overflow-y: auto;
    `;

    // Add existing collections
    loadedCollections.forEach((col) => {
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
        border-radius: 0;
      `;
      option.textContent = col.name + ' ';
      const countSpan = document.createElement('span');
      countSpan.style.color = 'var(--text-muted)';
      countSpan.style.fontSize = '11px';
      countSpan.textContent = `(${col.item_count})`;
      option.appendChild(countSpan);
      option.addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.url) return;
        const res = await sendToBackground({ type: 'ADD_URL_TO_COLLECTION', url: tab.url, collectionId: col.id });
        menu.remove();
        if (res.ok) {
          window.close();
        } else {
          showError(res.error ?? "Couldn't add to collection.");
        }
      });
      option.addEventListener('mouseover', () => option.style.background = 'var(--bg-hover)');
      option.addEventListener('mouseout', () => option.style.background = 'transparent');
      menu.appendChild(option);
    });

    // Add "New collection" option
    const divider = document.createElement('div');
    divider.style.cssText = 'height: 1px; background: var(--border); margin: 4px 0;';
    menu.appendChild(divider);

    const newColOption = document.createElement('button');
    newColOption.style.cssText = `
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
    newColOption.textContent = '+ New collection';
    newColOption.addEventListener('click', async () => {
      const name = prompt('Collection name:');
      if (!name) return;
      const res = await sendToBackground<Collection>({ type: 'CREATE_COLLECTION', name });
      if (!res.ok) { showError(res.error ?? "Couldn't create collection."); menu.remove(); return; }
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url) { menu.remove(); return; }
      const addRes = await sendToBackground({ type: 'ADD_URL_TO_COLLECTION', url: tab.url, collectionId: res.data.id });
      menu.remove();
      if (addRes.ok) {
        window.close();
      } else {
        showError(addRes.error ?? "Couldn't add to collection.");
      }
    });
    menu.appendChild(newColOption);

    // Position menu relative to button
    const btn = el<HTMLButtonElement>('btn-add-collection');
    const btnRect = btn.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = (btnRect.bottom + 4) + 'px';
    menu.style.left = (btnRect.left) + 'px';
    menu.style.width = btnRect.width + 'px';

    document.body.appendChild(menu);

    // Close menu on click outside
    document.addEventListener('click', (e) => {
      if (!menu.contains(e.target as Node) && e.target !== btn) {
        menu.remove();
      }
    }, { once: true });
  });

  el('btn-save-later').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return;
    const res = await sendToBackground({ type: 'SAVE_LATER', url: tab.url });
    if (res.ok) {
      window.close();
    }
  });

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
    if (tab?.id) chrome.tabs.update(tab.id, { url: res.data.url });
    window.close();
  });

  el('btn-roam-collection').addEventListener('click', async () => {
    // Load collections and show dropdown
    await loadCollectionsForDropdown();

    if (loadedCollections.length === 0) {
      showError('No collections yet. Create one from the web app.');
      return;
    }

    // Create a temporary dropdown menu
    const menu = document.createElement('div');
    menu.style.cssText = `
      position: absolute;
      top: 100%;
      left: 6px;
      right: 6px;
      background: var(--bg-panel);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      margin-top: 4px;
      z-index: 1000;
      max-height: 200px;
      overflow-y: auto;
    `;

    loadedCollections.forEach((col) => {
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
      option.textContent = `${col.name} (${col.item_count})`;
      option.addEventListener('click', async () => {
        const res = await sendToBackground<RoamData>({
          type: 'ROAM_COLLECTION',
          collectionId: col.id,
        });
        menu.remove();
        if (!res.ok) { showError(res.error); return; }
        if (!res.data?.url) { showState('noresults'); return; }
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) chrome.tabs.update(tab.id, { url: res.data.url });
        window.close();
      });
      option.addEventListener('mouseover', () => option.style.background = 'var(--bg-hover)');
      option.addEventListener('mouseout', () => option.style.background = 'transparent');
      menu.appendChild(option);
    });

    // Position menu
    const btn = el<HTMLButtonElement>('btn-roam-collection');
    const btnRect = btn.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = (btnRect.bottom + 4) + 'px';
    menu.style.left = (btnRect.left) + 'px';
    menu.style.width = btnRect.width + 'px';

    document.body.appendChild(menu);

    // Close menu on click outside
    document.addEventListener('click', (e) => {
      if (!menu.contains(e.target as Node) && e.target !== btn) {
        menu.remove();
      }
    }, { once: true });
  });

  el('btn-manage-collections').addEventListener('click', async () => {
    const res = await sendToBackground<ProfileData>({ type: 'GET_PROFILE' });
    const url = res.ok
      ? `https://roamtheweb.app/u/${res.data.username}`
      : 'https://roamtheweb.app';
    chrome.tabs.create({ url });
    window.close();
  });

  el('btn-category-prefs').addEventListener('click', async () => {
    categoriesContext = 'settings';
    const [cats, allCats] = await Promise.all([
      sendToBackground<{ categoryIds: string[] }>({ type: 'GET_USER_CATEGORIES' }),
      sendToBackground<CategoryItem[]>({ type: 'GET_CATEGORIES' }),
    ]);
    populateCategoryChips(
      cats.ok ? cats.data.categoryIds : [],
      allCats.ok && allCats.data.length > 0 ? allCats.data : FALLBACK_CATEGORIES,
    );
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

  // ── Language picker ───────────────────────────────────────────────────────
  const btnLangs    = el<HTMLButtonElement>('btn-languages');
  const panelLangs  = el<HTMLDivElement>('panel-languages');
  const langBoxes   = Array.from(
    panelLangs.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
  );

  // Names for summary label
  const LANG_NAMES: Record<string, string> = {
    en: 'English', fr: 'Français', de: 'Deutsch', it: 'Italiano',
    es: 'Español', pt: 'Português', nl: 'Nederlands', pl: 'Polski',
    ja: '日本語', zh: '中文', ru: 'Русский', ko: '한국어',
  };

  function updateLangSummary() {
    const selected = langBoxes.filter((c) => c.checked).map((c) => LANG_NAMES[c.value] ?? c.value);
    btnLangs.textContent = selected.length === 0 ? 'English' : selected.join(', ');
  }

  // Load saved preferences from storage
  chrome.storage.local.get(['skip_paywalled', 'preferred_languages'], (stored) => {
    if (stored.skip_paywalled) {
      el<HTMLInputElement>('toggle-paywall').checked = true;
    }
    if (Array.isArray(stored.preferred_languages)) {
      langBoxes.forEach((cb) => {
        cb.checked = stored.preferred_languages.includes(cb.value);
      });
      updateLangSummary();
    }
  });

  // Toggle picker open/closed
  btnLangs.addEventListener('click', () => {
    const open = !panelLangs.hidden;
    panelLangs.hidden = open;
    btnLangs.setAttribute('aria-expanded', String(!open));
  });

  // On each checkbox change: enforce at least one selected, save, update label
  langBoxes.forEach((cb) => {
    cb.addEventListener('change', async () => {
      const selected = langBoxes.filter((c) => c.checked).map((c) => c.value);
      // Ensure at least English is always included
      if (selected.length === 0) {
        langBoxes.find((c) => c.value === 'en')!.checked = true;
      }
      const final = langBoxes.filter((c) => c.checked).map((c) => c.value);
      updateLangSummary();
      await sendToBackground({ type: 'SET_LANGUAGE_PREF', languages: final });
    });
  });
});

