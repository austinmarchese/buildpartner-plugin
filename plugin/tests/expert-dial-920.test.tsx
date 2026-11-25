import { expect, mock, test } from 'claude-code/testing'

// Spec N (#920, chief-hq #922): the Expert Advice nudge fires only on real business decisions, Not now holds for 7 days, and the
// rollout answer's optional `expert` dial ({ cooldown_days, not_now_days }) sets the cadence. Written from the spec before the code.
// The pure rules (the fit filter, the dial parse, the cooldown arithmetic) are tested in apps/web/lib/__tests__/expert-nudge-920.test.ts;
// this file holds the seams only the engine can drive: what refreshRollout stores, and that the stored dial reaches the nudge.
// Tags: [new] fails before the change, [keep] passes before and after.
// Run: sh scripts/mod-local.sh <dir> (plus copy plugin/hooks/*.ts beside self-improving.tsx), then `claude plugin test <dir>/bp-local`.

// This plugin's name: mod-local.sh and deploy-dev-plugin.sh rewrite it with the mod.
const PLUGIN = 'buildpartner'
const DAY = 86_400_000

const BAND = (surface: 'terminal' | 'desktop') =>
  ({
    plugin: PLUGIN,
    surface,
    component: 'AbovePrompt',
    props: { hasSurvey: false, isCollapsed: false, isWorking: false, maxRows: 40, bodyColumns: 120, scroll: { offset: 0, bodyRows: 40 }, view: {} },
  }) as const

type On = Parameters<typeof mock.store>[0]

type Flag = { category: string; topic: string; question: string }
const PRICING: Flag = { category: 'sales', topic: 'Starter tier pricing', question: 'Should the starter tier cost $29 a month?' }
const MECHANICS: Flag = { category: 'product', topic: 'Swapping a list item', question: 'Should I swap the list item above the button?' }

/** A signed-in member, the Self-Improving review off (so a decision question gets the one-message check), a rollout answer and a model that flags `flag`. */
function engine(on: On, rollout: { status: number; text: string }, store: Map<string, unknown>, flag: { current: Flag | null }) {
  const said = { text: '' }
  on('store.get', (_, e) => ({ value: store.get((e as { key: string }).key) }) as never)
  on('store.set', (_, e) => (store.set((e as { key: string }).key, (e as { value: unknown }).value), { value: undefined }) as never)
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
  on('model.complete', () => ({
    value: { isAnswered: true, text: JSON.stringify({ expert: flag.current, items: [] }), usage: { input_tokens: 1, output_tokens: 1 } },
  }) as never)
  on('http.fetch', (_, e) => {
    if (e.url.endsWith('/api/buildpartner/mod/rollout')) return { value: { status: rollout.status, ok: rollout.status === 200, headers: {}, text: rollout.text } }
    return e.url.endsWith('/api/buildpartner/mod/notices')
      ? { value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ notices: [] }) } }
      : { value: { status: 200, ok: true, headers: {}, text: '{"ok":true}' } }
  })
  return { clock, said }
}

const settle = async () => {
  for (let i = 0; i < 5; i += 1) await new Promise(r => setTimeout(r, 10))
}

const MEMBER_STORE = (): Map<string, unknown> => new Map<string, unknown>([['welcomed', true], ['scanned', true], ['settings', { selfOn: false, expertOn: true }]])

type Clock = ReturnType<typeof engine>['clock']

/** Time passes in 12 hour steps: the engine refuses one advance of more than its shortest interval (10 s) times 10000 waits. */
async function later(clock: Clock, ms: number) {
  for (let left = ms; left > 0; left -= DAY / 2) await clock.advance(Math.min(left, DAY / 2))
  await settle()
}

