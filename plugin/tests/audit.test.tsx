import { expect, mock, test } from 'claude-code/testing'

// The AI Audit's row above the bar: how far a run is, read from the file the audit writes on
// the member's machine after each stage (~/.buildpartner/audit/findings.json). Passive while it
// runs; one Open button when it is done. Nothing in it is sent anywhere by the bar.
//
// This plugin's name: mod-local.sh and deploy-dev-plugin.sh rewrite it with the mod.
const PLUGIN = 'buildpartner'

const BAND = (surface: 'terminal' | 'desktop') =>
  ({
    plugin: PLUGIN,
    surface,
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 40, bodyColumns: 120, scroll: { offset: 0, bodyRows: 40 }, view: {} },
  }) as const

type On = Parameters<typeof mock.store>[0]

const FILE = '/home/m/.buildpartner/audit/findings.json'
const RUN = 'Run my AI Audit. Find the work I do by hand that you could take off my plate.'

// What `Buffer.from(text).toString('base64url')` gives in the prompt's own command, written out
// here because the test runtime has no Buffer.
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
const bytesOf = (text: string) => {
  const out: number[] = []
  const enc = encodeURIComponent(text)
  for (let i = 0; i < enc.length; i++) {
    if (enc[i] === '%') {
      out.push(parseInt(enc.slice(i + 1, i + 3), 16))
      i += 2
    } else out.push(enc.charCodeAt(i))
  }
  return out
}
const pack = (text: string) => {
  const b = bytesOf(text)
  let out = ''
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i]! << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0)
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]!
    if (i + 1 < b.length) out += B64[(n >> 6) & 63]!
    if (i + 2 < b.length) out += B64[n & 63]!
  }
  return out
}
const unpack = (packed: string) => {
  let bits = 0
  let have = 0
  let enc = ''
  for (const ch of packed) {
    bits = (bits << 6) | B64.indexOf(ch)
    have += 6
    if (have >= 8) {
      have -= 8
      enc += '%' + ((bits >> have) & 255).toString(16).padStart(2, '0')
    }
  }
  return decodeURIComponent(enc)
}

const findings = (n: number, more: Record<string, unknown> = {}) =>
  JSON.stringify({ status: 'sweep', stage: 3, findings: Array.from({ length: n }, (_, i) => ({ id: `f${i + 1}`, title: `Finding ${i + 1}`, evidence: { examples: [{ what: 'Re: Q3 numbers – José' }] } })), ...more })

/** A signed-in member past the first run. `disk` is the audit's file as it is right now: the test changes it as Claude would. */
async function member($: { session: { start: (a: never) => Promise<unknown> } }, on: On, disk: { text: string; mtimeMs: number }, opened: string[][] = []) {
  mock.store(on, { welcomed: true, scanned: true })
  mock.env(on, { HOME: '/home/m' })
  const clock = mock.clock(on)
  on('tool.register', () => ({ value: { tool: 'x' } }))
  on('fs.list', () => ({ value: [] }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('fs.read', (_, e) => ({ value: e.path === FILE ? disk.text : JSON.stringify({ token: 't', api_base: 'https://example.test' }) }))
  on('fs.stat', (_, e) => (e.path === FILE && disk.text ? { value: { kind: 'file', size: disk.text.length, mtimeMs: disk.mtimeMs, isLink: false } } : { error: new Error('not found') }))
  on('process.run', (_, e) => {
    opened.push([...e.argv])
    return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('tool.call', () => ({ result: 'ok' }))
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('http.fetch', (_, e) =>
    e.url.endsWith('/api/buildpartner/mod/notices')
      ? { value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ notices: [] }) } }
      : { value: { status: 200, ok: true, headers: {}, text: '{"ok":true}' } },
  )
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true } as never)
  return clock
}

