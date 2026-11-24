// BuildPartner.ai mod nudges: every rule for when a nudge shows, how long it stays away, what it says and
// what it fills into the prompt box. Pure: no engine, no clock, no storage. self-improving.tsx feeds it
// events and the time, keeps the state it hands back, and draws the row. Tests drive it directly.
//
// One state, one transition function: decide(event, state, now) returns the nudge to show (or null) and
// the next state. It never mutates the state it is given. dismiss() and accept() end a showing.
//
// Privacy: a nudge holds only a key, fixed wording and a command. The state keeps counters and registrable
// domains for this session; it never keeps prompt text. Only { kind, nudge_key } is ever reported
// (nudgeEventBody), never a URL, a prompt or a domain.

export const NUDGE_KEYS = ['fetch_failed', 'expert_decision', 'social_talk', 'audit_stale', 'plan_loop', 'competitor_urls', 'tip_web', 'tip_social', 'tip_pad'] as const
export type NudgeKey = (typeof NUDGE_KEYS)[number]
export type BpTool = 'web' | 'social' | 'pad'
export type UsedTool = BpTool | 'audit'

export const DAY_MS = 86_400_000

/** How long a nudge stays away after it showed. The expert nudge has no shown cooldown (its Not now wait is EXPERT_NOT_NOW_MS). */
export const COOLDOWN_MS: Record<NudgeKey, number> = {
  fetch_failed: 7 * DAY_MS,
  expert_decision: 0,
  social_talk: 7 * DAY_MS,
  audit_stale: 14 * DAY_MS,
  plan_loop: 7 * DAY_MS,
  competitor_urls: 14 * DAY_MS,
  tip_web: 7 * DAY_MS,
  tip_social: 7 * DAY_MS,
  tip_pad: 7 * DAY_MS,
}
export const EXPERT_NOT_NOW_MS = DAY_MS

/** Nudges that share one cooldown: whichever showed last blocks the others. */
const COOLDOWN_GROUPS: readonly (readonly NudgeKey[])[] = [['social_talk', 'tip_social']]

const TIP_WEB_CALLS = 3
const AUDIT_STALE_MS = 30 * DAY_MS
const MAX_DOMAINS = 50
// A nudge nobody answered stops counting as on screen after this long, so one left up cannot block the rest forever.
const UP_EXPIRES_MS = DAY_MS

export type NudgeState = {
  /** The plugin's name (buildpartner or bp-dev): the prefix of every command. */
  plugin: string
  /** When each nudge last showed (ms). The cooldown clock; kept across sessions by the caller. */
  shownAt: Partial<Record<NudgeKey, number>>
  /** When Not now was last pressed (ms); only the expert nudge reads it. Kept across sessions by the caller. */
  dismissedAt: Partial<Record<NudgeKey, number>>
  /** The nudge on screen now (a tool tip counts). One at a time. */
  up: NudgeKey | null
  /** BuildPartner.ai tools connected this session. */
  connected: readonly BpTool[]
  /** BuildPartner.ai tools used this session. */
  usedTools: readonly UsedTool[]
  /** Free plan with no runs left. */
  outOfRuns: boolean
  plan: { lastAuditAt?: string | null; siteHost?: string | null }
  /** WebFetch and WebSearch calls this session, social-host fetches left out. */
  webCalls: number
  exitPlans: number
  /** Registrable domains pasted this session that count for competitor_urls (at most MAX_DOMAINS). */
  domains: readonly string[]
  /** False when the last read of the member's plan failed: the audit date is then unknown, not missing. Unset reads as true. */
  planRead?: boolean
}

export type Nudge = { key: NudgeKey; line: string; button: string; command: string }

export type NudgeEvent =
  | { type: 'session.start' }
  | { type: 'prompt.submit'; text: string }
  | { type: 'tool.call'; tool: string; input?: unknown }
  | { type: 'tool.result'; tool: string; input?: unknown; result?: unknown }
  | { type: 'decision'; question?: string; topic?: string }

export function newState(plugin: string): NudgeState {
  return { plugin, shownAt: {}, dismissedAt: {}, up: null, connected: [], usedTools: [], outOfRuns: false, plan: {}, webCalls: 0, exitPlans: 0, domains: [] }
}

