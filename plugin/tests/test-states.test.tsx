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
  mock.clock(on)
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
  expect(await ui.find({ type: 'Text', text: /^Above the bar$/ })).toBeDefined()
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
  expect(ran.map(a => a[0])).toEqual(['open', 'xdg-open', 'cmd'])
  expect(ran[0]?.[1]).toBe('https://example.test/dashboard?upgrade=true&t=t')
  expect(filled).toEqual(["/bp-dev:open-dashboard /dashboard?upgrade=true"])
  expect(toasts.some(t => /Press Enter and Claude opens the page/.test(t))).toBe(true)
  // The team hears about it in Slack, with what each opener said and no sign-in token.
  await clock.advance(1)
  expect(reports).toHaveLength(1)
  const sent = JSON.parse(reports[0] as string) as { action: string; detail: string }
  expect(sent.action).toBe('browser did not open')
  expect(sent.detail).toContain('https://example.test/dashboard')
  expect(sent.detail).toContain('open exit 1 (no browser)')
  expect(reports[0]).not.toContain('t=t')
  // The upgrade row stays, so See plans can be pressed again.
  expect((await ui.find({ type: 'Button', key: 'upgrade-bar' }))?.text).toBe('See plans')
  await ui.unmount()
})
