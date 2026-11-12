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

test('a new member sees the welcome card once, and Not now puts it away', async ($, on) => {
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
  // The review of past sessions is done, so the team's notices are the only rows waiting.
  mock.store(on, { welcomed: true, scanned: true })
  mock.env(on, { HOME: '/home/m' })
  const events: string[] = []
  const clock = engine(on, [NOTICE], events)
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'buildpartner:plugin', args: 'notices' } as never)
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
  await $.command.run({ command: 'buildpartner:plugin', args: 'notices' } as never)
  const again = await $.ui.mount(BAND('desktop'))
  expect(await again.find({ type: 'Text', text: /New video from Austin/ })).toBeUndefined()
  await again.unmount()
})

test('pressing a notice\'s button puts it away like Dismiss: clicked once, gone on the next check', async ($, on) => {
  mock.store(on, { welcomed: true, scanned: true })
  mock.env(on, { HOME: '/home/m' })
  const events: string[] = []
  const clock = engine(on, [NOTICE], events)
  const opened: string[] = []
  on('process.run', (_, e) => {
    opened.push(e.argv[e.argv.length - 1] ?? '')
    return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'buildpartner:plugin', args: 'notices' } as never)
  const ui = await $.ui.mount(BAND('desktop'))
  expect((await ui.find({ type: 'Button', key: 'notice-open-n1' }))?.text).toBe('Watch')
  await ui.press({ key: 'notice-open-n1' })
  expect(opened).toContain(NOTICE.link_href)
  expect(await ui.find({ type: 'Text', text: /New video from Austin/ })).toBeUndefined()
  await ui.unmount()
  await clock.advance(1)
  // Admin > Mod counts it as clicked, not dismissed; the server puts a clicked notice away as well.
  expect(events.some(b => b.includes('notice_clicked') && b.includes('"n1"'))).toBe(true)
  expect(events.some(b => b.includes('notice_dismissed'))).toBe(false)
  // The next check (this session, or the next one on this machine) does not bring it back.
  await $.command.run({ command: 'buildpartner:plugin', args: 'notices' } as never)
  const again = await $.ui.mount(BAND('desktop'))
  expect(await again.find({ type: 'Text', text: /New video from Austin/ })).toBeUndefined()
  await again.unmount()
})

test('two notices show one at a time, 1 of 2, and Next steps to the other', async ($, on) => {
  mock.store(on, { welcomed: true, scanned: true })
  mock.env(on, { HOME: '/home/m' })
  const second = { id: 'n2', kind: 'message', message: 'Office hours are Thursday', link_label: null, link_href: null }
  engine(on, [NOTICE, second])
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'buildpartner:plugin', args: 'notices' } as never)
  const ui = await $.ui.mount(BAND('desktop'))
  expect(await ui.find({ type: 'Text', text: /1 of 2/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /New video from Austin/ })).toBeDefined()
  await ui.press({ key: 'row-next' })
  expect(await ui.find({ type: 'Text', text: /Office hours are Thursday/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /2 of 2/ })).toBeDefined()
  await ui.unmount()
})

test('the first-run review is a row above the bar, and Not now puts it away for good', async ($, on) => {
  mock.store(on, { welcomed: true })
  mock.env(on, { HOME: '/home/m' })
  engine(on, [])
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount(BAND('desktop'))
  expect(await ui.find({ type: 'Button', key: 'scan-past-bar' })).toBeDefined()
  await ui.press({ key: 'skip-scan' })
  expect(await ui.find({ type: 'Button', key: 'scan-past-bar' })).toBeUndefined()
  await ui.unmount()
  // Declined stays declined in the next session on this machine.
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  const again = await $.ui.mount(BAND('desktop'))
  expect(await again.find({ type: 'Button', key: 'scan-past-bar' })).toBeUndefined()
  await again.unmount()
})

test('Reset first run brings back the welcome card and the review offer', async ($, on) => {
  mock.store(on, { welcomed: true, scanned: true, scanDeclined: true })
  mock.env(on, { HOME: '/home/m' })
  engine(on, [])
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'buildpartner:plugin', args: 'welcome' } as never)
  const ui = await $.ui.mount(BAND('desktop'))
  expect(await ui.find({ type: 'Text', text: /Welcome to BuildPartner\.ai/ })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'welcome-scan' })).toBeDefined()
  await ui.press({ key: 'welcome-ok' })
  // Not now on the card declines the review too, so no row is left behind.
  expect(await ui.find({ type: 'Text', text: /Welcome to BuildPartner\.ai/ })).toBeUndefined()
  expect(await ui.find({ type: 'Button', key: 'scan-past-bar' })).toBeUndefined()
  await ui.unmount()
})

