// callback.ts — OAuth callback handler
// Extracts the auth code from the redirect URL and exchanges it for a session

const urlParams = new URLSearchParams(location.hash.slice(1) || location.search.slice(1));
const code = urlParams.get('code');
const errorMsg = urlParams.get('error_description') || urlParams.get('error');

const errorDiv = document.getElementById('error')!;
const closeBtn = document.getElementById('closeBtn')!;

async function handleCallback() {
  if (errorMsg) {
    showError(errorMsg);
    return;
  }

  if (!code) {
    showError('No authorization code found in redirect URL.');
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'EXCHANGE_CODE',
      code,
    });

    if (!response.ok) {
      showError(response.error);
    } else {
      // Success — close the tab after 1 second
      setTimeout(() => {
        window.close();
      }, 1000);
    }
  } catch (err) {
    showError((err as Error).message);
  }
}

function showError(message: string) {
  errorDiv.textContent = message;
  errorDiv.classList.add('show');
  closeBtn.classList.add('show');

  closeBtn.addEventListener('click', () => {
    window.close();
  });
}

handleCallback();
