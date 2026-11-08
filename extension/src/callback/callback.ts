// callback.ts - OAuth callback handler
//
// Runs as a tab on chrome-extension://<id>/callback.html after Supabase redirects
// back from Google. It hands the PKCE code (or the implicit-grant tokens) to the
// service worker, then lands that same tab on the web app's profile page.

const PROFILE_URL = 'https://roamtheweb.app/profile';
const AUTH_FLOW_KEY = 'auth_flow';

const urlParams = new URLSearchParams(location.hash.slice(1) || location.search.slice(1));
const accessToken = urlParams.get('access_token');
const refreshToken = urlParams.get('refresh_token');
const code = urlParams.get('code');
const errorMsg = urlParams.get('error_description') || urlParams.get('error');

const errorDiv = document.getElementById('error')!;
const closeBtn = document.getElementById('closeBtn')!;
const spinner = document.getElementById('spinner')!;
const headingEl = document.getElementById('heading')!;
const subtitleEl = document.getElementById('subtitle')!;

/** One round-trip to the SW; rejects instead of hanging if it never answers. */
async function askBackground(payload: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const timeout = new Promise<never>((_resolve, reject) =>
    setTimeout(() => reject(new Error('Service worker response timeout')), 10000)
  );
  return Promise.race([
    chrome.runtime.sendMessage(payload),
    timeout,
  ]) as Promise<{ ok: boolean; error?: string }>;
}

/** Clears the pending-flow marker and sends this tab to the web app. */
async function finishSignIn(): Promise<void> {
  try {
    await chrome.storage.session.remove(AUTH_FLOW_KEY);
  } catch { /* best effort - an expired marker is ignored by signInWithOAuth */ }
  spinner.style.display = 'none';
  headingEl.textContent = 'Signed in';
  subtitleEl.textContent = "You're all set - taking you to your profile.";
  setTimeout(() => { location.replace(PROFILE_URL); }, 400);
}

async function handleCallback(): Promise<void> {
  if (errorMsg) {
    showError(errorMsg);
    return;
  }

  // Supabase sent the session directly (implicit grant)
  if (accessToken && refreshToken) {
    try {
      const response = await askBackground({ type: 'SAVE_SESSION', accessToken, refreshToken });
      if (!response.ok) {
        showError(response.error || 'Unknown error during session save');
        return;
      }
      await finishSignIn();
    } catch (err) {
      showError((err as Error).message);
    }
    return;
  }

  // PKCE: exchange the authorization code for a session
  if (code) {
    try {
      const response = await askBackground({ type: 'EXCHANGE_CODE', code });
      if (!response.ok) {
        showError(response.error || 'Unknown error during code exchange');
        return;
      }
      await finishSignIn();
    } catch (err) {
      showError((err as Error).message);
    }
    return;
  }

  showError(
    'No authorization code found. Add this URL to Supabase > Authentication > URL Configuration > Redirect URLs: ' +
    chrome.runtime.getURL('callback.html')
  );
}

function showError(text: string): void {
  spinner.style.display = 'none';
  headingEl.textContent = 'Sign-in failed';
  subtitleEl.textContent = 'The extension could not finish signing you in.';
  errorDiv.textContent = text;
  errorDiv.classList.add('show');
  closeBtn.classList.add('show');
}

// A tab opened by the extension cannot close itself with window.close(), so the
// tab is closed through the tabs API instead.
closeBtn.addEventListener('click', async () => {
  const tab = await chrome.tabs.getCurrent();
  if (tab?.id !== undefined) {
    await chrome.tabs.remove(tab.id);
    return;
  }
  window.close();
});

handleCallback();