test('Review recent sessions is a prompt: the click fills the box, and sending it runs the review', async ($, on) => {
  mock.store(on, { welcomed: true })
  mock.env(on, { HOME: '/home/m' })
  engine(on, [])
  on('fs.list', () => ({ value: [] }))
  const filled: string[] = []
  on('prompt.fill', (_, e) => {
    filled.push(e.text)
    return { isFilled: true, text: e.text, cursor: e.text.length }
  })
  on('ui.toast', () => ({ value: undefined }))
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount(BAND('desktop'))
  await ui.press({ key: 'scan-past-bar' })
  // Nothing ran in the background: the command waits in the prompt and the offer is still there.
  expect(filled).toEqual([`/${PLUGIN}:plugin scan`])
  expect(await ui.find({ type: 'Button', key: 'scan-past-bar' })).toBeDefined()
  await ui.unmount()
  // The member presses Enter: the review runs and answers in the chat. No past sessions in the mock, so the offer is done.
  const out = (await $.command.run({ command: 'buildpartner:plugin', args: 'scan' } as never)) as { text?: string }
  expect(out.text ?? '').toContain('No past sessions')
  const after = await $.ui.mount(BAND('desktop'))
  expect(await after.find({ type: 'Button', key: 'scan-past-bar' })).toBeUndefined()
  await after.unmount()
})

test('a review that finds nothing says so, and where the next suggestion shows', async ($, on) => {
  mock.store(on, { welcomed: true })
  mock.env(on, { HOME: '/home/m' })
  engine(on, [])
  // One past session on disk with nothing in it to fix.
  on('fs.list', () => ({ value: [{ name: 'a.jsonl', kind: 'file', size: 10, mtimeMs: 1 }] }))
  on('session.cwd', () => ({ value: '/p' }))
  on('session.id', () => ({ value: 'live' }))
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  const out = (await $.command.run({ command: 'buildpartner:plugin', args: 'scan' } as never)) as { text?: string }
  expect(out.text ?? '').toContain('Nothing to fix. New suggestions show in the mod as you work.')
  expect(out.text ?? '').not.toContain('0 suggestions')
})

test('each feature has its button in Features and its switch under Settings, with what On does', async ($, on) => {
  mock.store(on, { welcomed: true, scanned: true })
  mock.env(on, { HOME: '/home/m' })
  engine(on, [])
  const filled: string[] = []
  on('prompt.fill', (_, e) => {
    filled.push(e.text)
    return { isFilled: true, text: e.text, cursor: e.text.length }
  })
  on('prompt.read', () => ({ value: { text: '', cursor: 0 } }))
  on('ui.toast', () => ({ value: undefined }))
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount(BAND('desktop'))
  await ui.press({ key: 'expand' })
  expect((await ui.find({ type: 'Button', key: 'use-self' }))?.text).toBe('Full setup review')
  expect((await ui.find({ type: 'Button', key: 'use-expert' }))?.text).toBe('Ask an expert')
  // What each feature does is written in its row, with a quiet Learn more beside the button.
  expect(await ui.find({ type: 'Text', text: /^Features$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /When you correct Claude, it suggests a fix/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Advice from proven business experts for your key decisions/ })).toBeDefined()
  expect((await ui.find({ type: 'Button', key: 'more-self' }))?.text).toBe('Learn more')
  expect((await ui.find({ type: 'Button', key: 'more-expert' }))?.text).toBe('Learn more')
  // No status line under the rows: what waits shows as a row above the bar.
  expect(await ui.find({ type: 'Text', text: /Watching \d+ pattern|Nothing noticed yet/ })).toBeUndefined()
  // The switches sit under Settings, each with what On does. Hide the bar is there too, and nothing picks what the bar shows.
  expect(await ui.find({ type: 'Text', text: /^Settings$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Checks automatically as you work with Claude/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Suggests an expert when you face a key decision/ })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'coach-toggle-selfOn' })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'coach-toggle-expertOn' })).toBeDefined()
  expect((await ui.find({ type: 'Button', key: 'turn-off-mod' }))?.text).toBe('Hide the BuildPartner.ai mod')
  expect(await ui.find({ type: 'Text', text: /Show in the bar/ })).toBeUndefined()
  expect(await ui.find({ type: 'Button', key: 'show-self' })).toBeUndefined()
  expect(await ui.find({ type: 'Button', key: 'now' })).toBeUndefined()
  expect(await ui.find({ type: 'Button', key: 'scan-past' })).toBeUndefined()
  // Use on Self-Improving: the full skill in the prompt, and the settings close.
  await ui.press({ key: 'use-self' })
  expect(filled[0]).toMatch(/^\/[a-z-]+:improve-system $/)
  expect(await ui.find({ type: 'Button', key: 'use-self' })).toBeUndefined()
  await ui.press({ key: 'expand' })
  await ui.press({ key: 'use-expert' })
  expect(filled[1]).toMatch(/^\/[a-z-]+:expert-advice /)
  await ui.unmount()
})