test('the audit prompt puts its row above the bar at once, before anything is saved', async ($, on) => {
  // An earlier audit's file is on disk: a new run never shows its numbers.
  const disk = { text: findings(9, { status: 'done' }), mtimeMs: 1 }
  const clock = await member($, on, disk)
  await clock.advance(5_000)
  const sent = await $.prompt.submit({ text: RUN } as never)
  // The prompt goes to Claude as the member sent it.
  expect((sent as { text?: string }).text).toBe(RUN)
  const ui = await $.ui.mount(BAND('desktop'))
  expect(await ui.find({ type: 'Text', text: /^AI Audit$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Your audit is running\./ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /9 findings/ })).toBeUndefined()
  // Claude reads the old file (a tool call that touches the audit folder): still not this run's.
  await $.tool.call({ tool: 'Read', file_path: FILE } as never)
  await clock.advance(1)
  expect(await ui.find({ type: 'Text', text: /9 findings/ })).toBeUndefined()
  expect(await ui.find({ type: 'Button', key: 'audit-open' })).toBeUndefined()
  await ui.unmount()
})

test('each save shows the stage, the count and the newest finding; done offers the chart', async ($, on) => {
  const disk = { text: '', mtimeMs: 0 }
  const opened: string[][] = []
  const clock = await member($, on, disk, opened)
  await clock.advance(5_000)
  await $.prompt.submit({ text: RUN } as never)
  const ui = await $.ui.mount(BAND('desktop'))

  disk.text = findings(4)
  disk.mtimeMs = clock.now()
  await $.tool.call({ tool: 'Write', file_path: '~/.buildpartner/audit/findings.json', content: disk.text } as never)
  await clock.advance(1)
  expect(await ui.find({ type: 'Text', text: /stage 3 of 6/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^4 findings so far\.$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Newest: Finding 4/ })).toBeDefined()
  // While it runs there is nothing to decide: no primary button.
  expect(await ui.find({ type: 'Button', key: 'audit-open' })).toBeUndefined()

  // A half-written file changes nothing.
  disk.text = '{"status": "sweep", "findi'
  await $.tool.call({ tool: 'Bash', command: 'cat > ~/.buildpartner/audit/findings.json' } as never)
  await clock.advance(1)
  expect(await ui.find({ type: 'Text', text: /^4 findings so far\.$/ })).toBeDefined()

  disk.text = findings(7, { status: 'done', stage: 6 })
  disk.mtimeMs = clock.now()
  await $.tool.call({ tool: 'Write', file_path: FILE, content: disk.text } as never)
  await clock.advance(1)
  expect(await ui.find({ type: 'Text', text: /^7 findings ready\.$/ })).toBeDefined()
  expect((await ui.find({ type: 'Button', key: 'audit-open' }))?.text).toBe('Open my chart')

  // Open my chart: the audit page on the member's own BuildPartner.ai address, with the file in the
  // link exactly as the prompt's own command builds it (base64url of the file, accents and all).
  await ui.press({ key: 'audit-open' })
  const url = opened[0]?.[opened[0].length - 1] ?? ''
  expect(url.startsWith('https://example.test/dashboard/audit#import=')).toBe(true)
  const packed = url.split('#import=')[1] ?? ''
  expect(packed).toBe(pack(disk.text))
  expect(unpack(packed)).toBe(disk.text)
  // Opening it puts the row away, and a later read of the file does not bring it back.
  expect(await ui.find({ type: 'Button', key: 'audit-open' })).toBeUndefined()
  await $.tool.call({ tool: 'Read', file_path: FILE } as never)
  await clock.advance(1)
  expect(await ui.find({ type: 'Button', key: 'audit-open' })).toBeUndefined()
  await ui.unmount()
})

test('a run the bar never saw the prompt for still shows, from its first save', async ($, on) => {
  const disk = { text: '', mtimeMs: 0 }
  const clock = await member($, on, disk)
  await clock.advance(5_000)
  disk.text = findings(2, { stage: 1 })
  disk.mtimeMs = clock.now()
  await $.tool.call({ tool: 'Write', file_path: FILE, content: disk.text } as never)
  await clock.advance(1)
  const ui = await $.ui.mount(BAND('terminal'))
  // The terminal's one line carries the name, since it has no header.
  expect(await ui.find({ type: 'Text', text: /AI Audit, stage 1 of 6: 2 findings so far\./ })).toBeDefined()
  await ui.unmount()
})

