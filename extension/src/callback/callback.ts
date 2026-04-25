// callback.ts — OAuth callback handler
// Extracts the auth code from the redirect URL and exchanges it for a session

const urlParams = new URLSearchParams(location.hash.slice(1) || location.search.slice(1));
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

  if (!code) {
    showError('No authorization code found. Make sure you added the extension callback URL to Supabase Authentication → URL Configuration. The URL should be: chrome-extension://' + chrome.runtime.id + '/callback.html');
    return;
  }

  try {
    console.log('[roam-callback] Exchanging code for session:', code);
    const timeoutPromise = new Promise((_resolve, reject) =>
      setTimeout(() => reject(new Error('Service worker response timeout. Make sure the extension callback URL is added to Supabase.')), 10000)
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
      // Success — close the tab after 1 second to ensure session is saved
      setTimeout(() => {
        window.close();
      }, 1000);
    }
  } catch (err) {
    showError((err as Error).message);
  }
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