test('words typed after a bar command change nothing', async ($, on) => {
  mock.store(on, { welcomed: true, scanned: true })
  mock.env(on, { HOME: '/home/m' })
  engine(on, [])
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  const out = (await $.command.run({ command: 'buildpartner:plugin', args: 'nowI thought this would be expert advice' } as never)) as { text?: string }
  expect(out.text ?? '').toContain('nothing changed')
  const ui = await $.ui.mount(BAND('desktop'))
  // The settings did not open.
  expect(await ui.find({ type: 'Button', key: 'use-self' })).toBeUndefined()
  await ui.unmount()
})

test('hiding the bar tells Admin > Mod', async ($, on) => {
  mock.store(on, { welcomed: true })
  mock.env(on, { HOME: '/home/m' })
  const events: string[] = []
  const clock = engine(on, [], events)
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'buildpartner:plugin', args: 'hide' } as never)
  await $.command.run({ command: 'buildpartner:plugin', args: 'show' } as never)
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
  // The names sit on the bar line with their status word. Nothing explains itself on hover.
  expect((await ui.find({ type: 'Text', text: /Self-Improving System: / }))?.text).toContain('Self-Improving System: ')
  expect((await ui.find({ type: 'Text', text: /Expert Advice: / }))?.text).toContain('Expert Advice: ')
  expect(await ui.find({ type: 'Text', text: /Spots decisions in your conversation/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /AI Coach|Ask the Expert/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /^Additional tools$/ })).toBeUndefined()
  await ui.press({ key: 'expand' })
  expect((await ui.find({ type: 'Text', text: /^Additional tools$/ }))?.text).toBe('Additional tools')
  expect((await ui.find({ type: 'Text', text: /BuildPad/ }))?.text).toContain('BuildPad')
  await ui.unmount()
  const plain = await $.ui.mount(BAND('terminal'))
  expect((await plain.find({ type: 'Text', text: /Self-Improving System/ }))?.text).toContain('Self-Improving System')
  expect((await plain.find({ type: 'Text', text: /Expert Advice:/ }))?.text).toContain('Expert Advice:')
  expect(await plain.find({ type: 'Button', key: 'ask-expert-bar' })).toBeUndefined()
  await plain.unmount()
})

test('a suggestion is a row above the bar with Add rule and Don\'t add; the bar line has no count button', async ($, on) => {
  mock.store(on, { welcomed: true, scanned: true })
  mock.env(on, { HOME: '/home/m' })
  engine(on, [])
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  // A suggestion waiting, as a real review would leave one.
  await $.command.run({ command: 'buildpartner:plugin', args: 'demo' } as never)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount(BAND(surface))
    expect((await ui.find({ type: 'Button', key: 'card-apply-demo-outline-item-count' }))?.text).toBe('Add rule')
    expect(await ui.find({ type: 'Button', key: 'review-suggestions' })).toBeUndefined()
    await ui.unmount()
  }
  const ui = await $.ui.mount(BAND('desktop'))
  expect((await ui.find({ type: 'Text', text: /^Suggested rule$/ }))?.text).toBe('Suggested rule')
  expect((await ui.find({ type: 'Button', key: 'card-dismiss-demo-outline-item-count' }))?.text).toBe("Don't add")
  // ▼ stays: the settings and the rows above do not fight over the screen.
  expect(await ui.find({ type: 'Button', key: 'expand' })).toBeDefined()
  await ui.press({ key: 'card-dismiss-demo-outline-item-count' })
  expect(await ui.find({ type: 'Button', key: 'card-apply-demo-outline-item-count' })).toBeUndefined()
  await ui.unmount()
})

