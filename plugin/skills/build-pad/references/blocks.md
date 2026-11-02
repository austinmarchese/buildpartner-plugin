# BuildPad toolbox blocks

BuildPad ships standard blocks that any pad can use without bundling its own CSS or JavaScript.
The web app injects a blocks runtime into every pad artifact, next to the artifact SDK:

- `/pad-editor/blocks.js` defines the custom elements `<buildpad-callstack>` and `<buildpad-code>`.
- `/pad-editor/blocks.css` styles them with the BuildPad chrome tokens.

You do not add `<script>` or `<link>` tags for them.
Write the markup below in the pad HTML and the runtime renders it when the pad loads.

| Block | Element | Use it when the decision depends on |
| --- | --- | --- |
| Call stack | `<buildpad-callstack>` | Which code path a change runs through, and which calls it adds, changes, removes, or leaves open |
| Code annotation | `<buildpad-code>` | Specific lines of a file slice or sketch, with the agent's calls on what is safe, risky, or worth a look |

## Decision first

A block is evidence for a decision, not decoration.
Put the decision or question the reviewer must answer above the block, and the block directly under it.
Show only the calls or lines that bear on that decision: a 6 to 15 row call stack or a 5 to 30 line code slice is usually enough.
Pin only lines you want the reviewer to look at; a pin on every line is noise.
Use a Mermaid diagram (see SKILL.md) for architecture and flows between systems, and a call stack for the function-level path through one change.

## Comment targets

Every rendered call stack row and every code line gets a stable `id` and `data-annotate`, so the reviewer can click any row or line to comment on it or select text in it to annotate.
Those comments arrive in `pad poll` as ordinary `comment` items: `selector` is anchored on that row's or line's id, and `selected_text` holds the highlighted text or, for a click, the row's or line's own text.
Match those against your block's rows or lines to find exactly what the reviewer meant, then edit that part.

Give each block element its own stable, meaningful `id`, such as `id="save-path"` or `id="revisions-slice"`.
Keep the block's id across revisions, and avoid reordering rows or shifting lines without a reason, because row and line ids may derive from position and feedback selectors resolve through them.
Target a whole block in `pad update --changes` by its id, for example `{"kind": "modified", "target": "#save-path", "label": "Marked the cache write as removed"}`.

## Call stack

One `<li>` per call, in call order, inside `<buildpad-callstack>`.

| Attribute | Required | Value |
| --- | --- | --- |
| `data-mark` | yes | `+` added, `~` changed, `-` removed, `?` open question or unverified |
| `data-depth` | yes | Integer nesting level; `0` is the entry point, each callee is one deeper |
| `data-at` | yes | `path:line` where the call lives, such as `apps/web/lib/pads/revisions.ts:40` |
| `data-note` | no | One short line on why this call matters to the decision |

The `<li>` text is the call itself, such as `createRevision(padId, input)`.
Escape HTML in the row text as in code slices: write `&lt;` for `<`, `&gt;` for `>`, and `&amp;` for `&`, so `handler<Result>()` becomes `handler&lt;Result&gt;()`.
In `data-note` and other attribute values, write `&amp;` for `&` and `&quot;` for `"`.

```html
<buildpad-callstack id="save-path" aria-label="Revision save path">
  <li data-mark="~" data-depth="0" data-at="apps/web/app/api/pads/[id]/revisions/route.ts:18" data-note="Validates summary and changes before insert">POST /api/pads/:id/revisions</li>
  <li data-mark="~" data-depth="1" data-at="apps/web/lib/pads/revisions.ts:40">createRevision(padId, input)</li>
  <li data-mark="+" data-depth="2" data-at="apps/web/lib/pads/revisions.ts:43" data-note="New: rejects more than 50 changes">validateChanges(input.changes ?? [])</li>
  <li data-mark="-" data-depth="2" data-at="apps/web/lib/pads/summary.ts:12">legacySummaryFallback(input)</li>
  <li data-mark="?" data-depth="2" data-at="apps/web/lib/pads/storage.ts:12" data-note="Does the upload retry on a 409?">uploadRevisionFiles(padId, files)</li>
</buildpad-callstack>
```

Use `?` for calls you have not verified or that hold an open question, and say what is open in `data-note`, so the reviewer can answer it with a comment on that row.

## Code annotation

`<buildpad-code>` wraps the raw text of a file slice or a sketch.

| Attribute | Required | Value |
| --- | --- | --- |
| `data-path` | yes | The file path shown in the block header, or a label such as `sketch: proposed guard` for code that does not exist yet |
| `data-start` | yes | Integer line number of the first code line |

Rules for the code text:

- Start the code immediately after the opening tag's `>`, so the first line is line `data-start`.
- Escape HTML in the code: write `&lt;` for `<`, `&gt;` for `>`, and `&amp;` for `&`.
  The block is parsed as HTML before the runtime sees it, so an unescaped `<` can swallow the rest of the slice.
- Keep the file's real indentation; the runtime preserves whitespace.
- Copy a real slice verbatim with its real starting line, or label it a sketch in `data-path` so nobody mistakes it for live code.

Add an `<buildpad-pin>` after the code for each line you want to call out.

| Attribute | Required | Value |
| --- | --- | --- |
| `line` | yes | Line number the pin points at, between `data-start` and the slice's last line |
| `kind` | yes | `info` context, `warn` worth a look, `risk` likely bug or decision needed, `ok` checked and fine |

The pin text is one or two sentences that say what the reviewer should notice and why it matters to the decision.
Escape it the same way as the code.

```html
<buildpad-code id="revisions-slice" data-path="apps/web/lib/pads/revisions.ts" data-start="40">export async function createRevision(padId: string, input: RevisionInput): Promise&lt;Revision&gt; {
  const next = await nextRevisionNumber(padId)
  const summary = input.summary?.trim() || null
  const changes = validateChanges(input.changes ?? [])
  return db.insert(padRevisions).values({ padId, revision: next, summary, changes })
}
<buildpad-pin line="42" kind="warn">An empty summary becomes null, so the revision step shows no one-liner unless the agent sent one.</buildpad-pin>
<buildpad-pin line="43" kind="ok">The 50-change limit matches the CLI's, so a valid client payload is never rejected here.</buildpad-pin>
</buildpad-code>
```

Line-level comments and text annotations on any line work like other pad comments; there is no separate propose-edit flow in this contract.
When a reviewer comments a replacement on a line, apply it to the slice or sketch in the next revision and declare the change.

## Do not

- Do not include `<script>` or `<link>` tags for `/pad-editor/blocks.js` or `/pad-editor/blocks.css`; the app injects them.
- Do not define your own `buildpad-callstack`, `buildpad-code`, or `buildpad-pin` elements, and do not restyle the runtime's internals; use the blocks as they render.
- Do not expect them to render outside BuildPad: opened as a local file they show as unstyled text.
- Do not paste secrets, credentials, or private data into a code slice; anyone with the pad link can read it.
