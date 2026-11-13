import { expect, mock, test } from 'claude-code/testing'

// Admin > Mod > Rollout: the mod asks GET /api/buildpartner/mod/rollout whether it is on
// for this install. Off means fully dormant: no bar, no model calls, commands say so.

// This plugin's name: mod-local.sh and deploy-dev-plugin.sh rewrite it with the mod.
const PLUGIN = 'buildpartner'

const BAND = (surface: 'terminal' | 'desktop') =>
  ({
    plugin: PLUGIN,
    surface,
    component: 'AbovePrompt',
    props: { hasSurvey: false, isCollapsed: false, isWorking: false, maxRows: 40, bodyColumns: 120, scroll: { offset: 0, bodyRows: 40 }, view: {} },
  }) as const

type On = Parameters<typeof mock.store>[0]

/** A signed-in member whose rollout answer is `rollout` (a status and body), with a store shared across "sessions". */
function engine(on: On, rollout: { status: number; text: string }, store: Map<string, unknown>) {
  const asked: string[] = []
  const models: string[] = []
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
  on('session.messages', () => ({ value: [{ role: 'user', text: 'Should I price the starter offer at $49 a month or $490 a year?' }] }) as never)
  on('session.surfaces', () => ({ value: ['desktop'] }) as never)
  on('turn.complete', () => ({ text: '' }) as never)
  on('model.complete', (_, e) => {
    models.push(String((e as { model?: string }).model))
    return { value: { isAnswered: true, text: '{"expert":null,"items":[]}', usage: { input_tokens: 1, output_tokens: 1 } } } as never
  })
  on('http.fetch', (_, e) => {
    asked.push(e.url)
    if (e.url.endsWith('/api/buildpartner/mod/rollout')) return { value: { status: rollout.status, ok: rollout.status === 200, headers: {}, text: rollout.text } }
    return e.url.endsWith('/api/buildpartner/mod/notices')
      ? { value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ notices: [] }) } }
      : { value: { status: 200, ok: true, headers: {}, text: '{"ok":true}' } }
  })
  return { clock, asked, models }
}

const settle = async () => {
  for (let i = 0; i < 5; i += 1) await new Promise(r => setTimeout(r, 10))
}

test('rollout off: no bar, no notices read, no model call after a turn, the command says it is not on yet', async ($, on) => {
  const store = new Map<string, unknown>([['welcomed', true], ['scanned', true]])
  const { clock, asked, models } = engine(on, { status: 200, text: '{"show":false}' }, store)
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true } as never)
  await clock.advance(1)
  await settle()
  expect(asked.some(u => u.endsWith('/api/buildpartner/mod/rollout'))).toBe(true)
  expect(store.get('rolloutShow')).toBe(false)
  const ui = await $.ui.mount(BAND('desktop'))
  expect(await ui.find({ type: 'Text', text: /BuildPartner\.ai/ })).toBeUndefined()
  await ui.unmount()
  await clock.advance(120_000)
  await $.turn.complete({ reason: 'answer', answer: 'ok', durationMs: 10, isAborted: false, turnId: 't1' } as never)
  await clock.advance(1)
  await settle()
  expect(models).toEqual([])
  expect(asked.some(u => u.endsWith('/api/buildpartner/mod/notices'))).toBe(false)
  const r = (await $.command.run({ command: 'buildpartner:plugin', args: 'now' } as never)) as { text?: string }
  expect(r.text).toContain('not on for your account yet')
})

test('rollout on: the bar draws as before', async ($, on) => {
  const store = new Map<string, unknown>([['welcomed', true], ['scanned', true]])
  const { clock } = engine(on, { status: 200, text: '{"show":true}' }, store)
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true } as never)
  await clock.advance(1)
  await settle()
  expect(store.get('rolloutShow')).toBe(true)
  const ui = await $.ui.mount(BAND('desktop'))
  expect(await ui.find({ type: 'Text', text: /BuildPartner\.ai/ })).toBeDefined()
  await ui.unmount()
})

test('a failed ask keeps the last answer: dormant stays dormant', async ($, on) => {
  const store = new Map<string, unknown>([['welcomed', true], ['scanned', true], ['rolloutShow', false]])
  const { clock } = engine(on, { status: 503, text: '{"error":"x"}' }, store)
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true } as never)
  await clock.advance(1)
  await settle()
  const ui = await $.ui.mount(BAND('desktop'))
  expect(await ui.find({ type: 'Text', text: /BuildPartner\.ai/ })).toBeUndefined()
  await ui.unmount()
})

test('a failed ask with no answer yet shows the bar', async ($, on) => {
  const store = new Map<string, unknown>([['welcomed', true], ['scanned', true]])
  const { clock } = engine(on, { status: 503, text: '{"error":"x"}' }, store)
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true } as never)
  await clock.advance(1)
  await settle()
  const ui = await $.ui.mount(BAND('desktop'))
  expect(await ui.find({ type: 'Text', text: /BuildPartner\.ai/ })).toBeDefined()
  await ui.unmount()
})

test('turned on in Admin > Mod: an open session picks it up on the hourly check', async ($, on) => {
  const store = new Map<string, unknown>([['welcomed', true], ['scanned', true]])
  const rollout = { status: 200, text: '{"show":false}' }
  const { clock } = engine(on, rollout, store)
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true } as never)
  await clock.advance(1)
  await settle()
  const before = await $.ui.mount(BAND('desktop'))
  expect(await before.find({ type: 'Text', text: /BuildPartner\.ai/ })).toBeUndefined()
  await before.unmount()
  rollout.text = '{"show":true}'
  await clock.advance(60 * 60_000)
  await settle()
  const after = await $.ui.mount(BAND('desktop'))
  expect(await after.find({ type: 'Text', text: /BuildPartner\.ai/ })).toBeDefined()
  await after.unmount()
})
