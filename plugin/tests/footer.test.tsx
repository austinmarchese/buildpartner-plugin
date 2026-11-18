import { expect, mock, test } from 'claude-code/testing'

// The quiet line at the bottom of Settings (▼): version, when it updated, who is signed in, and
// the plan, on one line. The email comes from ~/.buildpartner/auth.json, the plan from
// GET /api/buildpartner/plan. The token is never drawn.

// This plugin's name: mod-local.sh and deploy-dev-plugin.sh rewrite it with the mod.
const PLUGIN = 'buildpartner'
const TOKEN = 'secret-token-123'

const BAND = (surface: 'terminal' | 'desktop', bodyColumns = 120) =>
  ({
    plugin: PLUGIN,
    surface,
    component: 'AbovePrompt',
    props: { hasSurvey: false, isCollapsed: false, isWorking: false, maxRows: 60, bodyColumns, scroll: { offset: 0, bodyRows: 60 }, view: {} },
  }) as const

type On = Parameters<typeof mock.store>[0]

/** A member past the first run. `signedIn` false: auth.json has no token. `planName` null: the plan call fails. */
async function member($: { session: { start: (a: never) => Promise<unknown> } }, on: On, o: { signedIn?: boolean; email?: string; planName?: string | null } = {}) {
  const signedIn = o.signedIn ?? true
  const email = o.email ?? 'you@example.com'
  const planName = o.planName === undefined ? 'Pro' : o.planName
  mock.store(on, { welcomed: true, scanned: true })
  mock.env(on, { HOME: '/home/m' })
  const clock = mock.clock(on)
  on('tool.register', () => ({ value: { tool: 'x' } }))
  on('fs.list', () => ({ value: [] }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('fs.read', (_, e) => {
    const path = String((e as { path?: string }).path ?? '')
    if (path.endsWith('/.claude-plugin/plugin.json')) return { value: JSON.stringify({ version: '0.15.15' }) }
    if (path.endsWith('/.buildpartner/auth.json'))
      return { value: JSON.stringify(signedIn ? { token: TOKEN, api_base: 'https://example.test', email } : { api_base: 'https://example.test' }) }
    return { value: '' }
  })
  on('http.fetch', (_, e) => {
    if (e.url.includes('/api/buildpartner/plan'))
      return planName
        ? { value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ plan: planName, paid: planName !== 'Free', credits_left: null, has_coach: false }) } }
        : { value: { status: 500, ok: false, headers: {}, text: '' } }
    if (e.url.endsWith('/api/buildpartner/mod/notices')) return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ notices: [] }) } }
    return { value: { status: 200, ok: true, headers: {}, text: '{"ok":true}' } }
  })
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true } as never)
  await clock.advance(1)
  await settle()
  return clock
}

const settle = async () => {
  for (let i = 0; i < 5; i += 1) await new Promise(r => setTimeout(r, 10))
}

/** Opens Settings (▼) and returns the footer line's text. */
async function footer($: { ui: { mount: (b: never) => Promise<Mounted> } }, clock: { advance: (ms: number) => Promise<unknown> }, surface: 'terminal' | 'desktop', bodyColumns = 120) {
  const ui = await $.ui.mount(BAND(surface, bodyColumns) as never)
  // The panel stays open across mounts: press ▼ only when it is closed.
  if (!(await ui.find({ type: 'Button', key: 'collapse-bottom' }))) await ui.press({ key: 'expand' })
  await clock.advance(1)
  await settle()
  const line = await ui.find({ type: 'Text', text: /^BuildPartner\.ai v0\.15\.15/ })
  const text = String((line as { text?: string } | undefined)?.text ?? '')
  await ui.unmount()
  return text
}

type Mounted = {
  press: (q: { key: string }) => Promise<unknown>
  find: (q: { type: string; text?: RegExp; key?: string }) => Promise<unknown>
  unmount: () => Promise<unknown>
}

for (const surface of ['desktop', 'terminal'] as const) {
  test(`${surface}: signed in, the footer says who and the plan on one line`, async ($, on) => {
    const clock = await member($, on)
    const text = await footer($ as never, clock, surface)
    expect(text).toMatch(/^BuildPartner\.ai v0\.15\.15 · updated .+ · Signed in as you@example\.com · Pro$/)
    expect(text).not.toContain(TOKEN)
  })
}

test('the plan name is the one the server sends (Starter, Collaboration)', async ($, on) => {
  const clock = await member($, on, { planName: 'Collaboration' })
  expect(await footer($ as never, clock, 'desktop')).toMatch(/ · Signed in as you@example\.com · Collaboration$/)
})

test('plan not read yet: the footer leaves it out instead of guessing', async ($, on) => {
  const clock = await member($, on, { planName: null })
  expect(await footer($ as never, clock, 'desktop')).toMatch(/ · Signed in as you@example\.com$/)
})

test('signed out: no account, no plan, the red sign-in line follows', async ($, on) => {
  const clock = await member($, on, { signedIn: false })
  const ui = await $.ui.mount(BAND('desktop') as never)
  await ui.press({ key: 'expand' })
  await clock.advance(1)
  await settle()
  expect(await ui.find({ type: 'Text', text: /Signed in as/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /Not signed in, run the BuildPartner\.ai install again/ })).toBeDefined()
  await ui.unmount()
})

test('narrow: "updated" goes first, then the email is cut, and the plan stays', async ($, on) => {
  const clock = await member($, on, { email: 'austin.longname@averylongcompanydomain.com' })
  // 100 columns: everything but "updated" fits.
  const mid = await footer($ as never, clock, 'terminal', 100)
  expect(mid).toBe('BuildPartner.ai v0.15.15 · Signed in as austin.longname@averylongcompanydomain.com · Pro')
  // 60 columns: the email is cut short to keep the line whole.
  const narrow = await footer($ as never, clock, 'terminal', 60)
  expect(narrow).not.toContain('updated')
  expect(narrow).toMatch(/^BuildPartner\.ai v0\.15\.15 · Signed in as austin.*… · Pro$/)
  // room is bodyColumns - 2, less 5 for ▲ and padding.
  expect(narrow.length).toBeLessThanOrEqual(60 - 2 - 5)
})
