"use client";

import type { EmailLogEntry } from "../actions";

type EmailFormat = "markdown" | "html";

interface AdminEmailProps {
  subject: string;
  body: string;
  format: EmailFormat;
  testEmail: string;
  sending: boolean;
  result: string | null;
  error: string | null;
  notificationCount: number | null;
  logs: EmailLogEntry[];
  logsLoading: boolean;
  onSubjectChange: (v: string) => void;
  onBodyChange: (v: string) => void;
  onFormatChange: (v: EmailFormat) => void;
  onTestEmailChange: (v: string) => void;
  onSend: () => Promise<void>;
}

export default function AdminEmail({
  subject, body, format, testEmail, sending, result, error, notificationCount,
  logs, logsLoading, onSubjectChange, onBodyChange, onFormatChange, onTestEmailChange, onSend,
}: AdminEmailProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Compose */}
      <div className="rounded-xl border border-line p-4 sm:p-6">
        <h2 className="text-base sm:text-lg font-semibold text-ink mb-1">Send Email to All Users</h2>
        <p className="text-xs text-muted mb-4">
          Sends to every user with email notifications enabled. Emails include an unsubscribe link.
        </p>
        <div className="mb-4 inline-flex rounded-lg border border-line p-1" role="group" aria-label="Email format">
          {(["markdown", "html"] as EmailFormat[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => onFormatChange(f)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${format === f ? "bg-accent text-ink" : "text-muted hover:text-ink"}`}
            >
              {f === "markdown" ? "Markdown" : "HTML"}
            </button>
          ))}
        </div>
        {notificationCount !== null && (
          <div className="mb-4 rounded-lg bg-panel-2 bg-panel-2/20 px-3 py-2.5 text-xs sm:text-sm text-gold">
            <strong>{notificationCount}</strong> user{notificationCount !== 1 ? "s" : ""} with notifications enabled
          </div>
        )}
        <div className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Subject line"
            value={subject}
            onChange={(e) => { onSubjectChange(e.target.value); }}
            className="rounded-lg border border-line px-3 py-2.5 text-sm bg-panel text-ink placeholder:text-muted placeholder:text-muted"
          />
          <textarea
            placeholder={format === "html" ? "Paste full HTML here. Use {{UNSUBSCRIBE_URL}} where the unsubscribe link goes." : "Write your email in Markdown...\n\n# Heading\n\nThis is **bold** and *italic*."}
            value={body}
            onChange={(e) => { onBodyChange(e.target.value); }}
            rows={10}
            className="rounded-lg border border-line px-3 py-2.5 text-sm bg-panel text-ink placeholder:text-muted placeholder:text-muted font-mono resize-y"
          />
          <input
            type="email"
            placeholder="Test email (optional, sends only to this address)"
            value={testEmail}
            onChange={(e) => { onTestEmailChange(e.target.value); }}
            className="rounded-lg border border-line px-3 py-2.5 text-sm bg-panel text-ink placeholder:text-muted"
          />
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <button onClick={onSend} disabled={sending || !subject.trim() || !body.trim()}
              className="rounded-lg bg-accent text-ink py-2.5 px-4 text-sm font-semibold hover:bg-accent disabled:opacity-40 transition-opacity w-full sm:w-auto"
            >{sending ? "Sending…" : "Send to All"}</button>
            {result && <p className="text-sm text-ok">{result}</p>}
            {error && <p className="text-sm text-danger text-danger">{error}</p>}
          </div>
        </div>
      </div>

      {/* Preview */}
      {body.trim() && (
        <div className="rounded-xl border border-line p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold text-ink mb-1">Preview</h2>
          <p className="text-xs text-muted mb-3">Rough preview — email clients may render differently.</p>
          {format === "html" ? (
            <iframe
              title="Email preview"
              srcDoc={body}
              sandbox=""
              className="w-full h-96 rounded-lg border border-line bg-white"
            />
          ) : (
            <div className="rounded-lg border border-line border-line bg-panel-2 bg-panel p-3 text-sm text-muted font-mono whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
              {body}
            </div>
          )}
        </div>
      )}

      {/* History */}
      <div className="rounded-xl border border-line p-4 sm:p-6">
        <h2 className="text-base sm:text-lg font-semibold text-ink mb-1">Email History</h2>
        <p className="text-xs text-muted mb-3">Last 50 sends</p>
        {logsLoading ? (
          <div className="text-center text-muted py-8">Loading...</div>
        ) : logs.length === 0 ? (
          <div className="rounded-lg border border-line border-line p-4 text-center text-muted text-sm">No emails sent yet.</div>
        ) : (
          <>
            {/* Mobile card list */}
            <div className="flex flex-col gap-2 md:hidden">
              {logs.map((log) => (
                <div key={log.id} className="rounded-lg border border-line p-3">
                  <span className="text-xs font-medium text-muted line-clamp-2">{log.subject}</span>
                  <div className="flex items-center justify-between mt-2 text-xs">
                    <span className="text-muted">
                      <span className="font-semibold text-ok">{log.success_count}</span>
                      <span className="text-muted">/{log.recipient_count}</span>
                      {log.fail_count > 0 && (
                        <span className="ml-2 font-semibold text-danger text-danger">{log.fail_count} fail</span>
                      )}
                    </span>
                    <span className="text-muted">
                      {new Date(log.sent_at).toLocaleString("en-US", { timeZone: "America/New_York", timeZoneName: "short" })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-panel-2 bg-panel">
                    <th className="text-left py-3 px-4 font-semibold text-muted">Subject</th>
                    <th className="text-center py-3 px-4 font-semibold text-muted w-20">Sent</th>
                    <th className="text-center py-3 px-4 font-semibold text-muted w-20">Failed</th>
                    <th className="text-right py-3 px-4 font-semibold text-muted w-40">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-line border-line last:border-0">
                      <td className="py-3 px-4 text-muted max-w-xs truncate">{log.subject}</td>
                      <td className="text-center py-3 px-4 tabular-nums">
                        <span className="font-semibold text-ok">{log.success_count}</span>
                        <span className="text-muted">/{log.recipient_count}</span>
                      </td>
                      <td className="text-center py-3 px-4 tabular-nums">
                        {log.fail_count > 0 ? <span className="font-semibold text-danger text-danger">{log.fail_count}</span> : <span className="text-muted">0</span>}
                      </td>
                      <td className="text-right py-3 px-4 text-xs text-muted whitespace-nowrap">
                        {new Date(log.sent_at).toLocaleString("en-US", { timeZone: "America/New_York", timeZoneName: "short" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}