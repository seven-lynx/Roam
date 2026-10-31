'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useWorkstation } from '@/components/WorkstationContext';
import { Window } from '@/components/Window';

/**
 * Feedback window. Open state lives in the workstation context so the COMMS
 * key on the deck can open it; this renders the window chrome + form.
 */
export default function FeedbackWidget() {
  const { session } = useAuth();
  const { isOpen } = useWorkstation();
  const open = isOpen('feedback');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorText, setErrorText] = useState('');

  // Start every opening with a clean form.
  useEffect(() => {
    if (!open) return;
    setMessage('');
    setEmail('');
    setStatus('idle');
    setErrorText('');
  }, [open]);

  async function submit() {
    if (!message.trim()) return;
    setStatus('sending');
    setErrorText('');

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      };
      if (session) headers['Authorization'] = `Bearer ${session.access_token}`;

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/feedback`,
        {
          method: 'POST',
          headers,
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

  if (!open) return null;

  return (
    <Window id="feedback" icon={<span aria-hidden="true">☰</span>}>
      <div className="window-scroll">
        <div className="p-5 flex flex-col gap-4">
          {status === 'sent' ? (
            <p className="text-ok text-sm py-4 text-center">Thanks! We read every message.</p>
          ) : (
            <>
              <p className="text-sm text-muted">Bug, suggestion, or just saying hi — we read everything.</p>

              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={2000}
                rows={5}
                placeholder="What's on your mind?"
                className="field resize-y text-sm"
              />
              <p className="text-xs text-muted text-right -mt-2">{message.length} / 2000</p>

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email (optional — for follow-up)"
                className="field"
              />

              {status === 'error' && <p className="text-danger text-sm">{errorText}</p>}

              <button
                onClick={submit}
                disabled={!message.trim() || status === 'sending'}
                className="btn btn-primary text-sm py-2.5 w-full disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {status === 'sending' ? 'Sending…' : 'Send feedback'}
              </button>
            </>
          )}
        </div>
      </div>
    </Window>
  );
}