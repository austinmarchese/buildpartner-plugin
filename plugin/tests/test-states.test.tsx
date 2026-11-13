import { expect, mock, test } from 'claude-code/testing'

// The dev test states (Debug > Test a state, /bp-dev:plugin test <key>): each puts the bar
// into a REAL state, so the buttons on it must work exactly as they do for a member.
//
// This plugin's name: mod-local.sh and deploy-dev-plugin.sh rewrite it with the mod. The test
// states exist in dev builds only (bp-local, bp-dev), which is where these tests run.
const PLUGIN = 'buildpartner'

const BAND = (surface: 'terminal' | 'desktop') =>
  ({
    plugin: PLUGIN,
    surface,
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 40, bodyColumns: 120, scroll: { offset: 0, bodyRows: 40 }, view: {} },
  }) as const

type On = Parameters<typeof mock.store>[0]

/** A member past the first run, signed in, with no notices from the team. */
async function member($: { session: { start: (a: never) => Promise<unknown> } }, on: On, store: Record<string, unknown> = { welcomed: true, scanned: true }) {
  mock.store(on, store)
  mock.env(on, { HOME: '/home/m' })
  const clock = mock.clock(on)
  on('tool.register', () => ({ value: { tool: 'x' } }))
  // No past sessions on disk: the first-run review ends at once.
  on('fs.list', () => ({ value: [] }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('fs.read', () => ({ value: JSON.stringify({ token: 't', api_base: 'https://example.test' }) }))
  on('http.fetch', (_, e) =>
    e.url.endsWith('/api/buildpartner/mod/notices')
      ? { value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ notices: [] }) } }
      : { value: { status: 200, ok: true, headers: {}, text: '{"ok":true}' } },
  )
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true } as never)
  return clock
}

const state = ($: { command: { run: (a: never) => Promise<unknown> } }, key: string) => $.command.run({ command: 'buildpartner:plugin', args: `test ${key}` } as never)

test('test state "suggestions": two real suggestions, and Don\'t add puts one away', async ($, on) => {
  await member($, on)
  await state($, 'suggestions')
  const ui = await $.ui.mount(BAND('desktop'))
  expect(await ui.find({ type: 'Text', text: /1 of 2/ })).toBeDefined()
  expect((await ui.find({ type: 'Button', key: 'card-apply-demo-outline-item-count' }))?.text).toBe('Add rule')
  await ui.press({ key: 'card-dismiss-demo-outline-item-count' })
  expect(await ui.find({ type: 'Button', key: 'card-apply-demo-outline-item-count' })).toBeUndefined()
  // The other one is still there, alone now: no counter.
  expect((await ui.find({ type: 'Button', key: 'card-apply-demo-skill' }))?.text).toBe('Update skill')
  expect(await ui.find({ type: 'Text', text: /of 2/ })).toBeUndefined()
  await ui.unmount()
})

test('test state "expert": the question shows, and Not now puts it away', async ($, on) => {
  await member($, on)
  await state($, 'expert')
  const ui = await $.ui.mount(BAND('desktop'))
  expect((await ui.find({ type: 'Button', key: 'ask-expert-nudge' }))?.text).toBe('Ask the expert')
  expect(await ui.find({ type: 'Text', text: /Starter tier pricing/ })).toBeDefined()
  await ui.press({ key: 'skip-expert' })
  expect(await ui.find({ type: 'Button', key: 'ask-expert-nudge' })).toBeUndefined()
  await ui.unmount()
})