/** The member sends a business-sounding question and the turn ends; then whether the expert card is on the bar. */
async function turn($: Parameters<Parameters<typeof test>[1]>[0], said: { text: string }, clock: Clock, text: string, n: number, thenNotNow = false): Promise<boolean> {
  said.text = text
  await $.turn.complete({ reason: 'answer', answer: 'ok', durationMs: 10, isAborted: false, turnId: `t${n}` } as never)
  await clock.advance(1)
  await settle()
  const ui = await $.ui.mount(BAND('desktop'))
  const shown = (await ui.find({ type: 'Button', key: 'ask-expert-nudge' })) !== undefined
  if (shown && thenNotNow) await ui.press({ key: 'skip-expert' })
  await ui.unmount()
  return shown
}

const Q1 = 'Should I price the starter offer at $49 a month or $490 a year?'
const Q2 = 'Should we launch the course in January or in March?'
const Q3 = 'Should I hire a part-time editor for the newsletter?'

test('[new] a rollout answer with an expert dial is stored under expertDial', async ($, on) => {
  const store = MEMBER_STORE()
  const { clock, said } = engine(on, { status: 200, text: JSON.stringify({ show: true, expert: { cooldown_days: 2, not_now_days: 10 } }) }, store, { current: null })
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true } as never)
  await clock.advance(1)
  await settle()
  expect(store.get('rolloutShow')).toBe(true)
  expect(store.get('expertDial')).toBeDefined()
})

test('[keep] a rollout answer with no expert field (an older server) still shows the bar and stores the show answer', async ($, on) => {
  const store = MEMBER_STORE()
  const { clock, said } = engine(on, { status: 200, text: '{"show":true}' }, store, { current: null })
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true } as never)
  await clock.advance(1)
  await settle()
  expect(store.get('rolloutShow')).toBe(true)
  const ui = await $.ui.mount(BAND('desktop'))
  expect(await ui.find({ type: 'Text', text: /BuildPartner\.ai/ })).toBeDefined()
  await ui.unmount()
})

for (const expert of ['loud', null, 7, [1, 2], { cooldown_days: 'x', not_now_days: -3 }]) {
  test(`[keep] a malformed expert field (${JSON.stringify(expert)}) changes nothing about the show answer`, async ($, on) => {
    const store = MEMBER_STORE()
    const { clock } = engine(on, { status: 200, text: JSON.stringify({ show: true, expert }) }, store, { current: null })
    await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true } as never)
    await clock.advance(1)
    await settle()
    expect(store.get('rolloutShow')).toBe(true)
  })
}

test('[keep] a failed ask keeps the last stored dial', async ($, on) => {
  const dial = { expertCooldownMs: 2 * DAY, expertNotNowMs: 10 * DAY }
  const store = MEMBER_STORE()
  store.set('expertDial', dial)
  store.set('rolloutShow', true)
  const { clock, said } = engine(on, { status: 503, text: '{"error":"x"}' }, store, { current: null })
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true } as never)
  await clock.advance(1)
  await settle()
  expect(store.get('expertDial')).toEqual(dial)
  expect(store.get('rolloutShow')).toBe(true)
})

test('[new] a flagged mechanics question ("Swapping a list item") never raises the expert card', async ($, on) => {
  const store = MEMBER_STORE()
  const flag = { current: MECHANICS as Flag | null }
  const { clock, said } = engine(on, { status: 200, text: '{"show":true}' }, store, flag)
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true } as never)
  await clock.advance(1)
  await settle()
  expect(await turn($, said, clock, 'Should I swap the list item above the button?', 1)).toBe(false)
  // The dropped flag spent nothing: a real business decision right after still shows the card.
  flag.current = PRICING
  expect(await turn($, said, clock, Q1, 2)).toBe(true)
})

test('[keep] a flagged business question raises the expert card', async ($, on) => {
  const store = MEMBER_STORE()
  const { clock, said } = engine(on, { status: 200, text: '{"show":true}' }, store, { current: PRICING })
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true } as never)
  await clock.advance(1)
  await settle()
  expect(await turn($, said, clock, Q1, 1)).toBe(true)
})

