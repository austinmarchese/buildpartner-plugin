import { expect, mock, test } from 'claude-code/testing'

// Issue #613 items 2 and 3, written from the spec before the code. The mod's gate (modGate in $.store) is read, stepped and written back
// by several paths, and at a turn's end the fix check-in, the review and a nudge can all step it at once. These tests drive that through
// the real hooks with a SLOW store (every modGate read and write takes a few real milliseconds), so two steps interleave when nothing
// holds them apart, and check three things: no step is lost (G1), two prompts racing for the day's one slot show only one (G2), and the
// pending fix check-in behaves as it does today for an interrupted turn (G3), two fix prompts in a row (G4) and the plain case (G5).
// Tags: [new] fails before the change, [keep] passes before and after.
// Run: sh scripts/mod-local.sh <dir> (plus copy plugin/hooks/*.ts beside self-improving.tsx), then `claude plugin test <dir>/bp-local`.
// Scope: one window. Two windows share the store and can still race (the accepted #600 limit); nothing here tests that.

// This plugin's name: mod-local.sh and deploy-dev-plugin.sh rewrite it with the mod.
const PLUGIN = 'buildpartner'

const BAND = {
  plugin: PLUGIN,
  surface: 'desktop',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isCollapsed: false, isWorking: false, maxRows: 40, bodyColumns: 120, scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

type On = Parameters<typeof mock.store>[0]
type Dollar = Parameters<Parameters<typeof test>[1]>[0]

const FIX_A = 'From my AI Audit: "Reply to every lead within a day". Show me the result before anything is sent or changed.'
const FIX_B = 'From my AI Audit: "Send the weekly invoice reminder". Show me the result before anything is sent or changed.'
// Two outside sites in one prompt raise the competitor_urls nudge, which needs no connected tool.
const FIX_WITH_SITES = 'From my AI Audit: "Reply to every lead within a day". Also compare https://acme-one.example.com and https://acme-two.example.org first.'
const SITES_ONLY = 'Compare https://acme-one.example.com and https://acme-two.example.org for me.'

const localDay = (ms: number) => {
  const d = new Date(ms)
  const two = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`
}

/** Arm `reads` to make the next that many modGate reads hang; `hung` counts how many have; `held` lets them go (see releaseHung). */
type Hang = { reads: number; hung: number; held: (() => void)[] }
const newHang = (): Hang => ({ reads: 0, hung: 0, held: [] })

type Gate = { mode: 'active' | 'quiet'; streak: number; quietUntil: number | null; day: string; suggestionsShown: number; otherShown: number }

/** A signed-in member with the check-ins on, the Self-Improving review off, and a modGate store whose reads take `slow.ms` real ms and whose writes take `slow.setMs ?? slow.ms` (change them mid-test). */
function engine(on: On, slow: { ms: number; setMs?: number }, flag: { current: unknown } = { current: null }, failFirstGateWrite = false, hang: Hang = newHang()) {
  const store = new Map<string, unknown>([['welcomed', true], ['scanned', true], ['settings', { selfOn: false, expertOn: true }]])
  const sets: { key: string; value: unknown }[] = []
  const posts: { url: string; body: string }[] = []
  const said = { text: '' }
  let failed = !failFirstGateWrite
  const nap = (ms: number) => new Promise<void>(r => setTimeout(r, ms))
  on('store.get', async (_, e) => {
    const key = (e as { key: string }).key
    // A read that does not answer: the next `hang.reads` reads of the gate wait until `releaseHung` (a stuck disk or a dead store call).
    // A test releases them in its `finally`, so no step is left queued to run inside the next test.
    if (key === 'modGate' && hang.reads > 0) {
      hang.reads -= 1
      hang.hung += 1
      await new Promise<void>(r => hang.held.push(r))
    }
    if (key === 'modGate' && slow.ms > 0) await nap(slow.ms)
    return { value: store.get(key) } as never
  })
  on('store.set', async (_, e) => {
    const { key, value } = e as { key: string; value: unknown }
    if (key === 'modGate' && (slow.setMs ?? slow.ms) > 0) await nap(slow.setMs ?? slow.ms)
    if (key === 'modGate' && !failed) {
      failed = true
      throw new Error('disk full')
    }
    store.set(key, value)
    sets.push({ key, value })
    return { value: undefined } as never
  })
  on('store.delete', (_, e) => (store.delete((e as { key: string }).key), { value: undefined }) as never)
  on('store.keys', () => ({ value: [...store.keys()] }) as never)
  mock.env(on, { HOME: '/home/m' })
  const clock = mock.clock(on)
  on('tool.register', () => ({ value: { tool: 'x' } }))
  on('fs.list', () => ({ value: [] }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('fs.read', () => ({ value: JSON.stringify({ token: 't', api_base: 'https://example.test' }) }))
  on('session.messages', () => ({ value: [{ role: 'user', text: said.text }] }) as never)
  on('session.surfaces', () => ({ value: ['desktop'] }) as never)
  on('turn.complete', () => ({ text: '' }) as never)
  on('ui.toast', () => ({ value: undefined }) as never)
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('model.complete', () => ({ value: { isAnswered: true, text: JSON.stringify({ expert: flag.current, items: [] }), usage: { input_tokens: 1, output_tokens: 1 } } }) as never)
  on('http.fetch', (_, e) => {
    posts.push({ url: e.url, body: String((e as { init?: { body?: unknown } }).init?.body ?? '') })
    if (e.url.endsWith('/api/buildpartner/mod/rollout')) return { value: { status: 200, ok: true, headers: {}, text: '{"show":true}' } }
    if (e.url.endsWith('/api/buildpartner/mod/notices')) return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ notices: [] }) } }
    return { value: { status: 200, ok: true, headers: {}, text: '{"ok":true}' } }
  })
  return { store, sets, posts, said, clock }
}

type Eng = ReturnType<typeof engine>

/** Waits until nothing has been stored or posted for 200 ms (at most 5 s): every task a turn end scheduled has run, however slow the store. */
async function settle(e?: Eng) {
  let last = -1
  for (let i = 0; i < 60; i += 1) {
    await new Promise(r => setTimeout(r, 100))
    const n = e ? e.sets.length + e.posts.length : 0
    if (n === last && i >= 2) return
    last = n
  }
}

async function start($: Dollar, e: Eng) {
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true } as never)
  await e.clock.advance(1)
  await settle(e)
}

const submit = ($: Dollar, text: string) => $.prompt.submit({ text } as never)

const endTurn = ($: Dollar, n: number, reason = 'answer') =>
  $.turn.complete({ reason, answer: 'ok', durationMs: 10, isAborted: reason !== 'answer', turnId: `t${n}` } as never)

/** Runs every task scheduled for "now" (a turn end, a submit's nudge) and waits for them to finish. */
async function drain(e: Eng) {
  await e.clock.advance(1)
  await settle(e)
}

const gateOf = (e: Eng) => e.store.get('modGate') as Gate | undefined
const nudgeShownReports = (e: Eng) => e.posts.filter(p => p.url.endsWith('/mod/events') && p.body.includes('nudge_shown')).length

type Seen = { checkin: boolean; nudge: boolean }
/** Which rows are waiting: the fix check-in, and any nudge (the competitor row or the expert question). The bar shows one row at a time, so this steps through them with Next. */
async function rows($: Dollar): Promise<Seen> {
  const ui = await $.ui.mount(BAND)
  const seen = { checkin: false, nudge: false }
  for (let i = 0; i < 5; i += 1) {
    if ((await ui.find({ type: 'Button', key: 'fix-yes' })) !== undefined) seen.checkin = true
    if ((await ui.find({ type: 'Button', key: 'use-nudge' })) !== undefined || (await ui.find({ type: 'Button', key: 'ask-expert-nudge' })) !== undefined) seen.nudge = true
    if ((await ui.find({ type: 'Button', key: 'row-next' })) === undefined) break
    await ui.press({ key: 'row-next' })
  }
  await ui.unmount()
  return seen
}

type Ui = Awaited<ReturnType<Dollar['ui']['mount']>>

/** Steps the one-row-at-a-time bar with Next until `key` is drawn (at most 5 steps). */
async function reach(ui: Ui, key: string) {
  for (let i = 0; i < 5 && (await ui.find({ type: 'Button', key })) === undefined; i += 1) await ui.press({ key: 'row-next' })
}

/** Presses one button on the bar and returns. */
async function press($: Dollar, key: string) {
  const ui = await $.ui.mount(BAND)
  await reach(ui, key)
  await ui.press({ key })
  await ui.unmount()
}

const NONE: Seen = { checkin: false, nudge: false }
const FLAG = { category: 'sales', topic: 'Starter tier pricing', question: 'Should the starter tier cost $29 a month?' }
const DECISION_Q = 'Should I price the starter offer at $49 a month or $490 a year?'

/** The fix check-in's Yes, then the title the member's own audit route was told to mark done ('' when nothing was posted). */
async function titleMarkedDone($: Dollar, e: Eng): Promise<string> {
  await press($, 'fix-yes')
  await settle(e)
  const post = e.posts.find(p => p.url.endsWith('/api/buildpartner/business-audit'))
  return post ? (JSON.parse(post.body) as { title: string }).title : ''
}

// ---- G1: no lost gate update ----

test('[new] G1 two Not now answers in the same breath both reach the gate: streak 2, not 1', async ($, on) => {
  const slow = { ms: 0 }
  const e = engine(on, slow)
  await start($, e)
  // The competitor nudge shows. The day's budget is then reset the way a new day would, and a fix check-in shows beside it.
  await submit($, SITES_ONLY)
  await drain(e)
  expect(await rows($)).toEqual({ checkin: false, nudge: true })
  e.store.set('modGate', { ...(gateOf(e) as Gate), otherShown: 0, streak: 0 })
  await submit($, FIX_A)
  await drain(e)
  await endTurn($, 1)
  await drain(e)
  expect(await rows($)).toEqual({ checkin: true, nudge: true })
  // Now the gate store is slow to write. Not now on the check-in starts its gate step; while that step is still reading and writing, Not now on the nudge starts its own.
  slow.setMs = 100
  const ui = await $.ui.mount(BAND)
  await reach(ui, 'fix-not-now')
  const first = ui.press({ key: 'fix-not-now' })
  await new Promise(r => setTimeout(r, 10))
  await reach(ui, 'skip-nudge')
  const second = ui.press({ key: 'skip-nudge' })
  await Promise.all([first, second])
  await ui.unmount()
  await settle(e)
  expect((gateOf(e) as Gate).streak).toBe(2)
})

// ---- G2: one slot, two prompts ----

test('[new] G2 a fix check-in and a competitor nudge race for the last slot of the day: exactly one shows', async ($, on) => {
  const slow = { ms: 10 }
  const e = engine(on, slow)
  await start($, e)
  // Submitting schedules the nudge; the turn end schedules the check-in. Neither runs until the clock moves, then both run together.
  await submit($, FIX_WITH_SITES)
  await endTurn($, 1)
  await drain(e)
  const seen = await rows($)
  expect([seen.checkin, seen.nudge].filter(Boolean)).toHaveLength(1)
  expect(nudgeShownReports(e)).toBe(seen.nudge ? 1 : 0)
  expect((gateOf(e) as Gate).otherShown).toBe(1)
})

test('[new] G2 a fix check-in and the expert question (flagged by the turn-end check) race for the last slot: exactly one shows', async ($, on) => {
  const slow = { ms: 10 }
  const e = engine(on, slow, { current: FLAG })
  await start($, e)
  await submit($, FIX_A)
  e.said.text = DECISION_Q
  await endTurn($, 1)
  await drain(e)
  const seen = await rows($)
  expect([seen.checkin, seen.nudge].filter(Boolean)).toHaveLength(1)
  expect(nudgeShownReports(e)).toBe(seen.nudge ? 1 : 0)
  expect((gateOf(e) as Gate).otherShown).toBe(1)
})

test('[keep] with a store that is not slow, the same race still shows exactly one', async ($, on) => {
  const e = engine(on, { ms: 0 })
  await start($, e)
  await submit($, FIX_WITH_SITES)
  await endTurn($, 1)
  await drain(e)
  const seen = await rows($)
  expect([seen.checkin, seen.nudge].filter(Boolean)).toHaveLength(1)
  expect((gateOf(e) as Gate).otherShown).toBe(1)
})

test('[keep] with the day budget already spent, neither the check-in nor the nudge shows', async ($, on) => {
  const e = engine(on, { ms: 10 })
  await start($, e)
  e.store.set('modGate', { mode: 'active', streak: 0, quietUntil: null, day: localDay(e.clock.now()), suggestionsShown: 0, otherShown: 1 })
  await submit($, FIX_WITH_SITES)
  await endTurn($, 1)
  await drain(e)
  expect(await rows($)).toEqual(NONE)
  expect((gateOf(e) as Gate).otherShown).toBe(1)
})

// ---- G3: the interrupted turn ----

test('[keep] G3 a turn that ends for another reason than an answer shows no check-in', async ($, on) => {
  const e = engine(on, { ms: 0 })
  await start($, e)
  await submit($, FIX_A)
  await endTurn($, 1, 'interrupted')
  await drain(e)
  expect(await rows($)).toEqual(NONE)
  expect(gateOf(e)?.otherShown ?? 0).toBe(0)
})

test('[keep] G3 observed today: the interrupted fix is still pending, and the next answered turn (no new prompt) shows its check-in', async ($, on) => {
  const e = engine(on, { ms: 0 })
  await start($, e)
  await submit($, FIX_A)
  await endTurn($, 1, 'interrupted')
  await drain(e)
  await endTurn($, 2)
  await drain(e)
  expect(await rows($)).toEqual({ checkin: true, nudge: false })
  expect(await titleMarkedDone($, e)).toBe('Reply to every lead within a day')
})

test('[keep] G3 observed today: an interrupted fix older than 30 minutes is dropped', async ($, on) => {
  const e = engine(on, { ms: 0 })
  await start($, e)
  await submit($, FIX_A)
  await endTurn($, 1, 'interrupted')
  await drain(e)
  await e.clock.advance(31 * 60_000)
  await settle(e)
  await endTurn($, 2)
  await drain(e)
  expect(await rows($)).toEqual(NONE)
})

test('[keep] G3 observed today: any new prompt after an interrupted fix forgets it', async ($, on) => {
  const e = engine(on, { ms: 0 })
  await start($, e)
  await submit($, FIX_A)
  await endTurn($, 1, 'interrupted')
  await drain(e)
  await submit($, 'Thanks, what is next?')
  await endTurn($, 2)
  await drain(e)
  expect(await rows($)).toEqual(NONE)
})

// ---- G4: two fix prompts in a row ----

test('[keep] G4 observed today: fix prompt A then fix prompt B before the turn ends shows one check-in, and it is for B', async ($, on) => {
  const e = engine(on, { ms: 0 })
  await start($, e)
  await submit($, FIX_A)
  await submit($, FIX_B)
  await endTurn($, 1)
  await drain(e)
  expect(await rows($)).toEqual({ checkin: true, nudge: false })
  expect(gateOf(e)?.otherShown).toBe(1)
  expect(await titleMarkedDone($, e)).toBe('Send the weekly invoice reminder')
})

test('[keep] G4 observed today: a second turn end for the same fix shows nothing more', async ($, on) => {
  const e = engine(on, { ms: 0 })
  await start($, e)
  await submit($, FIX_A)
  await endTurn($, 1)
  await drain(e)
  await press($, 'fix-not-now')
  await settle(e)
  await endTurn($, 2)
  await drain(e)
  expect(await rows($)).toEqual(NONE)
  expect(gateOf(e)?.otherShown).toBe(1)
})

// ---- G5: the plain case ----

test('[keep] G5 one fix prompt and an answered turn show exactly one check-in, for that fix', async ($, on) => {
  const e = engine(on, { ms: 0 })
  await start($, e)
  await submit($, FIX_A)
  await endTurn($, 1)
  await drain(e)
  expect(await rows($)).toEqual({ checkin: true, nudge: false })
  expect(gateOf(e)?.otherShown).toBe(1)
  expect(nudgeShownReports(e)).toBe(0)
  expect(await titleMarkedDone($, e)).toBe('Reply to every lead within a day')
})

test('[keep] G5 the same with a slow store: one check-in, one count', async ($, on) => {
  const e = engine(on, { ms: 10 })
  await start($, e)
  await submit($, FIX_A)
  await endTurn($, 1)
  await drain(e)
  expect(await rows($)).toEqual({ checkin: true, nudge: false })
  expect(gateOf(e)?.otherShown).toBe(1)
})

test('[keep] a turn with no fix prompt shows no check-in', async ($, on) => {
  const e = engine(on, { ms: 0 })
  await start($, e)
  await submit($, 'Draft a reply to the supplier.')
  await endTurn($, 1)
  await drain(e)
  expect(await rows($)).toEqual(NONE)
  expect(gateOf(e)?.otherShown ?? 0).toBe(0)
})

// ---- R1: a hung gate call cannot freeze the window, and the row is drawn before the slot is spent ----
// Timers: the mod schedules everything through $.clock.after and never calls setTimeout. These tests do not care which the hold uses: they
// advance the mock clock in 500 ms steps AND wait real time, and give up after 8 s real (or 9 s of mock time), so a hold on either clock
// is released inside the window and an unbounded lock reports FAIL instead of hanging the file.

/** Polls `done`, moving the mock clock 500 ms and real time 100 ms per round. False when 8 s of real time or 9 s of mock time pass first. */
async function waitUntil(e: Eng, done: () => boolean, realCapMs = 8000, mockCapMs = 9000): Promise<boolean> {
  const t0 = Date.now()
  let mocked = 0
  while (!done()) {
    if (Date.now() - t0 >= realCapMs) return false
    if (mocked < mockCapMs) {
      await e.clock.advance(500)
      mocked += 500
    }
    await new Promise(r => setTimeout(r, 100))
  }
  return true
}

/** Lets every hung read answer, then waits for the steps that were queued behind them to run out. Called in a `finally`, so a failed check leaves nothing running into the next test. */
async function releaseHung(e: Eng, hang: Hang) {
  for (const r of hang.held.splice(0)) r()
  await e.clock.advance(1)
  await settle(e)
}

/** Lets a promise that may never settle (a press stuck behind a hung call) go: waits for it at most `ms`. */
const bounded = (p: Promise<unknown>, ms = 500) => Promise.race([p.catch(() => undefined), new Promise(r => setTimeout(r, ms))])

const quietReports = (e: Eng) => e.posts.filter(p => p.url.endsWith('/mod/events') && p.body.includes('mod_quiet_ended')).length

test('[new] G6 a gate read that never answers inside a held section: a later Not now on another prompt still reaches the gate within the hold', { timeoutMs: 25000 }, async ($, on) => {
  const hang = newHang()
  const e = engine(on, { ms: 0 }, { current: null }, false, hang)
  await start($, e)
  // A competitor nudge is up. The day's budget is then reset, and a fix prompt is waiting for its turn to end.
  await submit($, SITES_ONLY)
  await drain(e)
  expect((await rows($)).nudge).toBe(true)
  e.store.set('modGate', { ...(gateOf(e) as Gate), otherShown: 0, streak: 0 })
  await submit($, FIX_A)
  await drain(e)
  // The turn ends: the first gate read of its held section (the check-in's tick, or the review's step) never answers.
  hang.reads = 1
  await endTurn($, 1)
  await e.clock.advance(1)
  await new Promise(r => setTimeout(r, 300))
  expect(hang.hung).toBe(1)
  // Not now on the nudge is another prompt, another gate step. It must not wait for ever behind the hung one.
  const ui = await $.ui.mount(BAND)
  let pressed: Promise<unknown> = Promise.resolve()
  try {
    await reach(ui, 'skip-nudge')
    pressed = ui.press({ key: 'skip-nudge' })
    const reached = await waitUntil(e, () => gateOf(e)?.streak === 1)
    expect(gateOf(e)?.streak).toBe(1)
    expect(reached).toBe(true)
  } finally {
    await releaseHung(e, hang)
    await bounded(pressed)
    await bounded(ui.unmount())
  }
})

test('[new] G7 five gate steps queued behind a hung one run one at a time after the hold: one quiet end is reported, not five', { timeoutMs: 25000 }, async ($, on) => {
  const hang = newHang()
  // Slow reads and writes, so five steps that started together would all read the quiet gate before any wrote it back.
  const e = engine(on, { ms: 30 }, { current: null }, false, hang)
  await start($, e)
  await submit($, SITES_ONLY)
  await drain(e)
  const ui = await $.ui.mount(BAND)
  let stuck: Promise<unknown> = Promise.resolve()
  try {
    await reach(ui, 'skip-nudge')
    // Not now on the nudge starts a gate step whose read never answers: it holds the lock.
    hang.reads = 1
    stuck = ui.press({ key: 'skip-nudge' })
    await new Promise(r => setTimeout(r, 300))
    expect(hang.hung).toBe(1)
    // The mod is paused (a gate stored by another window, say). Five resumes arrive in the same breath and queue behind the hung step.
    const now = e.clock.now()
    e.store.set('modGate', { mode: 'quiet', streak: 0, quietUntil: now + 7 * 86_400_000, day: localDay(now), suggestionsShown: 0, otherShown: 1 })
    const answers: string[] = []
    for (let i = 0; i < 5; i += 1) void $.command.run({ command: `${PLUGIN}:plugin`, args: 'resume' } as never).then(r => answers.push(r.text), () => answers.push('rejected'))
    const allRan = await waitUntil(e, () => answers.length === 5)
    await drain(e)
    expect(answers).toHaveLength(5)
    expect(allRan).toBe(true)
    expect((gateOf(e) as Gate).mode).toBe('active')
    // One at a time: the first resume ends the pause and the next four find it already ended. All at once: every one reads "quiet" and reports an end.
    expect(quietReports(e)).toBe(1)
  } finally {
    await releaseHung(e, hang)
    await bounded(stuck)
    await bounded(ui.unmount())
  }
})

// A fix prompt whose title is too big for the engine's atom (4 MiB of state) makes drawing the check-in row reject (the engine's own state.set check).
const HUGE_TITLE = 'x'.repeat(4_200_000)
const FIX_HUGE = `From my AI Audit: "${HUGE_TITLE}". Show me the result before anything is sent or changed.`

test('[new] G8 if drawing the check-in row rejects, the slot is not spent: otherShown is unchanged and the next fix check-in still shows', async ($, on) => {
  const e = engine(on, { ms: 0 })
  await start($, e)
  await submit($, FIX_HUGE)
  await endTurn($, 1)
  await drain(e)
  expect(await rows($)).toEqual(NONE)
  expect(gateOf(e)?.otherShown ?? 0).toBe(0)
  // The day's one slot is still there for a normal fix.
  await submit($, FIX_A)
  await endTurn($, 2)
  await drain(e)
  expect(await rows($)).toEqual({ checkin: true, nudge: false })
  expect(gateOf(e)?.otherShown).toBe(1)
})

// ---- A failed write never blocks the next step ----

test('[keep] a gate write that fails once does not stop the next answer from reaching the gate', async ($, on) => {
  const e = engine(on, { ms: 5 }, { current: null }, true)
  await start($, e)
  await submit($, FIX_A)
  await endTurn($, 1)
  await drain(e)
  expect(await rows($)).toEqual({ checkin: true, nudge: false })
  await press($, 'fix-not-now')
  await settle(e)
  expect((gateOf(e) as Gate).streak).toBe(1)
})