test('test state "notices": two notifications, Dismiss works, and the state can be set again', async ($, on) => {
  await member($, on)
  await state($, 'notices')
  const ui = await $.ui.mount(BAND('desktop'))
  expect(await ui.find({ type: 'Text', text: /1 of 2/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Office hours are live/ })).toBeDefined()
  await ui.press({ key: 'notice-dismiss-preview-notice' })
  expect(await ui.find({ type: 'Text', text: /Office hours are live/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /New video from Austin/ })).toBeDefined()
  await ui.unmount()
  // Dismissed once must not mean gone for good: the test state comes back whole.
  await state($, 'notices')
  const again = await $.ui.mount(BAND('desktop'))
  expect(await again.find({ type: 'Text', text: /Office hours are live/ })).toBeDefined()
  expect(await again.find({ type: 'Text', text: /1 of 2/ })).toBeDefined()
  await again.unmount()
})

test('test state "first-run": the welcome card for real, then both ways through it', async ($, on) => {
  await member($, on, { welcomed: true, scanned: true, scanDeclined: true })
  await state($, 'first-run')
  const ui = await $.ui.mount(BAND('desktop'))
  expect(await ui.find({ type: 'Text', text: /Welcome to BuildPartner\.ai/ })).toBeDefined()
  // Review recent sessions (a prompt): the card closes and the offer waits above the bar until the member sends it.
  await ui.press({ key: 'welcome-scan' })
  expect(await ui.find({ type: 'Text', text: /Welcome to BuildPartner\.ai/ })).toBeUndefined()
  expect(await ui.find({ type: 'Button', key: 'scan-past-bar' })).toBeDefined()
  await ui.unmount()
  // Sent: with no past sessions the review ends at once and the offer is done.
  await $.command.run({ command: 'buildpartner:plugin', args: 'scan' } as never)
  const ran = await $.ui.mount(BAND('desktop'))
  expect(await ran.find({ type: 'Button', key: 'scan-past-bar' })).toBeUndefined()
  await ran.unmount()
  // Again, the other way: Not now closes the card and leaves no row behind.
  await state($, 'first-run')
  const again = await $.ui.mount(BAND('desktop'))
  expect(await again.find({ type: 'Button', key: 'welcome-scan' })).toBeDefined()
  await again.press({ key: 'welcome-ok' })
  expect(await again.find({ type: 'Text', text: /Welcome to BuildPartner\.ai/ })).toBeUndefined()
  expect(await again.find({ type: 'Button', key: 'scan-past-bar' })).toBeUndefined()
  await again.unmount()
})

test('test state "everything" fills one queue, and "clear" empties it', async ($, on) => {
  await member($, on)
  await state($, 'everything')
  const ui = await $.ui.mount(BAND('desktop'))
  // An AI Audit run, the expert question, two suggestions, two notifications (a tool tip joins only when a tool is connected).
  expect(await ui.find({ type: 'Text', text: /1 of 6/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^4 findings so far\.$/ })).toBeDefined()
  await ui.press({ key: 'row-next' })
  expect(await ui.find({ type: 'Text', text: /2 of 6/ })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'ask-expert-nudge' })).toBeDefined()
  await ui.press({ key: 'row-next' })
  expect(await ui.find({ type: 'Text', text: /3 of 6/ })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'card-apply-demo-outline-item-count' })).toBeDefined()
  await ui.unmount()
  await state($, 'clear')
  const empty = await $.ui.mount(BAND('desktop'))
  expect(await empty.find({ type: 'Button', key: 'row-next' })).toBeUndefined()
  expect(await empty.find({ type: 'Button', key: 'ask-expert-nudge' })).toBeUndefined()
  expect(await empty.find({ type: 'Button', key: 'card-apply-demo-outline-item-count' })).toBeUndefined()
  expect(await empty.find({ type: 'Text', text: /Office hours are live/ })).toBeUndefined()
  expect(await empty.find({ type: 'Text', text: /^AI Audit$/ })).toBeUndefined()
  await empty.unmount()
})

