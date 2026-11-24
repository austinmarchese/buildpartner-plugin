// BuildPartner.ai mod check-in after an AI Audit fix prompt (spec 692 Build 4): "Did that fix work?".
// Pure: no engine, no clock, no storage, no I/O. self-improving.tsx feeds it the text of a prompt and the gate,
// keeps the pending fix in one module variable, and draws the row. Tests drive it directly.
//
// Privacy: the finding title lives in memory for one turn only. It is never logged and never sent anywhere
// except the member's own business-audit route (to mark the finding done). Only ids and outcomes are reported.
//
// The ids and labels below must equal CHECKINS.audit_fix in apps/web/lib/mod-checkins.ts (a test pins them).
import { mayShow, type ModGate } from './mod-nudges'

export const AUDIT_FIX_CHECKIN = {
  nudge_key: 'audit_fix',
  tool_id: 'audit',
  question_id: 'audit_fix_q',
  question: 'Did that fix work?',
  options: [
    { option_id: 'audit_fix_yes', label: 'Yes' },
    { option_id: 'audit_fix_not_quite', label: 'Not quite' },
  ],
} as const

/** The third button. Same id and label as DISMISS_OPTION on the web side. */
export const AUDIT_FIX_DISMISS = { option_id: 'dismiss', label: 'Not now' } as const

export type PendingFix = { title: string; at: number }

/** A pending fix older than this is dropped: its turn is long over. */
export const PENDING_FIX_MAX_MS = 30 * 60_000

/** The title is the text between the first quote after the opener and the first quote followed by " (", ".", ":" or the end. */
export function fixTitleOf(text: unknown): string | null {
  if (typeof text !== 'string') return null
  if (/^\s*From my AI Audit, the bigger fix/.test(text)) return null
  const m = /^\s*From my AI Audit[^"]*"([\s\S]+?)"(?= \(|\.|:|$)/.exec(text)
  return m ? (m[1] as string) : null
}

/** What "Not quite" puts in the prompt box: a smaller second try. It is itself a fix prompt, so it earns its own check-in. */
export function RETRY_PROMPT(title: string): string {
  return `From my AI Audit: "${title}". That fix didn't quite work. Ask me one question about what went wrong, then try again a smaller way and show me the result before anything is sent or changed.`
}

/** The pending fix for a submitted prompt: its title when it is a fix prompt and the gate would allow a check-in, else null. */
export function pendingAfterSubmit(text: unknown, gate: ModGate, now: number, day: string): { title: string } | null {
  const title = fixTitleOf(text)
  if (title === null) return null
  return mayShow(gate, 'checkin', now, day) ? { title } : null
}

/** Hands the pending fix out once, unless it is older than PENDING_FIX_MAX_MS. What the module variable becomes is always null. Never changes its argument. */
export function takePending(pending: PendingFix | null, now: number): { taken: PendingFix | null; pending: null } {
  if (pending && now - pending.at > PENDING_FIX_MAX_MS) return { taken: null, pending: null }
  return { taken: pending, pending: null }
}