// ---- Hosts and URLs ----

const SOCIAL_FETCH_HOSTS = ['x.com', 'twitter.com', 'instagram.com', 'youtube.com', 'youtu.be']
const SOCIAL_TALK_HOSTS = [...SOCIAL_FETCH_HOSTS, 'tiktok.com', 'linkedin.com', 'substack.com']
const COMMON_HOSTS = [
  'claude.ai', 'anthropic.com', 'github.com', 'google.com', 'docs.google.com', 'localhost', '127.0.0.1', 'buildpartner.ai',
  'notion.so', 'figma.com', 'vercel.app', 'stackoverflow.com', 'npmjs.com', 'wikipedia.org',
]
// Second-level labels that sit under a two-letter country code (acme.co.uk, acme.com.au).
const SECOND_LEVEL = new Set(['co', 'com', 'org', 'net', 'gov', 'edu', 'ac'])

function hostMatches(host: string, list: readonly string[]): boolean {
  return list.some(h => host === h || host.endsWith(`.${h}`))
}

/** The hostname of a URL, lowercased, or ''. */
function hostOf(raw: unknown): string {
  try {
    return new URL(String(raw ?? '')).hostname.toLowerCase()
  } catch {
    return ''
  }
}

/** acme.com for www.acme.com and blog.acme.com; acme.co.uk for www.acme.co.uk. */
function registrable(host: string): string {
  if (/^\d+(\.\d+){3}$/.test(host)) return host
  const parts = host.split('.').filter(Boolean)
  if (parts.length <= 2) return parts.join('.')
  const tld = parts[parts.length - 1] as string
  const second = parts[parts.length - 2] as string
  const keep = tld.length === 2 && SECOND_LEVEL.has(second) ? 3 : 2
  return parts.slice(-keep).join('.')
}

