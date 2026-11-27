// telemetry-consent.ts — the consent card and the settings toggle (E4).
//
// Two surfaces, one decision, and both only on Firefox: Q4 rules out the same UI on
// Chrome, where the build has no data-collection axis and reporting follows the
// stored preference alone. Every answer goes through `consent.ts`, so the card and
// the toggle cannot disagree about what "on" means.
//
// The markup is looked up through `scope` rather than `document` directly so the
// node-environment suite (vitest.config.ts: `environment: 'node'`) can drive it
// without jsdom, the way ui-theme.test.ts drives `applyTheme(root)`.

import { PLATFORM } from '../lib/sentry-config';
import {
  disableErrorReporting as revokeConsent,
  hasStoredPreference,
  isErrorReportingGranted,
  requestErrorReporting,
} from '../lib/consent';
import { disableErrorReporting as stopReporting, initSentry } from '../lib/sentry';

/** The elements the popup ships for this feature — also the markup contract the test asserts. */
export const CONSENT_IDS = {
  card: 'consent-card',
  cardToggle: 'toggle-consent-card',
  cardSave: 'btn-consent-save',
  cardPrivacy: 'btn-consent-privacy',
  settingsSection: 'settings-privacy',
  settingsToggle: 'toggle-error-reporting',
} as const;

/** Where the card sends a reader who wants the long version. */
const PRIVACY_URL = 'https://roamtheweb.app/privacy';

/** The slice of `document` this module needs. */
export interface ConsentScope {
  getElementById(id: string): HTMLElement | null;
}

interface ConsentElements {
  card: HTMLElement | null;
  cardToggle: HTMLInputElement | null;
  cardSave: HTMLElement | null;
  cardPrivacy: HTMLElement | null;
  settingsSection: HTMLElement | null;
  settingsToggle: HTMLInputElement | null;
}

/** Every lookup tolerates absence: a renamed id must not break the popup's boot. */
function readElements(scope: ConsentScope): ConsentElements {
  return {
    card: scope.getElementById(CONSENT_IDS.card),
    cardToggle: scope.getElementById(CONSENT_IDS.cardToggle) as HTMLInputElement | null,
    cardSave: scope.getElementById(CONSENT_IDS.cardSave),
    cardPrivacy: scope.getElementById(CONSENT_IDS.cardPrivacy),
    settingsSection: scope.getElementById(CONSENT_IDS.settingsSection),
    settingsToggle: scope.getElementById(CONSENT_IDS.settingsToggle) as HTMLInputElement | null,
  };
}

/**
 * Wire the card and the settings toggle. Safe on every build: another browser, or
 * markup that is not there, is a no-op rather than an error.
 */
export async function initTelemetryConsent(scope: ConsentScope = document): Promise<void> {
  // Q4 — no Chrome UI. Its preference is still honoured by `consent.ts`.
  if (PLATFORM !== 'firefox') return;

  const { card, cardToggle, cardSave, cardPrivacy, settingsSection, settingsToggle } =
    readElements(scope);

  /**
   * The single path both surfaces take: record the answer, make the façade agree,
   * then repaint the toggle from the truth — which is how a refused grant reverts a
   * checkbox the user just flipped.
   */
  const apply = async (wanted: boolean): Promise<void> => {
    if (wanted) {
      // Firefox answers with a grant prompt; a refusal leaves reporting off.
      initSentry(await requestErrorReporting());
    } else {
      // Consent first (revoke the grant, store the refusal), façade second.
      await revokeConsent();
      stopReporting();
    }
    if (settingsToggle) settingsToggle.checked = await isErrorReportingGranted();
  };

  if (settingsSection) settingsSection.hidden = false;
  if (settingsToggle) {
    settingsToggle.checked = await isErrorReportingGranted();
    settingsToggle.addEventListener('change', () => {
      void apply(settingsToggle.checked);
    });
  }

  if (card && cardToggle && cardSave) {
    // D5 — reporting is on until the user says otherwise, so the card opens checked.
    cardToggle.checked = true;
    // D9 — one ask. Once an answer is stored (or the grant exists) the card is done
    // for good; the settings toggle is the way back in.
    card.hidden = (await hasStoredPreference()) || (await isErrorReportingGranted());

    cardSave.addEventListener('click', () => {
      void apply(cardToggle.checked).then(() => {
        card.hidden = true;
      });
    });
  }

  if (cardPrivacy) {
    cardPrivacy.addEventListener('click', () => {
      try {
        void chrome.tabs.create({ url: PRIVACY_URL }).catch(() => {
          // A tab that would not open is not worth an event: the choice is intact.
        });
      } catch {
        // A browser without the tabs API has nothing to open.
      }
    });
  }
}
