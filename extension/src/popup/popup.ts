// popup.ts — Roam extension popup entry point

import { sendToBackground } from '../lib/messages';
import type { StateData, RoamData, CheckUrlData, Collection } from '../lib/messages';

// ── Helpers ───────────────────────────────────────────────────────────────────
function el<T extends HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Element #${id} not found`);
  return e as T;
}

function showState(name: 'signedout' | 'error' | 'noresults' | 'main') {
  for (const s of ['signedout', 'error', 'noresults', 'main'] as const) {
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
  showState('error');
}

async function boot() {
  console.log('[roam-popup] Booting, checking session state');
  const res = await sendToBackground<StateData>({ type: 'GET_STATE' });
  console.log('[roam-popup] Boot GET_STATE response:', res);
  if (!res.ok) { showError(res.error); return; }
  if (!res.data.signedIn) {
    // First run: user has never opened the extension — send them to /join
    const { roam_visited } = await chrome.storage.local.get('roam_visited');
    if (!roam_visited) {
      await chrome.storage.local.set({ roam_visited: true });
      chrome.tabs.create({ url: 'https://roamtheweb.app/join' });
      window.close();
      return;
    }
    showState('signedout');
    return;
  }
  showState('main');
}

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Ask the background SW for the current auth state and show the right view.
  boot();

  // ── Sign in button ─────────────────────────────────────────────────────────
  el('btn-signin').addEventListener('click', async () => {
    console.log('[roam-popup] Sign in button clicked');
    el<HTMLButtonElement>('btn-signin').disabled = true;
    const res = await sendToBackground<StateData>({ type: 'SIGN_IN_GOOGLE' });
    if (!res.ok) {
      el<HTMLButtonElement>('btn-signin').disabled = false;
      showError(res.error);
      return;
    }
    // A new tab is opening with the OAuth flow.
    // Poll for session state in case the callback completes while popup is open.
    console.log('[roam-popup] Starting session state polling');
    const pollInterval = setInterval(async () => {
      const state = await sendToBackground<StateData>({ type: 'GET_STATE' });
      console.log('[roam-popup] Poll response:', state);
      if (state.ok && state.data.signedIn) {
        console.log('[roam-popup] Session detected, showing main state');
        clearInterval(pollInterval);
        showState('main');
        el<HTMLButtonElement>('btn-signin').disabled = false;
      }
    }, 500);
    // Stop polling after 5 minutes
    setTimeout(() => clearInterval(pollInterval), 5 * 60 * 1000);
  });

  // ── Retry button ───────────────────────────────────────────────────────────
  el('btn-retry').addEventListener('click', () => boot());

  // ── Add categories button (no-results state) ───────────────────────────────
  el('btn-add-categories').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://roamtheweb.app/join' });
    window.close();
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
    if (tab?.id) chrome.tabs.update(tab.id, { url: roamRes.data.url });
    window.close();
  });

  // ── Config toggle ─────────────────────────────────────────────────────────
  el('btn-config').addEventListener('click', () => {
    const open = el('panel-config').hidden;
    showPanel(open ? 'config' : null);
  });

  // ── Category chip selection ────────────────────────────────────────────────
  let selectedCategory: string | null = null;
  el('category-chips').addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLButtonElement>('.chip');
    if (!chip) return;
    el('category-chips').querySelectorAll('.chip').forEach((c) => c.classList.remove('selected'));
    chip.classList.add('selected');
    selectedCategory = chip.dataset.category ?? null;
    el<HTMLButtonElement>('btn-submit').disabled = false;
  });

  // ── Submit unknown URL ────────────────────────────────────────────────────
  el('btn-submit').addEventListener('click', async () => {
    if (!selectedCategory) return;
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
      option.innerHTML = `${col.name} <span style="color: var(--text-muted); font-size: 11px;">(${col.item_count})</span>`;
      option.addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.url) return;
        const res = await sendToBackground({ type: 'ADD_URL_TO_COLLECTION', url: tab.url, collectionId: col.id });
        if (res.ok) {
          // Close the menu and show success
          menu.remove();
          window.close();
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
      if (res.ok) {
        // Reload collections and add URL
        await loadCollectionsForDropdown();
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.url) return;
        await sendToBackground({ type: 'ADD_URL_TO_COLLECTION', url: tab.url, collectionId: res.data.id });
        menu.remove();
        window.close();
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
      showError('Could not determine category for this page');
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
        if (!res.ok) { showError(res.error); return; }
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) chrome.tabs.update(tab.id, { url: res.data.url });
        menu.remove();
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

  el('btn-manage-collections').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://roamtheweb.app/u/me' });
    window.close();
  });

  el('btn-category-prefs').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://roamtheweb.app/join' });
    window.close();
  });

  el('btn-signout').addEventListener('click', async () => {
    await sendToBackground({ type: 'SIGN_OUT' });
    showPanel(null);
    showState('signedout');
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

