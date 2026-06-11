"use client";

import type { EmailLogEntry } from "../actions";

interface AdminEmailProps {
  subject: string;
  body: string;
  sending: boolean;
  result: string | null;
  error: string | null;
  notificationCount: number | null;
  logs: EmailLogEntry[];
  logsLoading: boolean;
  onSubjectChange: (v: string) => void;
  onBodyChange: (v: string) => void;
  onSend: () => Promise<void>;
}

export default function AdminEmail({
  subject, body, sending, result, error, notificationCount,
  logs, logsLoading, onSubjectChange, onBodyChange, onSend,
}: AdminEmailProps) {
  return (
    <div className="flex flex-col gap-8">
      {/* Compose */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1">Send Email to All Users</h2>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-4">
          Sends to every user with email notifications enabled. Emails include an unsubscribe link.
        </p>
        {notificationCount !== null && (
          <div className="mb-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
            <strong>{notificationCount}</strong> user{notificationCount !== 1 ? "s" : ""} with notifications enabled
          </div>
        )}
        <div className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="Subject line"
            value={subject}
            onChange={(e) => { onSubjectChange(e.target.value); }}
            className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
          />
          <textarea
            placeholder={"Write your email in Markdown...\n\n# Heading\n\nThis is **bold** and *italic*."}
            value={body}
            onChange={(e) => { onBodyChange(e.target.value); }}
            rows={12}
            className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 font-mono resize-y"
          />
          <div className="flex items-center gap-4">
            <button onClick={onSend} disabled={sending || !subject.trim() || !body.trim()}
              className="rounded-lg bg-amber-600 text-white py-2.5 px-6 text-sm font-semibold hover:bg-amber-700 disabled:opacity-40 transition-opacity"
            >{sending ? "Sending…" : "Send to All"}</button>
            {result && <p className="text-sm text-green-600 dark:text-green-400">{result}</p>}
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          </div>
        </div>
      </div>

      {/* Preview */}
      {body.trim() && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1">Preview</h2>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-4">Rough preview — email clients may render differently.</p>
          <div className="rounded-lg border border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 p-4 prose prose-sm dark:prose-invert max-w-none text-sm text-zinc-700 dark:text-zinc-300 font-mono whitespace-pre-wrap">
            {body}
          </div>
        </div>
      )}

      {/* History */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1">Email History</h2>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-4">Last 50 sends</p>
        {logsLoading ? (
          <div className="text-center text-zinc-500 py-8">Loading...</div>
        ) : logs.length === 0 ? (
          <div className="rounded-lg border border-zinc-100 dark:border-zinc-800 p-6 text-center text-zinc-400 text-sm">No emails sent yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900">
                  <th className="text-left py-3 px-4 font-semibold text-zinc-700 dark:text-zinc-300">Subject</th>
                  <th className="text-center py-3 px-4 font-semibold text-zinc-700 dark:text-zinc-300 w-20">Sent</th>
                  <th className="text-center py-3 px-4 font-semibold text-zinc-700 dark:text-zinc-300 w-20">Failed</th>
                  <th className="text-right py-3 px-4 font-semibold text-zinc-700 dark:text-zinc-300 w-40">Date</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                    <td className="py-3 px-4 text-zinc-700 dark:text-zinc-300 max-w-xs truncate">{log.subject}</td>
                    <td className="text-center py-3 px-4 tabular-nums">
                      <span className="font-semibold text-green-600 dark:text-green-400">{log.success_count}</span>
                      <span className="text-zinc-400">/{log.recipient_count}</span>
                    </td>
                    <td className="text-center py-3 px-4 tabular-nums">
                      {log.fail_count > 0 ? <span className="font-semibold text-red-600 dark:text-red-400">{log.fail_count}</span> : <span className="text-zinc-400">0</span>}
                    </td>
                    <td className="text-right py-3 px-4 text-xs text-zinc-500 whitespace-nowrap">
                      {new Date(log.sent_at).toLocaleString("en-US", { timeZone: "America/New_York", timeZoneName: "short" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}