test('Debug has a button per test state, and it sets the state for real', async ($, on) => {
  await member($, on)
  const ui = await $.ui.mount(BAND('desktop'))
  await ui.press({ key: 'expand' })
  for (const key of ['first-run', 'suggestions', 'expert', 'tip', 'notices', 'audit', 'audit-done', 'everything', 'clear']) {
    expect(await ui.find({ type: 'Button', key: `ts-${key}` })).toBeDefined()
  }
  expect(await ui.find({ type: 'Text', text: /^In the mod$/ })).toBeDefined()
  await ui.press({ key: 'ts-suggestions' })
  // The settings close so the row is in view.
  expect(await ui.find({ type: 'Button', key: 'ts-suggestions' })).toBeUndefined()
  expect((await ui.find({ type: 'Button', key: 'card-apply-demo-outline-item-count' }))?.text).toBe('Add rule')
  await ui.unmount()
})

test('a plan preview draws only: a click on a real row still works under it', async ($, on) => {
  await member($, on)
  await state($, 'suggestions')
  await $.command.run({ command: 'buildpartner:plugin', args: 'preview pro' } as never)
  const ui = await $.ui.mount(BAND('desktop'))
  await ui.press({ key: 'card-dismiss-demo-outline-item-count' })
  expect(await ui.find({ type: 'Button', key: 'card-apply-demo-outline-item-count' })).toBeUndefined()
  await ui.unmount()
})

test('the expanded bar has a collapse button at its bottom, and it closes the panel', async ($, on) => {
  await member($, on)
  const ui = await $.ui.mount(BAND('desktop'))
  expect(await ui.find({ type: 'Button', key: 'collapse-bottom' })).toBeUndefined()
  await ui.press({ key: 'expand' })
  expect(await ui.find({ type: 'Button', key: 'collapse-bottom' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^Settings$/ })).toBeDefined()
  await ui.press({ key: 'collapse-bottom' })
  expect(await ui.find({ type: 'Button', key: 'collapse-bottom' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /^Settings$/ })).toBeUndefined()
  await ui.unmount()
})

test('out of free runs, the expert question waits: only the upgrade row asks, and each row keeps its own button', async ($, on) => {
  mock.store(on, { welcomed: true, scanned: true })
  mock.env(on, { HOME: '/home/m' })
  const clock = mock.clock(on)
  on('tool.register', () => ({ value: { tool: 'x' } }))
  on('fs.list', () => ({ value: [] }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('fs.read', () => ({ value: JSON.stringify({ token: 't', api_base: 'https://example.test' }) }))
  on('http.fetch', (_, e) =>
    e.url.endsWith('/api/buildpartner/mod/notices')
      ? { value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ notices: [] }) } }
      : e.url.endsWith('/api/buildpartner/plan')
        ? { value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ plan: 'Free', paid: false, credits_left: 0, has_coach: false }) } }
        : { value: { status: 200, ok: true, headers: {}, text: '{"ok":true}' } },
  )
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true } as never)
  await clock.advance(1)
  await state($, 'expert')
  const ui = await $.ui.mount(BAND('desktop'))
  // One row, not "1 of 2": the upgrade row alone, with See plans.
  expect((await ui.find({ type: 'Button', key: 'upgrade-bar' }))?.text).toBe('See plans')
  expect(await ui.find({ type: 'Button', key: 'ask-expert-nudge' })).toBeUndefined()
  expect(await ui.find({ type: 'Button', key: 'row-next' })).toBeUndefined()
  // Not now on the upgrade row does not bring back an expert row that would lead to the same page.
  await ui.press({ key: 'skip-upgrade' })
  expect(await ui.find({ type: 'Button', key: 'ask-expert-nudge' })).toBeUndefined()
  await ui.unmount()
})

const RUN_FAILS = { value: { exitCode: 1, stdout: '', stderr: 'no browser', isStdoutTruncated: false, isStderrTruncated: false } }

