import { expect, mock, test } from 'claude-code/testing'

test('/buildpartner:plugin suggestions answers with text', async ($, on) => {
  on('command.run', () => ({ text: 'engine' }))
  const r = await $.command.run({ command: 'buildpartner:plugin', args: 'suggestions' })
  expect(r.text).toContain('suggestions')
})

// Lessons approved in this session reach Claude through the system prompt (prompt.compose). Where a
// plugin above ours skips that hook, they ride on the prompt as context instead, once per change.
const PLUGIN = 'buildpartner'
const BAND = {
  plugin: PLUGIN,
  surface: 'desktop',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 40, bodyColumns: 120, scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const
const PATTERN = {
  id: 'plan-before-big-edits',
  type: 'instruction',
  target: 'CLAUDE.md',
  change: 'Show a short plan before editing more than two files.',
  evidence: 'tell me the plan first',
  sessions: ['s1', 's2'],
  corrections: 1,
  firstSeen: 0,
  lastSeen: 0,
  status: 'suggested',
}
const LESSONS = `Lessons the member approved in this session. Follow them now:\n- ${PATTERN.change}`

type On = Parameters<typeof mock.store>[0]

/** A member who presses Apply on one suggestion; `sent` lists the context of every prompt that reached the bottom. */
async function applied($: Parameters<Parameters<typeof test>[1]>[0], on: On) {
  mock.store(on, { welcomed: true, scanned: true, patterns: { [PATTERN.id]: PATTERN } })
  mock.env(on, { HOME: '/home/m' })
  const clock = mock.clock(on)
  const sent: (readonly string[] | undefined)[] = []
  const filled: string[] = []
  on('prompt.read', () => ({ value: { text: '' } }) as never)
  on('prompt.fill', (_, e) => (filled.push(e.text), { isFilled: true, text: e.text, cursor: e.text.length }))
  on('prompt.submit', (_, e) => (sent.push(e.context), { text: e.text }))
  on('prompt.compose', () => ({ sections: [] }))
  on('tool.register', () => ({ value: { tool: 'x' } }))
  on('fs.list', () => ({ value: [] }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.messages', () => ({ value: [] }) as never)
  on('fs.read', () => ({ value: JSON.stringify({ token: 't', api_base: 'https://example.test' }) }))
  on('http.fetch', (_, e) =>
    e.url.endsWith('/api/buildpartner/mod/notices')
      ? { value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ notices: [] }) } }
      : { value: { status: 200, ok: true, headers: {}, text: '{"ok":true}' } },
  )
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true } as never)
  await clock.advance(1)
  const ui = await $.ui.mount(BAND)
  await ui.press({ key: `card-apply-${PATTERN.id}` })
  await ui.unmount()
  return { sent, applyPrompt: filled.join('\n') }
}

test('approved lessons ride on the Apply prompt as context once, and not on the next prompt', async ($, on) => {
  const { sent, applyPrompt } = await applied($, on)
  await $.prompt.submit({ text: applyPrompt } as never)
  await $.prompt.submit({ text: 'Thanks, now fix the login bug.' } as never)
  expect(sent).toEqual([[LESSONS], undefined])
})

test('approved lessons ride on the first prompt after a compaction', async ($, on) => {
  const { sent, applyPrompt } = await applied($, on)
  await $.prompt.submit({ text: applyPrompt } as never)
  await $.session.compact({ trigger: 'manual', messages: [{ role: 'user', text: 'hi', toolUses: [] }] } as never)
  await $.prompt.submit({ text: 'Carry on.' } as never)
  await $.prompt.submit({ text: 'And again.' } as never)
  expect(sent).toEqual([[LESSONS], [LESSONS], undefined])
})

test('approved lessons ride on no prompt where the system prompt route ran', async ($, on) => {
  const { sent, applyPrompt } = await applied($, on)
  await $.prompt.compose({ model: 'm', promptModel: 'm', surfaces: [], tools: [], outputStyle: null, traits: [] })
  await $.prompt.submit({ text: applyPrompt } as never)
  expect(sent).toEqual([undefined])
})
