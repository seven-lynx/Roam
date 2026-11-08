import { describe, it, expect, afterEach } from 'vitest';
import {
  NOTIFY_ALARM,
  NOTIFY_POLL_MINUTES,
  registerNotificationAlarm,
  setDesktopNotifications,
} from '../background/notify';

interface AlarmStub {
  create: (...args: unknown[]) => void;
  clear: (...args: unknown[]) => Promise<boolean>;
}

interface ChromeStub {
  alarms?: AlarmStub;
  storage: { local: { get: (keys: string) => Promise<Record<string, unknown>> } };
}

// setup.ts installs the chrome stub; the tests below swap individual methods to
// record calls (rule E.4: a new permission must be exercised by a test).
const chromeStub = globalThis.chrome as unknown as ChromeStub;

function alarmStub(): AlarmStub {
  if (!chromeStub.alarms) throw new Error('chrome.alarms stub missing');
  return chromeStub.alarms;
}

describe('registerNotificationAlarm', () => {
  const original = { create: alarmStub().create, clear: alarmStub().clear };
  afterEach(() => {
    alarmStub().create = original.create;
    alarmStub().clear = original.clear;
  });

  it('creates the poll alarm with the documented period', () => {
    const calls: unknown[][] = [];
    alarmStub().create = (...args: unknown[]) => { calls.push(args); };

    registerNotificationAlarm();

    expect(calls).toEqual([[NOTIFY_ALARM, { periodInMinutes: NOTIFY_POLL_MINUTES }]]);
  });

  it('is a no-op when the alarms API is missing', () => {
    const saved = chromeStub.alarms;
    chromeStub.alarms = undefined;
    expect(() => registerNotificationAlarm()).not.toThrow();
    chromeStub.alarms = saved;
  });
});

describe('setDesktopNotifications', () => {
  const original = { create: alarmStub().create, clear: alarmStub().clear };
  afterEach(() => {
    alarmStub().create = original.create;
    alarmStub().clear = original.clear;
  });

  it('stores the off flag and clears the alarm when disabled', async () => {
    const cleared: unknown[] = [];
    alarmStub().clear = async (...args: unknown[]) => { cleared.push(args[0]); return true; };

    const res = await setDesktopNotifications(false);

    expect(res).toEqual({ ok: true, data: null });
    expect(cleared).toEqual([NOTIFY_ALARM]);
    const stored = await chromeStub.storage.local.get('desktop_notifications');
    expect(stored.desktop_notifications).toBe(false);
  });

  it('seeds the watermark and schedules the alarm when enabled', async () => {
    const created: unknown[] = [];
    alarmStub().create = (...args: unknown[]) => { created.push(args[0]); };
    const before = Date.now();

    await setDesktopNotifications(true);

    expect(created).toEqual([NOTIFY_ALARM]);
    const enabled = await chromeStub.storage.local.get('desktop_notifications');
    expect(enabled.desktop_notifications).toBe(true);
    const seen = await chromeStub.storage.local.get('desktop_notifications_seen_at');
    // A fresh watermark stops the existing backlog from replaying on enable.
    expect(Date.parse(seen.desktop_notifications_seen_at as string)).toBeGreaterThanOrEqual(before - 1000);
  });
});