/**
 * A member whose last Not now on the expert card (and last card shown) were `dismissed` and `shown` ms ago, with this rollout answer.
 * Seeding the store keeps these tests off the engine's slow day-long clock steps; the press path is covered by the 2 day test below.
 */
async function seeded($: Parameters<Parameters<typeof test>[1]>[0], on: On, rollout: string, ago: { dismissed?: number; shown?: number }) {
  const store = MEMBER_STORE()
  const e = engine(on, { status: 200, text: rollout }, store, { current: PRICING })
  const t = e.clock.now()
  if (ago.dismissed !== undefined) store.set('nudgesDismissed', { expert_decision: t - ago.dismissed })
  if (ago.shown !== undefined) store.set('nudgesShown', { expert_decision: t - ago.shown })
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true } as never)
  await e.clock.advance(1)
  await settle()
  return e
}

const DIAL = (cooldown_days: number, not_now_days: number) => JSON.stringify({ show: true, expert: { cooldown_days, not_now_days } })

test('[new] with no dial, a Not now 3 days ago still holds the card away (the wait is 7 days)', async ($, on) => {
  const { clock, said } = await seeded($, on, '{"show":true}', { dismissed: 3 * DAY })
  expect(await turn($, said, clock, Q1, 1)).toBe(false)
})

test('[new] with no dial, a Not now 6 days ago still holds the card away', async ($, on) => {
  const { clock, said } = await seeded($, on, '{"show":true}', { dismissed: 6 * DAY })
  expect(await turn($, said, clock, Q1, 1)).toBe(false)
})

test('[keep] with no dial, a Not now 8 days ago is over: the card shows', async ($, on) => {
  const { clock, said } = await seeded($, on, '{"show":true}', { dismissed: 8 * DAY })
  expect(await turn($, said, clock, Q1, 1)).toBe(true)
})

test('[new] a dial of not_now_days 10: a Not now 8 days ago still holds the card away', async ($, on) => {
  const { clock, said } = await seeded($, on, DIAL(0, 10), { dismissed: 8 * DAY })
  expect(await turn($, said, clock, Q1, 1)).toBe(false)
})

test('[keep] a dial of not_now_days 10: a Not now 11 days ago is over', async ($, on) => {
  const { clock, said } = await seeded($, on, DIAL(0, 10), { dismissed: 11 * DAY })
  expect(await turn($, said, clock, Q1, 1)).toBe(true)
})

test('[new] a dial of cooldown_days 3: a card shown 2 days ago holds the next one away', async ($, on) => {
  const { clock, said } = await seeded($, on, DIAL(3, 7), { shown: 2 * DAY })
  expect(await turn($, said, clock, Q1, 1)).toBe(false)
})

test('[keep] a dial of cooldown_days 3: a card shown 4 days ago no longer holds the next one', async ($, on) => {
  const { clock, said } = await seeded($, on, DIAL(3, 7), { shown: 4 * DAY })
  expect(await turn($, said, clock, Q1, 1)).toBe(true)
})

test("[keep] with no dial, a card shown 2 days ago does not hold the next one (today's cadence has no shown cooldown)", async ($, on) => {
  const { clock, said } = await seeded($, on, '{"show":true}', { shown: 2 * DAY })
  expect(await turn($, said, clock, Q1, 1)).toBe(true)
})

test('[keep] a dial of not_now_days 1: pressing Not now puts the card away for a day, then it is back (the press path works with a stored dial)', async ($, on) => {
  const store = MEMBER_STORE()
  const { clock, said } = engine(on, { status: 200, text: DIAL(0, 1) }, store, { current: PRICING })
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true } as never)
  await clock.advance(1)
  await settle()
  expect(await turn($, said, clock, Q1, 1, true)).toBe(true)
  await later(clock, DAY / 2)
  expect(await turn($, said, clock, Q2, 2)).toBe(false)
  await later(clock, DAY / 2 + 60_000)
  expect(await turn($, said, clock, Q3, 3)).toBe(true)
})
