import { expect, mock, test } from 'claude-code/testing'

// This plugin's name: mod-local.sh and deploy-dev-plugin.sh rewrite it with the mod.
const PLUGIN = 'buildpartner'

// The bar above the prompt, as the engine asks for it.
const BAND = (surface: 'terminal' | 'desktop') =>
  ({
    plugin: PLUGIN,
    surface,
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 40, bodyColumns: 120, scroll: { offset: 0, bodyRows: 40 }, view: {} },
  }) as const

const NOTICE = { id: 'n1', kind: 'video', message: 'New video from Austin: my week in Claude Code', link_label: 'Watch', link_href: 'https://www.youtube.com/watch?v=abc' }

type On = Parameters<typeof mock.store>[0]

function engine(on: On, notices: unknown[], events: string[] = []) {
  const clock = mock.clock(on)
  on('command.register', () => ({ value: { command: 'plugin' } }))
  on('tool.register', () => ({ value: { tool: 'x' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('fs.read', () => ({ value: JSON.stringify({ token: 't', api_base: 'https://example.test' }) }))
  on('http.fetch', (_, e) => {
    if (e.url.endsWith('/api/buildpartner/mod/events')) {
      events.push(String(e.init?.body ?? ''))
      return { value: { status: 200, ok: true, headers: {}, text: '{"ok":true}' } }
    }
    return e.url.endsWith('/api/buildpartner/mod/notices')
      ? { value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ notices }) } }
      : { value: { status: 404, ok: false, headers: {}, text: '' } }
  })
  return clock
}

test('a new member sees the welcome card once, and Got it puts it away', async ($, on) => {
  mock.store(on)
  mock.env(on, { HOME: '/home/m' })
  engine(on, [])
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount(BAND(surface))
    expect((await ui.find({ type: 'Text', text: /Welcome to BuildPartner\.ai/ }))?.text).toContain('Welcome')
    await ui.unmount()
  }
  const ui = await $.ui.mount(BAND('desktop'))
  await ui.press({ key: 'welcome-ok' })
  expect(await ui.find({ type: 'Text', text: /Welcome to BuildPartner\.ai/ })).toBeUndefined()
  await ui.unmount()
})

test('a notice from the team shows above the bar until dismissed', async ($, on) => {
  mock.store(on, { welcomed: true })
  mock.env(on, { HOME: '/home/m' })
  const events: string[] = []
  const clock = engine(on, [NOTICE], events)
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'plugin', args: 'notices' } as never)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount(BAND(surface))
    expect((await ui.find({ type: 'Text', text: /New video from Austin/ }))?.text).toContain('my week')
    await ui.unmount()
  }
  const ui = await $.ui.mount(BAND('desktop'))
  await ui.press({ key: 'notice-dismiss-n1' })
  expect(await ui.find({ type: 'Text', text: /New video from Austin/ })).toBeUndefined()
  await ui.unmount()
  await clock.advance(1)
  // Seen once (however often it was drawn), then dismissed: Admin > Mod's numbers.
  expect(events.filter(b => b.includes('notice_seen')).length).toBe(1)
  expect(events.some(b => b.includes('notice_dismissed') && b.includes('"n1"'))).toBe(true)
  // Dismissed stays dismissed on the next check.
  await $.command.run({ command: 'plugin', args: 'notices' } as never)
  const again = await $.ui.mount(BAND('desktop'))
  expect(await again.find({ type: 'Text', text: /New video from Austin/ })).toBeUndefined()
  await again.unmount()
})

test('hiding the bar tells Admin > Mod', async ($, on) => {
  mock.store(on, { welcomed: true })
  mock.env(on, { HOME: '/home/m' })
  const events: string[] = []
  const clock = engine(on, [], events)
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'plugin', args: 'hide' } as never)
  await $.command.run({ command: 'plugin', args: 'show' } as never)
  await clock.advance(1)
  expect(events.filter(b => b.includes('bar_hidden')).length).toBe(1)
  expect(events.filter(b => b.includes('bar_shown')).length).toBe(1)
})

test('the bar is one line: Self-Improving System and Expert Advice, tools only when expanded', async ($, on) => {
  mock.store(on, { welcomed: true })
  mock.env(on, { HOME: '/home/m' })
  engine(on, [])
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount(BAND('desktop'))
  expect((await ui.find({ type: 'Text', text: /^Self-Improving System$/ }))?.text).toBe('Self-Improving System')
  expect((await ui.find({ type: 'Text', text: /^Expert Advice$/ }))?.text).toBe('Expert Advice')
  expect(await ui.find({ type: 'Text', text: /AI Coach|Ask the Expert/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /ADDITIONAL TOOLS/ })).toBeUndefined()
  await ui.press({ key: 'expand' })
  expect((await ui.find({ type: 'Text', text: /ADDITIONAL TOOLS/ }))?.text).toContain('ADDITIONAL TOOLS')
  expect((await ui.find({ type: 'Text', text: /BuildPad/ }))?.text).toContain('BuildPad')
  await ui.unmount()
  const plain = await $.ui.mount(BAND('terminal'))
  expect((await plain.find({ type: 'Text', text: /Self-Improving System/ }))?.text).toContain('Self-Improving System')
  expect((await plain.find({ type: 'Button', key: 'ask-expert-bar' }))?.text).toMatch(/Expert Advice: (On|Off)/)
  await plain.unmount()
})
