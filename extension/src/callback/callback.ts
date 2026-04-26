// callback.ts — OAuth callback handler
// Extracts the session from the redirect URL hash

const urlParams = new URLSearchParams(location.hash.slice(1) || location.search.slice(1));
const accessToken = urlParams.get('access_token');
const refreshToken = urlParams.get('refresh_token');
const code = urlParams.get('code');
const errorMsg = urlParams.get('error_description') || urlParams.get('error');

const errorDiv = document.getElementById('error')!;
const closeBtn = document.getElementById('closeBtn')!;
const spinner = document.getElementById('spinner')!;

async function handleCallback() {
  if (errorMsg) {
    showError(errorMsg);
    return;
  }

  // If we have access_token + refresh_token, Supabase sent the session directly
  if (accessToken && refreshToken) {
    try {
      console.log('[roam-callback] Session received directly from OAuth redirect');
      const timeoutPromise = new Promise((_resolve, reject) =>
        setTimeout(() => reject(new Error('Service worker response timeout')), 10000)
      );
      const response = await Promise.race([
        chrome.runtime.sendMessage({
          type: 'SAVE_SESSION',
          accessToken,
          refreshToken,
        }),
        timeoutPromise,
      ]) as any;

      console.log('[roam-callback] Save session response:', response);
      if (!response.ok) {
        showError(response.error || 'Unknown error during session save');
      } else {
        console.log('[roam-callback] Session saved, closing tab in 1s');
        spinner.style.display = 'none';
        setTimeout(() => {
          window.close();
        }, 1000);
      }
    } catch (err) {
      showError((err as Error).message);
    }
    return;
  }

  // Otherwise, try to exchange a code if present
  if (code) {
    try {
      console.log('[roam-callback] Exchanging code for session:', code);
      const timeoutPromise = new Promise((_resolve, reject) =>
        setTimeout(() => reject(new Error('Service worker response timeout')), 10000)
      );
      const response = await Promise.race([
        chrome.runtime.sendMessage({
          type: 'EXCHANGE_CODE',
          code,
        }),
        timeoutPromise,
      ]) as any;

      console.log('[roam-callback] Exchange response:', response);
      if (!response.ok) {
        showError(response.error || 'Unknown error during code exchange');
      } else {
        console.log('[roam-callback] Session established, closing tab in 1s');
        spinner.style.display = 'none';
        setTimeout(() => {
          window.close();
        }, 1000);
      }
    } catch (err) {
      showError((err as Error).message);
    }
    return;
  }

  // No session data or code found
  showError('No authorization code found. Make sure you added the extension callback URL to Supabase Authentication → URL Configuration. The URL should be: chrome-extension://' + chrome.runtime.id + '/callback.html');
}

function showError(message: string) {
  console.log('[roam-callback] Error:', message);
  spinner.style.display = 'none';
  errorDiv.textContent = message;
  errorDiv.classList.add('show');
  closeBtn.classList.add('show');

  closeBtn.addEventListener('click', () => {
    window.close();
  });
}

handleCallback();