test('See plans with no browser to open: the prompt fills with the open-dashboard command for the plans page, no token', async ($, on) => {
  mock.store(on, { welcomed: true, scanned: true })
  mock.env(on, { HOME: '/home/m' })
  const clock = mock.clock(on)
  const ran: string[][] = []
  const filled: string[] = []
  on('process.run', (_, e) => (ran.push([...e.argv]), RUN_FAILS))
  on('prompt.read', () => ({ value: { text: '' } }) as never)
  on('prompt.fill', (_, e) => {
    filled.push(e.text)
    return { isFilled: true, text: e.text, cursor: e.text.length }
  })
  const toasts: string[] = []
  on('ui.toast', (_, e) => (toasts.push(String((e as { text?: unknown }).text ?? '')), { value: undefined }))
  on('tool.register', () => ({ value: { tool: 'x' } }))
  on('fs.list', () => ({ value: [] }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('fs.read', () => ({ value: JSON.stringify({ token: 't', api_base: 'https://example.test' }) }))
  const reports: string[] = []
  on('http.fetch', (_, e) =>
    e.url.endsWith('/api/buildpartner/mod/errors')
      ? (reports.push(String(e.init?.body ?? '')), { value: { status: 200, ok: true, headers: {}, text: '{"ok":true}' } })
      : e.url.endsWith('/api/buildpartner/mod/notices')
      ? { value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ notices: [] }) } }
      : e.url.endsWith('/api/buildpartner/plan')
        ? { value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ plan: 'Free', paid: false, credits_left: 0, has_coach: false }) } }
        : { value: { status: 200, ok: true, headers: {}, text: '{"ok":true}' } },
  )
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true } as never)
  await clock.advance(1)
  const ui = await $.ui.mount(BAND('desktop'))
  await ui.press({ key: 'upgrade-bar' })
  // Every opener was tried with the signed-in plans page, then the catch-all.
  expect(ran.map(a => a[0])).toEqual(['open', 'xdg-open', 'rundll32'])
  expect(ran[0]?.[1]).toBe('https://example.test/dashboard?upgrade=true&t=t')
  expect(filled).toEqual(["/bp-dev:open-dashboard /dashboard?upgrade=true"])
  expect(toasts.some(t => /Press Enter and Claude opens the page/.test(t))).toBe(true)
  // The team hears about it in Slack: which page and how each opener failed, nothing personal.
  await clock.advance(1)
  expect(reports).toHaveLength(1)
  const sent = JSON.parse(reports[0] as string) as { action: string; detail: string }
  expect(sent.action).toBe('browser did not open')
  // Directional only: the page by its path and how each opener failed, never what an opener printed.
  expect(sent.detail).toBe('/dashboard · open exit 1, xdg-open exit 1, rundll32 exit 1')
  expect(reports[0]).not.toContain('t=t')
  // The upgrade row stays, so See plans can be pressed again.
  expect((await ui.find({ type: 'Button', key: 'upgrade-bar' }))?.text).toBe('See plans')
  await ui.unmount()
})

test('Founder Knowledge never shows under the bar, even when its tool is connected', async ($, on) => {
  on('tool.list', () => ({ value: [{ name: 'mcp__plugin_bp-dev-team_tools__get_founder_knowledge' }, { name: 'mcp__plugin_bp-dev_tools__web_research' }] }) as never)
  await member($, on)
  const ui = await $.ui.mount(BAND('desktop'))
  await ui.press({ key: 'expand' })
  expect(await ui.find({ type: 'Text', text: /^Web Research$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Founder Knowledge/ })).toBeUndefined()
  await ui.unmount()
})