test('a suggestion and a notice share one queue: 1 of 2, Next steps between them', async ($, on) => {
  mock.store(on, { welcomed: true, scanned: true })
  mock.env(on, { HOME: '/home/m' })
  engine(on, [NOTICE])
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'buildpartner:plugin', args: 'demo' } as never)
  await $.command.run({ command: 'buildpartner:plugin', args: 'notices' } as never)
  const ui = await $.ui.mount(BAND('desktop'))
  expect(await ui.find({ type: 'Text', text: /1 of 2/ })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'card-apply-demo-outline-item-count' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /New video from Austin/ })).toBeUndefined()
  await ui.press({ key: 'row-next' })
  expect(await ui.find({ type: 'Text', text: /New video from Austin/ })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'card-apply-demo-outline-item-count' })).toBeUndefined()
  await ui.unmount()
})

test('every button press is counted by label and sent to Admin > Mod', async ($, on) => {
  mock.store(on, { welcomed: true })
  mock.env(on, { HOME: '/home/m' })
  const bodies: string[] = []
  const clock = mock.clock(on)
  on('command.register', () => ({ value: { command: 'plugin' } }))
  on('tool.register', () => ({ value: { tool: 'x' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('fs.read', () => ({ value: JSON.stringify({ token: 't', api_base: 'https://example.test' }) }))
  on('http.fetch', (_, e) => {
    if (e.url.endsWith('/api/buildpartner/mod/presses')) bodies.push(String(e.init?.body ?? ''))
    return { value: { status: 200, ok: true, headers: {}, text: '{"ok":true}' } }
  })
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount(BAND('desktop'))
  await ui.press({ key: 'expand' })
  await clock.advance(1)
  // The first press goes out at once.
  expect(bodies.length).toBe(1)
  expect(JSON.parse(bodies[0]!)).toEqual({ presses: { Settings: 1 } })
  // The next ones wait for the minute tick and travel together.
  await ui.press({ key: 'expand' })
  await ui.press({ key: 'expand' })
  await clock.advance(1_000)
  expect(bodies.length).toBe(1)
  await clock.advance(60_000)
  expect(bodies.length).toBe(2)
  expect(JSON.parse(bodies[1]!)).toEqual({ presses: { Settings: 2 } })
  await ui.unmount()
})

test('a prompt notice: its button fills the prompt box with the team\'s prompt, then the notice goes away', async ($, on) => {
  mock.store(on, { welcomed: true, scanned: true })
  mock.env(on, { HOME: '/home/m' })
  const events: string[] = []
  const prompt = 'Review my CLAUDE.md, skills and settings for what the newest Claude model changes.\nShow me each change first.'
  const clock = engine(on, [{ id: 'p1', kind: 'prompt', message: 'A new Claude model is out. Run this to see how it can improve your setup.', link_label: 'Copy prompt below', link_href: '', prompt: `${prompt}\u0007` }], events)
  const filled: string[] = []
  on('prompt.fill', (_, e) => {
    filled.push(e.text)
    return { isFilled: true, text: e.text, cursor: e.text.length }
  })
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'buildpartner:plugin', args: 'notices' } as never)
  const ui = await $.ui.mount(BAND('desktop'))
  expect(await ui.find({ type: 'Text', text: /A new Claude model is out/ })).toBeDefined()
  expect((await ui.find({ type: 'Button', key: 'notice-prompt-p1' }))?.text).toBe('Copy prompt below')
  await ui.press({ key: 'notice-prompt-p1' })
  // The prompt exactly as written, new lines kept, control characters gone. Nothing is sent: the member presses Enter.
  expect(filled[0]).toBe(prompt)
  expect(await ui.find({ type: 'Text', text: /A new Claude model is out/ })).toBeUndefined()
  await ui.unmount()
  await clock.advance(1)
  expect(events.some(b => b.includes('notice_clicked') && b.includes('"p1"'))).toBe(true)
})

test('a prompt notice with no prompt is not shown', async ($, on) => {
  mock.store(on, { welcomed: true, scanned: true })
  mock.env(on, { HOME: '/home/m' })
  engine(on, [{ id: 'p2', kind: 'prompt', message: 'Run this', link_label: 'Copy prompt below', link_href: '', prompt: '' }])
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'buildpartner:plugin', args: 'notices' } as never)
  const ui = await $.ui.mount(BAND('desktop'))
  expect(await ui.find({ type: 'Button', key: 'notice-prompt-p2' })).toBeUndefined()
  await ui.unmount()
})
