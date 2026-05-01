'use client';

import { useState } from 'react';

export default function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorText, setErrorText] = useState('');

  function openModal() {
    setMessage('');
    setEmail('');
    setStatus('idle');
    setErrorText('');
    setOpen(true);
  }

  async function submit() {
    if (!message.trim()) return;
    setStatus('sending');
    setErrorText('');

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/feedback`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: message.trim(),
            platform: 'web',
            email: email.trim() || undefined,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setErrorText(data.error ?? 'Something went wrong — please try again.');
        setStatus('error');
        return;
      }
      setStatus('sent');
    } catch {
      setErrorText('Could not reach the server. Check your connection and try again.');
      setStatus('error');
    }
  }

  return (
    <>
      <button
        onClick={openModal}
        className="hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
      >
        Feedback
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-md p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Send feedback</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {status === 'sent' ? (
              <p className="text-green-600 dark:text-green-400 text-sm py-4 text-center">
                Thanks! We read every message.
              </p>
            ) : (
              <>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 -mt-2">
                  Bug, suggestion, or just saying hi — we read everything.
                </p>

                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={2000}
                  rows={5}
                  placeholder="What's on your mind?"
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 text-sm resize-y focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400"
                />
                <p className="text-xs text-zinc-400 text-right -mt-2">{message.length} / 2000</p>

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email (optional — for follow-up)"
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white p-3 text-sm focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400"
                />

                {status === 'error' && (
                  <p className="text-red-500 text-sm">{errorText}</p>
                )}

                <button
                  onClick={submit}
                  disabled={!message.trim() || status === 'sending'}
                  className="rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold py-2.5 text-sm hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {status === 'sending' ? 'Sending…' : 'Send feedback'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
