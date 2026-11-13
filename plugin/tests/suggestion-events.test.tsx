import { expect, mock, test } from 'claude-code/testing'

// This plugin's name: mod-local.sh and deploy-dev-plugin.sh rewrite it with the mod.
const PLUGIN = 'buildpartner'

type On = Parameters<typeof mock.store>[0]

const PATTERN = {
  id: 'plan-before-big-edits',
  type: 'skill_fix',
  target: '.claude/skills/outline/SKILL.md',
  change: 'Show a short plan before editing more than two files.',
  evidence: 'tell me the plan first',
  sessions: ['s1', 's2'],
  corrections: 1,
  firstSeen: 0,
  lastSeen: 0,
  status: 'suggested',
}

function engine(on: On, events: string[]) {
  const clock = mock.clock(on)
  on('command.register', () => ({ value: { command: 'plugin' } }))
  on('tool.register', () => ({ value: { tool: 'x' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('fs.read', () => ({ value: JSON.stringify({ token: 't', api_base: 'https://example.test' }) }))
  on('http.fetch', (_, e) => {
    if (e.url.endsWith('/api/buildpartner/mod/events')) events.push(String(e.init?.body ?? ''))
    return { value: { status: 200, ok: true, headers: {}, text: '{"ok":true,"notices":[]}' } }
  })
  return clock
}

test('a dismissed suggestion reports its type only, once', async ($, on) => {
  mock.store(on, { welcomed: true, patterns: { [PATTERN.id]: PATTERN } })
  mock.env(on, { HOME: '/home/m' })
  const events: string[] = []
  const clock = engine(on, events)
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  const call = { tool: `mcp__${PLUGIN}__resolve_suggestion`, input: { id: PATTERN.id, decision: 'dismissed' } }
  await $.tool.call(call as never)
  await $.tool.call(call as never)
  await clock.advance(1_000)
  const sent = events.filter(b => b.includes('suggestion_'))
  expect(sent).toEqual([JSON.stringify({ kind: 'suggestion_dismissed', suggestion_type: 'skill_fix' })])
  for (const b of sent) {
    expect(b).not.toContain(PATTERN.id)
    expect(b).not.toContain('SKILL.md')
  }
})