test('an old audit file read in a session with no run shows nothing', async ($, on) => {
  const disk = { text: findings(5, { status: 'done' }), mtimeMs: 1 }
  const clock = await member($, on, disk)
  await clock.advance(10 * 60_000)
  await $.tool.call({ tool: 'Read', file_path: FILE } as never)
  await clock.advance(1)
  const ui = await $.ui.mount(BAND('desktop'))
  expect(await ui.find({ type: 'Text', text: /^AI Audit$/ })).toBeUndefined()
  await ui.unmount()
})

test('when Claude opens the chart itself, the finished row goes; Dismiss puts a running one away for the run', async ($, on) => {
  const disk = { text: '', mtimeMs: 0 }
  const clock = await member($, on, disk)
  await clock.advance(5_000)
  await $.prompt.submit({ text: RUN } as never)
  const ui = await $.ui.mount(BAND('desktop'))
  await ui.press({ key: 'audit-dismiss' })
  expect(await ui.find({ type: 'Text', text: /^AI Audit$/ })).toBeUndefined()
  disk.text = findings(3)
  disk.mtimeMs = clock.now()
  await $.tool.call({ tool: 'Write', file_path: FILE, content: disk.text } as never)
  await clock.advance(1)
  expect(await ui.find({ type: 'Text', text: /^AI Audit$/ })).toBeUndefined()

  // A new run shows again.
  await clock.advance(60_000)
  await $.prompt.submit({ text: 'Re-run my AI Audit. Keep the same id for anything you found before.' } as never)
  disk.text = findings(6, { status: 'done', stage: 6 })
  disk.mtimeMs = clock.now()
  await $.tool.call({ tool: 'Write', file_path: FILE, content: disk.text } as never)
  await clock.advance(1)
  expect(await ui.find({ type: 'Button', key: 'audit-open' })).toBeDefined()
  await $.tool.call({ tool: 'Bash', command: `open "https://www.buildpartner.ai/dashboard/audit#import=${pack(disk.text)}"` } as never)
  await clock.advance(1)
  expect(await ui.find({ type: 'Button', key: 'audit-open' })).toBeUndefined()
  await ui.unmount()
})

test('"Continue my AI Audit" shows where the run left off; a run with no save for an hour goes', async ($, on) => {
  const disk = { text: findings(5, { stage: 4 }), mtimeMs: 1 }
  const clock = await member($, on, disk)
  await clock.advance(5_000)
  await $.prompt.submit({ text: 'Continue my AI Audit. Read ~/.buildpartner/audit/progress.md and carry on.' } as never)
  const ui = await $.ui.mount(BAND('desktop'))
  expect(await ui.find({ type: 'Text', text: /stage 4 of 6/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^5 findings so far\.$/ })).toBeDefined()
  await clock.advance(61 * 60_000)
  expect(await ui.find({ type: 'Text', text: /^AI Audit$/ })).toBeUndefined()
  await ui.unmount()
})

test('test states "audit" and "audit-done" draw the two rows, and their buttons work', async ($, on) => {
  const disk = { text: '', mtimeMs: 0 }
  const opened: string[][] = []
  await member($, on, disk, opened)
  await $.command.run({ command: 'buildpartner:plugin', args: 'test audit' } as never)
  const ui = await $.ui.mount(BAND('desktop'))
  expect(await ui.find({ type: 'Text', text: /stage 3 of 6/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^4 findings so far\.$/ })).toBeDefined()
  await $.command.run({ command: 'buildpartner:plugin', args: 'test audit-done' } as never)
  expect((await ui.find({ type: 'Button', key: 'audit-open' }))?.text).toBe('Open my chart')
  // No file on this machine: the page still opens.
  await ui.press({ key: 'audit-open' })
  expect(opened[0]?.[opened[0].length - 1]).toBe('https://example.test/dashboard/audit')
  expect(await ui.find({ type: 'Button', key: 'audit-open' })).toBeUndefined()
  await $.command.run({ command: 'buildpartner:plugin', args: 'test audit-done' } as never)
  await ui.press({ key: 'audit-dismiss' })
  expect(await ui.find({ type: 'Text', text: /^AI Audit$/ })).toBeUndefined()
  await ui.unmount()
})
