// popup.ts — Roam extension popup entry point

import { sendToBackground } from '../lib/messages';
import type { StateData, RoamData, CheckUrlData, Collection } from '../lib/messages';

// ── Helpers ───────────────────────────────────────────────────────────────────
function el<T extends HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Element #${id} not found`);
  return e as T;
}

function showState(name: 'signedout' | 'error' | 'main') {
  for (const s of ['signedout', 'error', 'main'] as const) {
    el(`state-${s}`).hidden = s !== name;
  }
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
  showState(res.data.signedIn ? 'main' : 'signedout');
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

  // ── Roam button ───────────────────────────────────────────────────────────
  el('btn-roam').addEventListener('click', async () => {
    showPanel(null);
    el<HTMLButtonElement>('btn-roam').disabled = true;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const res = await sendToBackground<RoamData>({ type: 'ROAM' });
    console.log('[roam-popup] Roam response:', res);
    el<HTMLButtonElement>('btn-roam').disabled = false;
    if (!res.ok) { showError(res.error); return; }
    if (tab?.id) chrome.tabs.update(tab.id, { url: res.data.url });
    window.close();
  });

  // ── Thumbs up ─────────────────────────────────────────────────────────────
  el('btn-upvote').addEventListener('click', async () => {
    showPanel(null);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url ?? '';
    if (!url) return;

    const check = await sendToBackground<CheckUrlData>({ type: 'CHECK_URL', url });
    if (!check.ok) { showError(check.error); return; }

    if (check.data.known && check.data.url_id) {
      // Known URL → rate +1 and close
      await sendToBackground({ type: 'RATE', url_id: check.data.url_id, vote: 1 });
      window.close();
    } else {
      // Unknown URL → show submit panel so user can pick a category
      showPanel('submit');
    }
  });

  // ── Thumbs down ───────────────────────────────────────────────────────────
  el('btn-downvote').addEventListener('click', async () => {
    showPanel(null);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url ?? '';
    if (!url) { window.close(); return; }

    const check = await sendToBackground<CheckUrlData>({ type: 'CHECK_URL', url });
    if (!check.ok) { showError(check.error); return; }

    if (check.data.known && check.data.url_id) {
      await sendToBackground({ type: 'RATE', url_id: check.data.url_id, vote: -1 });
    }
    // Whether known or unknown, close after downvote
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
    el<HTMLButtonElement>('btn-submit').disabled = true;
    const res = await sendToBackground({ type: 'SUBMIT_URL', url, categoryId: selectedCategory });
    el<HTMLButtonElement>('btn-submit').disabled = false;
    if (!res.ok) {
      showError(res.error);
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
});

