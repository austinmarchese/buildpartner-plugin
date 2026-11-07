import { expect, test } from 'claude-code/testing'

test('/assistant suggestions answers with text', async ($, on) => {
  on('command.run', () => ({ text: 'engine' }))
  const r = await $.command.run({ command: 'assistant', args: 'suggestions' })
  expect(r.text).toContain('suggestions')
})

test('/assistant answers when the engine names it with the plugin prefix', async ($, on) => {
  on('command.run', () => ({ text: 'engine' }))
  const r = await $.command.run({ command: 'buildpartner:assistant', args: 'suggestions' })
  expect(r.text).toContain('suggestions')
})
