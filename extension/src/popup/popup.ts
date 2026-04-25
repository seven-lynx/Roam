// popup.ts — Roam extension popup entry point

import { sendToBackground } from '../lib/messages';
import type { StateData, RoamData, CheckUrlData } from '../lib/messages';

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

