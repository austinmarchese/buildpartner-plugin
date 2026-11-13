import { expect, test } from 'claude-code/testing'

test('/buildpartner:plugin suggestions answers with text', async ($, on) => {
  on('command.run', () => ({ text: 'engine' }))
  const r = await $.command.run({ command: 'buildpartner:plugin', args: 'suggestions' })
  expect(r.text).toContain('suggestions')
})