/** A member past the first run whose latest message weighs a business call, with switches as given. */
async function turnWith($: Parameters<Parameters<typeof test>[1]>[0], on: On, switches: Record<string, unknown>) {
  const calls: string[] = []
  on('session.messages', () => ({ value: [{ role: 'user', text: 'Should I price the starter offer at $49 a month or $490 a year?' }, { role: 'assistant', text: 'Here are the options.' }] }) as never)
  on('session.surfaces', () => ({ value: ['desktop'] }) as never)
  on('turn.complete', () => ({ text: '' }) as never)
  on('session.id', () => ({ value: 's1' }) as never)
  on('session.cwd', () => ({ value: '/p' }) as never)
  on('fs.exists', () => ({ value: false }) as never)
  on('fs.stat', () => ({ value: { kind: 'other', size: 0, mtimeMs: 0, isLink: false } }) as never)
  on('model.complete', (_, e) => {
    calls.push(String((e as { model?: string }).model))
    return { value: { isAnswered: true, text: '{"expert":{"category":"sales","topic":"Starter pricing","question":"Monthly or yearly for the starter offer?"},"items":[]}', usage: { input_tokens: 1, output_tokens: 1 } } } as never
  })
  const clock = await member($ as never, on, { welcomed: true, scanned: true, settings: switches })
  // Past the minute between reviews, so a review would be allowed to run.
  await clock.advance(120_000)
  const turn = async () => {
    await $.turn.complete({ reason: 'answer', answer: 'Here are the options.', durationMs: 10, isAborted: false, turnId: 't1' } as never)
    await clock.advance(1)
    // Let the review's own steps (file reads, the model call) settle.
    for (let i = 0; i < 5; i += 1) await new Promise(r => setTimeout(r, 10))
  }
  return { calls, turn }
}

test('Self-Improving off, Expert Advice on: no review of the conversation, one quick check flags the decision', async ($, on) => {
  const { calls, turn } = await turnWith($, on, { selfOn: false, expertOn: true })
  await turn()
  expect(calls).toEqual(['haiku'])
  const ui = await $.ui.mount(BAND('desktop'))
  expect((await ui.find({ type: 'Button', key: 'ask-expert-nudge' }))?.text).toBe('Ask the expert')
  await ui.unmount()
})

test('both switches off: nothing calls the model after a turn', async ($, on) => {
  const { calls, turn } = await turnWith($, on, { selfOn: false, expertOn: false })
  await turn()
  expect(calls).toEqual([])
})

test('/plugin hide pauses reviews too: nothing calls the model after a turn', async ($, on) => {
  const { calls, turn } = await turnWith($, on, { selfOn: true, expertOn: true })
  await $.command.run({ command: 'buildpartner:plugin', args: 'hide' } as never)
  await turn()
  expect(calls).toEqual([])
})

test('Self-Improving on: a decision question gets the full review (the control for the tests above)', async ($, on) => {
  const { calls, turn } = await turnWith($, on, { selfOn: true, expertOn: true })
  await turn()
  expect(calls).toContain('opus')
})

test('a suggestion dismissed in another window leaves this one within 10 seconds', async ($, on) => {
  // The store the windows on this machine share, held here so the test can act as the other window.
  const store = new Map<string, unknown>([['welcomed', true], ['scanned', true]])
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
  on('http.fetch', (_, e) =>
    e.url.endsWith('/api/buildpartner/mod/notices')
      ? { value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ notices: [] }) } }
      : { value: { status: 200, ok: true, headers: {}, text: '{"ok":true}' } },
  )
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true } as never)
  await state($, 'suggestions')
  const ui = await $.ui.mount(BAND('desktop'))
  // One shows at a time: the first of 2.
  expect(await ui.find({ type: 'Button', key: 'card-apply-demo-outline-item-count' })).toBeDefined()
  // Another window on this machine dismisses it.
  const saved = store.get('patterns') as Record<string, { status: string }>
  store.set('patterns', { ...saved, 'demo-outline-item-count': { ...saved['demo-outline-item-count'], status: 'dismissed' } })
  await clock.advance(10_000)
  expect(await ui.find({ type: 'Button', key: 'card-apply-demo-outline-item-count' })).toBeUndefined()
  expect(await ui.find({ type: 'Button', key: 'card-apply-demo-skill' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /of 2/ })).toBeUndefined()
  await ui.unmount()
})