function urlsIn(text: string): string[] {
  return text.match(/https?:\/\/[^\s<>"'`)\]]+/gi) ?? []
}

function mentionsSocial(text: string): boolean {
  if (urlsIn(text).some(u => hostMatches(hostOf(u), SOCIAL_TALK_HOSTS))) return true
  // The word creator, "YouTube channel", or an @handle. A handle is @ and 2 to 30 name characters, with nothing word-like
  // before the @ (not an email) and no "/" or ".name" after it (not a file mention like @src/app.ts or @README.md).
  return /\bcreators?\b/i.test(text) || /\byoutube\s+channels?\b/i.test(text) || /(^|[^\w@.])@[A-Za-z0-9_]{2,30}(?![A-Za-z0-9_/]|\.\w)/.test(text)
}

/** Registrable domains in a prompt that count as possible competitors: not social, not common, not the member's own site. */
function competitorDomains(text: string, siteHost: string | null | undefined): string[] {
  const own = siteHost ? registrable(siteHost.toLowerCase()) : ''
  const found: string[] = []
  for (const u of urlsIn(text)) {
    const host = hostOf(u).replace(/^www\./, '')
    if (!host || hostMatches(host, SOCIAL_TALK_HOSTS) || hostMatches(host, COMMON_HOSTS)) continue
    const domain = registrable(host)
    if (domain === own || found.includes(domain)) continue
    found.push(domain)
  }
  return found
}

// ---- Reading what a tool answered ----

/** The text of a tool result, or null when its shape has no text field at all. */
function resultText(result: unknown): string | null {
  if (result === null || result === undefined) return ''
  if (typeof result === 'string') return result
  if (Array.isArray(result)) return result.map(r => resultText(r) ?? '').join('\n')
  if (typeof result !== 'object') return String(result)
  const o = result as Record<string, unknown>
  for (const k of ['content', 'text', 'result', 'output']) {
    if (k in o) return resultText(o[k])
  }
  return null
}

/**
 * A WebFetch that errored, was denied, got an HTTP error status (400 and up) or came back with no bytes. Reads the engine's
 * answer object ({ result: { code, bytes, ... }, isError? } or { deny }), never any page text: a page that mentions 404 is a page.
 */
function fetchFailed(result: unknown): boolean {
  if (!result || typeof result !== 'object') return false
  const o = result as { isError?: unknown; deny?: unknown; result?: unknown }
  if (o.isError === true || 'deny' in o) return true
  const inner = o.result
  if (!inner || typeof inner !== 'object') return false
  const { code, bytes } = inner as { code?: unknown; bytes?: unknown }
  return (typeof code === 'number' && code >= 400) || bytes === 0
}

/** An ExitPlanMode answered with a refusal: rejected, declined or interrupted. */
function planRejected(result: unknown): boolean {
  const t = resultText(result) ?? ''
  return /doesn'?t want to proceed|tool use was rejected|rejected|declined|interrupted by user/i.test(t)
}

// ---- Wording and commands ----

type Copy = { line: string; button: string; skill: string }
const COPY: Record<Exclude<NudgeKey, 'expert_decision'>, Copy> = {
  fetch_failed: { line: "That page didn't load for Claude. Web Research reads pages that block bots.", button: 'Try Web Research', skill: 'web-research' },
  social_talk: { line: 'Looking at a creator? Social Research pulls their posts, stats and video transcripts.', button: 'Try Social Research', skill: 'social-research' },
  audit_stale: { line: 'Your AI Audit finds the work Claude could take off your plate.', button: 'Run my AI Audit', skill: 'audit' },
  plan_loop: { line: 'Going back and forth on a plan? Make it a BuildPad and comment right on the page.', button: 'Make a BuildPad', skill: 'build-pad' },
  competitor_urls: { line: 'Comparing competitors? Competitor Research reads their sites and puts them side by side.', button: 'Try Competitor Research', skill: 'competitor-research' },
  tip_web: { line: "You're doing a lot of web research. BuildPartner.ai Web Research reads any page, including ones that block bots.", button: 'Try Web Research', skill: 'web-research' },
  tip_social: { line: 'Reading X, Instagram or YouTube? Social Intel gets the posts, stats, comments and transcripts.', button: 'Try Social Intel', skill: 'social-research' },
  tip_pad: { line: 'Turn this plan into a page you and your team can comment on.', button: 'Make a BuildPad', skill: 'build-pad' },
}

function build(state: NudgeState, key: NudgeKey, extra = ''): Nudge {
  if (key === 'expert_decision') {
    const topic = extra.split('\n')[0] ?? ''
    const question = extra.split('\n').slice(1).join('\n')
    return {
      key,
      line: `Before you decide on ${topic || 'this'}, an expert framework could change the answer.`,
      button: 'Ask the expert',
      command: `/${state.plugin}:expert-advice ${question}`,
    }
  }
  const c = COPY[key]
  return { key, line: c.line, button: c.button, command: `/${state.plugin}:${c.skill} ${extra}`.trimEnd() + (extra ? '' : ' ') }
}

// ---- The transition ----

/** The BuildPartner.ai tool a nudge needs connected and unused this session, or null. */
const NEEDS: Partial<Record<NudgeKey, BpTool>> = {
  fetch_failed: 'web',
  social_talk: 'social',
  plan_loop: 'pad',
  tip_web: 'web',
  tip_social: 'social',
  tip_pad: 'pad',
}

function inCooldown(state: NudgeState, key: NudgeKey, now: number): boolean {
  const group = COOLDOWN_GROUPS.find(g => g.includes(key)) ?? [key]
  return group.some(k => {
    const at = state.shownAt[k]
    return typeof at === 'number' && now - at < COOLDOWN_MS[k]
  })
}

/** A nudge is on screen until it is answered, or 24 hours after it showed. With no shown time on record, it stays up. */
function isUp(state: NudgeState, now: number): boolean {
  if (state.up === null) return false
  const at = state.shownAt[state.up]
  return typeof at !== 'number' || now - at < UP_EXPIRES_MS
}

function isEligible(state: NudgeState, key: NudgeKey, now: number): boolean {
  if (isUp(state, now) || state.outOfRuns) return false
  const tool = NEEDS[key]
  if (tool && (!state.connected.includes(tool) || state.usedTools.includes(tool))) return false
  if (key === 'audit_stale' && state.usedTools.includes('audit')) return false
  if (key === 'expert_decision') {
    const at = state.dismissedAt.expert_decision
    return !(typeof at === 'number' && now - at < EXPERT_NOT_NOW_MS)
  }
  return !inCooldown(state, key, now)
}

function isStale(lastAuditAt: string | null | undefined, now: number): boolean {
  const at = typeof lastAuditAt === 'string' ? Date.parse(lastAuditAt) : NaN
  return Number.isNaN(at) || now - at > AUDIT_STALE_MS
}

/** What an event asks for: the session counters it moves, and the nudges it could raise, first choice first. */
function triggers(event: NudgeEvent, state: NudgeState, now: number): { next: NudgeState; wants: { key: NudgeKey; extra?: string }[] } {
  switch (event.type) {
    case 'session.start':
      return { next: state, wants: state.planRead !== false && isStale(state.plan.lastAuditAt, now) ? [{ key: 'audit_stale' }] : [] }
    case 'decision':
      return { next: state, wants: [{ key: 'expert_decision', extra: `${event.topic ?? ''}\n${event.question ?? ''}` }] }
    case 'prompt.submit': {
      const domains = [...state.domains]
      for (const d of competitorDomains(event.text, state.plan.siteHost)) if (domains.length < MAX_DOMAINS && !domains.includes(d)) domains.push(d)
      const wants: { key: NudgeKey }[] = []
      if (mentionsSocial(event.text)) wants.push({ key: 'social_talk' })
      if (domains.length >= 2) wants.push({ key: 'competitor_urls' })
      return { next: { ...state, domains }, wants }
    }
    case 'tool.call': {
      const url = (event.input as { url?: unknown } | null | undefined)?.url
      if (event.tool === 'WebFetch' && hostMatches(hostOf(url), SOCIAL_FETCH_HOSTS)) return { next: state, wants: [{ key: 'tip_social' }] }
      if (event.tool === 'WebFetch' || event.tool === 'WebSearch') {
        const webCalls = state.webCalls + 1
        return { next: { ...state, webCalls }, wants: webCalls >= TIP_WEB_CALLS ? [{ key: 'tip_web' }] : [] }
      }
      if (event.tool === 'ExitPlanMode') {
        const exitPlans = state.exitPlans + 1
        return { next: { ...state, exitPlans }, wants: exitPlans >= 2 ? [{ key: 'plan_loop' }] : [] }
      }
      return { next: state, wants: [] }
    }
    case 'tool.result': {
      if (event.tool === 'WebFetch' && fetchFailed(event.result)) {
        const url = (event.input as { url?: unknown } | null | undefined)?.url
        return { next: state, wants: [{ key: 'fetch_failed', extra: typeof url === 'string' ? url : '' }] }
      }
      if (event.tool === 'ExitPlanMode' && planRejected(event.result)) return { next: state, wants: [{ key: 'plan_loop' }] }
      return { next: state, wants: [] }
    }
  }
}

/**
 * The one transition: an event in, the nudge to show (or null) and the next state out. A dropped trigger spends no cooldown.
 * With a gate (and the member's local day), a nudge is also dropped when the gate says no. decide never steps the gate: the
 * caller does, with { type: 'shown', kind: 'nudge' }, once the nudge is drawn.
 */
export function decide(event: NudgeEvent, state: NudgeState, now: number, gate?: ModGate, day?: string): { nudge: Nudge | null; state: NudgeState } {
  const { next, wants } = triggers(event, state, now)
  const gated = gate !== undefined && day !== undefined && !mayShow(gate, 'nudge', now, day)
  const pick = gated ? undefined : wants.find(w => isEligible(next, w.key, now))
  if (!pick) return { nudge: null, state: next }
  return {
    nudge: build(next, pick.key, pick.extra),
    state: { ...next, up: pick.key, shownAt: { ...next.shownAt, [pick.key]: now } },
  }
}

/** Not now: the nudge goes away. Its cooldown keeps running from when it showed; only the expert nudge waits from now. */
export function dismiss(state: NudgeState, key: NudgeKey, now: number): NudgeState {
  return { ...state, up: null, dismissedAt: { ...state.dismissedAt, [key]: now } }
}

/** The fill button: the nudge goes away. */
export function accept(state: NudgeState, _key: NudgeKey): NudgeState {
  return { ...state, up: null }
}

// ---- The plan's two extra fields, and what is reported ----

/** last_audit_at and site_host from GET /plan. Missing or not a string (an older server) is null. */
export function readPlanExtras(json: unknown): { lastAuditAt: string | null; siteHost: string | null } {
  const o = json && typeof json === 'object' ? (json as { last_audit_at?: unknown; site_host?: unknown }) : {}
  return {
    lastAuditAt: typeof o.last_audit_at === 'string' ? o.last_audit_at : null,
    siteHost: typeof o.site_host === 'string' ? o.site_host : null,
  }
}

const PHASE_KIND = { shown: 'nudge_shown', clicked: 'nudge_clicked', dismissed: 'nudge_dismissed' } as const

/** The body POSTed to /api/buildpartner/mod/events for a nudge: exactly two fields, so nothing else can ride along. */
export function nudgeEventBody(phase: string, key: string | undefined): { kind: string; nudge_key: string } | null {
  const kind = (PHASE_KIND as Record<string, string | undefined>)[phase]
  if (!kind || typeof key !== 'string' || !(NUDGE_KEYS as readonly string[]).includes(key)) return null
  return { kind, nudge_key: key }
}

// ---- The gate: auto-quiet and the daily caps over every mod prompt ----
//
// One state, one transition function. A gate sits over every prompt the mod makes (a suggestion, a nudge, a check-in).
// After MOD_QUIET_STREAK dismissals in a row it goes quiet for MOD_QUIET_COOLDOWN_MS. Awake, it lets through at most
// MOD_SUGGESTIONS_PER_DAY suggestions a day and MOD_OTHER_PROMPTS_PER_DAY nudge or check-in a day (those two share the one).
// Pure: the caller passes the clock and the member's local day (YYYY-MM-DD), keeps the gate in storage, and re-reads it
// before every step so two windows share one gate. Only kinds are ever reported, never text.

export const MOD_QUIET_STREAK = 5
export const MOD_QUIET_COOLDOWN_MS = 7 * DAY_MS
export const MOD_SUGGESTIONS_PER_DAY = 3
export const MOD_OTHER_PROMPTS_PER_DAY = 1

/**
 * Mirror of the server's MOD_DISMISS_KINDS and MOD_ACCEPT_KINDS (the web app's notices library). The plugin cannot import the web app, so the
 * literals are repeated here and a test holds the two copies equal. A dismissal adds to the streak; an accept resets it.
 */
export const MOD_DISMISS_ANSWERS = ['suggestion_dismissed', 'nudge_dismissed', 'mod.checkin:dismissed']
export const MOD_ACCEPT_ANSWERS = ['suggestion_applied', 'nudge_clicked', 'mod.checkin:answered']

export type PromptKind = 'suggestion' | 'nudge' | 'checkin'
export type ModGate = {
  mode: 'active' | 'quiet'
  /** Dismissals in a row with no accept between. */
  streak: number
  /** When quiet ends (ms); null while active. */
  quietUntil: number | null
  /** The member's local calendar day the two counts belong to. */
  day: string
  suggestionsShown: number
  /** Nudges and check-ins shown that day, together. */
  otherShown: number
}
export type GateEvent = { type: 'shown' | 'accepted' | 'dismissed'; kind: PromptKind } | { type: 'tick' } | { type: 'resumed' }
export type GateReport = 'mod_quiet_started' | 'mod_quiet_ended'

export function newGate(day: string): ModGate {
  return { mode: 'active', streak: 0, quietUntil: null, day, suggestionsShown: 0, otherShown: 0 }
}

/** A gate read back from storage: anything that is not a well-formed gate is a fresh active one, so a bad value never silences the mod. */
export function readGate(raw: unknown, day: string, now?: number): ModGate {
  const g = raw && typeof raw === 'object' ? (raw as Partial<Record<keyof ModGate, unknown>>) : {}
  const count = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0
  const quiet = g.mode === 'quiet' && typeof g.quietUntil === 'number' && Number.isFinite(g.quietUntil)
  const ok = (g.mode === 'active' || quiet) && count(g.streak) && count(g.suggestionsShown) && count(g.otherShown) && typeof g.day === 'string'
  if (!ok) return newGate(day)
  // A stored quiet can never run past one cooldown from now, so a bad or hand-edited date cannot silence the mod for a year.
  const until = quiet ? (g.quietUntil as number) : null
  const quietUntil = until !== null && now !== undefined ? Math.min(until, now + MOD_QUIET_COOLDOWN_MS) : until
  return {
    mode: quiet ? 'quiet' : 'active',
    streak: g.streak as number,
    quietUntil,
    day: g.day as string,
    suggestionsShown: g.suggestionsShown as number,
    otherShown: g.otherShown as number,
  }
}

/** The gate as of now and day: quiet that has run out is active again, and a new day has zero counts. Reports nothing. */
function asOf(gate: ModGate, now: number, day: string): { gate: ModGate; ended: boolean } {
  let g = gate
  let ended = false
  if (g.mode === 'quiet' && g.quietUntil !== null && now >= g.quietUntil) {
    g = { ...g, mode: 'active', streak: 0, quietUntil: null }
    ended = true
  }
  if (g.day !== day) g = { ...g, day, suggestionsShown: 0, otherShown: 0 }
  return { gate: g, ended }
}

/** The one transition for the gate: an event in, the next gate and what to report out. Never mutates the gate it is given. */
// Known limit: the stored gate is read, changed and written back by each window with no lock, so two windows acting within
// milliseconds of each other can lose one update. Usually that is one count (one extra suggestion a day, or a streak one behind).
// At worst it is a whole transition: a resume overwritten by a stale quiet gate stays paused until the old end (7 days at most)
// and a second resume reports mod_quiet_ended again; a lost quiet start likewise reports mod_quiet_started twice. Accepted (#600).
export function gateStep(gate: ModGate, ev: GateEvent, now: number, day: string): { gate: ModGate; report: GateReport[] } {
  const base = asOf(gate, now, day)
  let g = base.gate
  const report: GateReport[] = base.ended ? ['mod_quiet_ended'] : []
  switch (ev.type) {
    case 'tick':
      break
    case 'shown':
      g = ev.kind === 'suggestion' ? { ...g, suggestionsShown: g.suggestionsShown + 1 } : { ...g, otherShown: g.otherShown + 1 }
      break
    case 'resumed':
      // While active a resume changes nothing and reports nothing (asOf already reported a quiet that just ran out).
      if (g.mode === 'quiet') {
        report.push('mod_quiet_ended')
        g = { ...g, mode: 'active', streak: 0, quietUntil: null }
      }
      break
    case 'accepted':
      if (g.mode === 'quiet') report.push('mod_quiet_ended')
      g = { ...g, mode: 'active', streak: 0, quietUntil: null }
      break
    case 'dismissed':
      if (g.mode === 'quiet') break // the cooldown is not extended
      if (g.streak + 1 >= MOD_QUIET_STREAK) {
        g = { ...g, mode: 'quiet', streak: 0, quietUntil: now + MOD_QUIET_COOLDOWN_MS }
        report.push('mod_quiet_started')
      } else {
        g = { ...g, streak: g.streak + 1 }
      }
      break
  }
  return { gate: { ...g }, report }
}

/**
 * The one line a member reads when they ask for suggestions and the gate is holding them back, or null when it is not.
 * Quiet: until when, and why. At the day's suggestion cap: that more show tomorrow. Never prompt text.
 */
export function gateNote(gate: ModGate, now: number, day: string, resumeCommand?: string): string | null {
  const g = asOf(gate, now, day).gate
  if (g.mode === 'quiet' && typeof g.quietUntil === 'number') {
    const until = new Date(g.quietUntil).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    const held = `The mod is paused until ${until} after you turned down ${MOD_QUIET_STREAK} prompts in a row.`
    return resumeCommand ? `${held} Run ${resumeCommand} to turn suggestions back on now.` : held
  }
  if (g.suggestionsShown >= MOD_SUGGESTIONS_PER_DAY) return `The mod shows up to ${MOD_SUGGESTIONS_PER_DAY} new suggestions a day, and has shown them all for today.`
  return null
}

/** Quiet beats everything; then the suggestion cap for suggestions; then the shared one-a-day budget for nudges and check-ins. */
export function mayShow(gate: ModGate, kind: PromptKind, now: number, day: string): boolean {
  const g = asOf(gate, now, day).gate
  if (g.mode === 'quiet') return false
  return kind === 'suggestion' ? g.suggestionsShown < MOD_SUGGESTIONS_PER_DAY : g.otherShown < MOD_OTHER_PROMPTS_PER_DAY
}
