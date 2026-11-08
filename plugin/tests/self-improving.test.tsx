import { expect, test } from 'claude-code/testing'

test('/bp-dev:plugin suggestions answers with text', async ($, on) => {
  on('command.run', () => ({ text: 'engine' }))
  const r = await $.command.run({ command: 'plugin', args: 'suggestions' })
  expect(r.text).toContain('suggestions')
})

test('/bp-dev:plugin answers when the engine names it with the plugin prefix', async ($, on) => {
  on('command.run', () => ({ text: 'engine' }))
  const r = await $.command.run({ command: 'buildpartner:plugin', args: 'suggestions' })
  expect(r.text).toContain('suggestions')
})
