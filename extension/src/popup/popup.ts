// popup.ts — Roam extension popup entry point

import { sendToBackground } from '../lib/messages';
import type { StateData } from '../lib/messages';

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
  const res = await sendToBackground<StateData>({ type: 'GET_STATE' });
  if (!res.ok) { showError(res.error); return; }
  showState(res.data.signedIn ? 'main' : 'signedout');
}

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Ask the background SW for the current auth state and show the right view.
  boot();

  // ── Sign in button ─────────────────────────────────────────────────────────
  el('btn-signin').addEventListener('click', async () => {
    el<HTMLButtonElement>('btn-signin').disabled = true;
    const res = await sendToBackground<StateData>({ type: 'SIGN_IN_GOOGLE' });
    if (!res.ok) {
      el<HTMLButtonElement>('btn-signin').disabled = false;
      showError(res.error);
      return;
    }
    showState(res.data.signedIn ? 'main' : 'signedout');
  });

  // ── Retry button ───────────────────────────────────────────────────────────
  el('btn-retry').addEventListener('click', () => boot());

  // ── Roam button ───────────────────────────────────────────────────────────
  el('btn-roam').addEventListener('click', () => {
    // TODO (task 5.8): call background SW → GET /roam → open URL in current tab
    showPanel(null);
    window.close();
  });

  // ── Thumbs up ─────────────────────────────────────────────────────────────
  el('btn-upvote').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url ?? '';

    // TODO (task 5.9 / 5.11): check if URL is in DB; if known → rate +1 and close;
    // if unknown → show submit panel
    const isKnown = false; // placeholder
    if (isKnown) {
      // rate +1
      window.close();
    } else {
      showPanel(el('panel-submit').hidden ? 'submit' : null);
    }
  });

  // ── Thumbs down ───────────────────────────────────────────────────────────
  el('btn-downvote').addEventListener('click', () => {
    // TODO (task 5.10): POST /rate with -1
    showPanel(null);
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
    // TODO (task 5.11): POST /submit-url with { url: tab.url, category: selectedCategory }
    console.log('[roam] submit', tab?.url, selectedCategory);
    showPanel(null);
    window.close();
  });

  // ── Config panel actions ──────────────────────────────────────────────────
  el('btn-add-collection').addEventListener('click', () => {
    // TODO (task 5.12)
  });

  el('btn-save-later').addEventListener('click', () => {
    // TODO (task 5.12)
  });

  el('btn-share').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) await navigator.clipboard.writeText(tab.url);
    window.close();
  });

  el('btn-roam-category').addEventListener('click', () => {
    // TODO (task 5.12)
  });

  el('btn-roam-collection').addEventListener('click', () => {
    // TODO (task 5.12)
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
  el<HTMLInputElement>('toggle-paywall').addEventListener('change', (e) => {
    const checked = (e.target as HTMLInputElement).checked;
    // TODO (task 5.12b): write skip_paywalled preference to Supabase
    console.log('[roam] skip_paywalled:', checked);
  });
});

